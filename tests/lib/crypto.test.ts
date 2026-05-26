import { describe, expect, it } from "vitest";
import { webcrypto } from "node:crypto";
import {
  decryptString,
  encryptString,
  hashPassword,
  hmacSign,
  hmacVerify,
  randomId,
  verifyPassword,
} from "../../src/lib/crypto";

// Vitest's Node environment ships `globalThis.crypto.subtle` already, but make
// sure it's the webcrypto impl on older Node versions.
if (!(globalThis as { crypto?: unknown }).crypto) {
  Object.defineProperty(globalThis, "crypto", { value: webcrypto });
}

const KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

describe("encryptString / decryptString", () => {
  it("round-trips a string", async () => {
    const ct = await encryptString("hello world", KEY);
    expect(ct).not.toBe("hello world");
    expect(await decryptString(ct, KEY)).toBe("hello world");
  });
  it("uses a fresh IV each call (ciphertexts differ)", async () => {
    const a = await encryptString("x", KEY);
    const b = await encryptString("x", KEY);
    expect(a).not.toBe(b);
  });
  it("rejects keys of wrong length", async () => {
    await expect(encryptString("x", "deadbeef")).rejects.toThrow(/32 bytes/);
  });
});

describe("hmacSign / hmacVerify", () => {
  it("verifies a valid signature", async () => {
    const sig = await hmacSign("payload", "secret");
    expect(await hmacVerify("payload", sig, "secret")).toBe(true);
  });
  it("rejects tampered payload", async () => {
    const sig = await hmacSign("payload", "secret");
    expect(await hmacVerify("payloadX", sig, "secret")).toBe(false);
  });
  it("rejects sig length mismatch", async () => {
    expect(await hmacVerify("p", "short", "secret")).toBe(false);
  });
});

describe("hashPassword / verifyPassword", () => {
  it("verifies the correct password", async () => {
    const h = await hashPassword("hunter2");
    expect(await verifyPassword("hunter2", h)).toBe(true);
  });
  it("rejects the wrong password", async () => {
    const h = await hashPassword("hunter2");
    expect(await verifyPassword("nope", h)).toBe(false);
  });
  it("rejects malformed stored hashes", async () => {
    expect(await verifyPassword("x", "bad-format")).toBe(false);
    expect(await verifyPassword("x", "pbkdf2-sha256$1$a$b")).toBe(false); // bytes won't match
  });
});

describe("randomId", () => {
  it("returns hex of requested length", () => {
    const id = randomId(8);
    expect(id).toMatch(/^[0-9a-f]{16}$/);
  });
  it("returns 32-char default", () => {
    expect(randomId()).toMatch(/^[0-9a-f]{32}$/);
  });
});
