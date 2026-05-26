/**
 * Symmetric encryption for OAuth tokens stored in D1.
 *
 * ENCRYPTION_KEY is a 32-byte hex string (64 hex chars). We use AES-GCM with
 * a fresh 12-byte IV per record. The stored format is base64(iv || ciphertext).
 */

const TEXT_ENCODER = new TextEncoder();
const TEXT_DECODER = new TextDecoder();

function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) throw new Error("ENCRYPTION_KEY hex length must be even");
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

async function importKey(rawHex: string): Promise<CryptoKey> {
  const raw = hexToBytes(rawHex);
  if (raw.length !== 32) throw new Error("ENCRYPTION_KEY must be 32 bytes (64 hex chars)");
  // Copy to a strict ArrayBuffer so the type checker is happy across lib variants
  const buf = new ArrayBuffer(raw.length);
  new Uint8Array(buf).set(raw);
  return crypto.subtle.importKey("raw", buf, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

export async function encryptString(plaintext: string, keyHex: string): Promise<string> {
  const key = await importKey(keyHex);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, TEXT_ENCODER.encode(plaintext)),
  );
  const out = new Uint8Array(iv.length + ct.length);
  out.set(iv, 0);
  out.set(ct, iv.length);
  return btoa(String.fromCharCode(...out));
}

export async function decryptString(b64: string, keyHex: string): Promise<string> {
  const key = await importKey(keyHex);
  const raw = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const iv = raw.slice(0, 12);
  const ct = raw.slice(12);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
  return TEXT_DECODER.decode(pt);
}

/* ----- HMAC for cookie signing (separate from token encryption) ----- */

export async function hmacSign(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    TEXT_ENCODER.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, TEXT_ENCODER.encode(payload)));
  return btoa(String.fromCharCode(...sig)).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}

export async function hmacVerify(payload: string, signature: string, secret: string): Promise<boolean> {
  const expected = await hmacSign(payload, secret);
  // constant-time compare
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  return diff === 0;
}

/* ----- Argon2 alternative: we use PBKDF2-SHA256 because workerd ships it natively ----- */

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iterations = 210_000;
  const key = await crypto.subtle.importKey(
    "raw",
    TEXT_ENCODER.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"],
  );
  const bits = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "PBKDF2", hash: "SHA-256", salt, iterations },
      key,
      256,
    ),
  );
  const saltB64 = btoa(String.fromCharCode(...salt));
  const hashB64 = btoa(String.fromCharCode(...bits));
  return `pbkdf2-sha256$${iterations}$${saltB64}$${hashB64}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, iterStr, saltB64, hashB64] = stored.split("$");
  if (scheme !== "pbkdf2-sha256" || !iterStr || !saltB64 || !hashB64) return false;
  const iterations = Number.parseInt(iterStr, 10);
  let salt: Uint8Array;
  let target: Uint8Array;
  try {
    salt = Uint8Array.from(atob(saltB64), (c) => c.charCodeAt(0));
    target = Uint8Array.from(atob(hashB64), (c) => c.charCodeAt(0));
  } catch {
    return false;
  }
  const key = await crypto.subtle.importKey(
    "raw",
    TEXT_ENCODER.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"],
  );
  const saltBuf = new ArrayBuffer(salt.length);
  new Uint8Array(saltBuf).set(salt);
  const bits = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "PBKDF2", hash: "SHA-256", salt: saltBuf, iterations },
      key,
      target.length * 8,
    ),
  );
  if (bits.length !== target.length) return false;
  let diff = 0;
  for (let i = 0; i < bits.length; i++) diff |= bits[i]! ^ target[i]!;
  return diff === 0;
}

export function randomId(bytes = 16): string {
  const buf = crypto.getRandomValues(new Uint8Array(bytes));
  return Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
}
