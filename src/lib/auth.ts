import { eq } from "drizzle-orm";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import type { Context, MiddlewareHandler } from "hono";
import type { AppEnv } from "@/env";
import { db, schema } from "@/lib/db/client";
import { hmacSign, hmacVerify, randomId } from "@/lib/crypto";

const COOKIE_NAME = "oas_session";
const SESSION_TTL_MS = 14 * 24 * 60 * 60 * 1000;

type SessionPayload = { sid: string; uid: string; exp: number };

function b64u(s: string): string {
  return btoa(s).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function b64uDecode(s: string): string {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
}

async function sign(payload: SessionPayload, secret: string): Promise<string> {
  const body = b64u(JSON.stringify(payload));
  const sig = await hmacSign(body, secret);
  return `${body}.${sig}`;
}

async function verify(token: string, secret: string): Promise<SessionPayload | null> {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  if (!(await hmacVerify(body, sig, secret))) return null;
  try {
    const payload = JSON.parse(b64uDecode(body)) as SessionPayload;
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function startSession(c: Context<AppEnv>, userId: string): Promise<void> {
  const sid = randomId(24);
  const exp = Date.now() + SESSION_TTL_MS;
  await db(c.env).insert(schema.sessions).values({ id: sid, userId, expiresAt: new Date(exp) });
  const token = await sign({ sid, uid: userId, exp }, c.env.SESSION_SECRET);
  setCookie(c, COOKIE_NAME, token, {
    httpOnly: true,
    secure: c.env.NODE_ENV === "production",
    sameSite: "Lax",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export async function endSession(c: Context<AppEnv>): Promise<void> {
  const token = getCookie(c, COOKIE_NAME);
  if (token) {
    const payload = await verify(token, c.env.SESSION_SECRET);
    if (payload) await db(c.env).delete(schema.sessions).where(eq(schema.sessions.id, payload.sid));
  }
  deleteCookie(c, COOKIE_NAME, { path: "/" });
}

export async function getCurrentUser(c: Context<AppEnv>): Promise<{ id: string; email: string } | null> {
  const token = getCookie(c, COOKIE_NAME);
  if (!token) return null;
  const payload = await verify(token, c.env.SESSION_SECRET);
  if (!payload) return null;
  const rows = await db(c.env)
    .select({ id: schema.adminUser.id, email: schema.adminUser.email })
    .from(schema.adminUser)
    .where(eq(schema.adminUser.id, payload.uid))
    .limit(1);
  return rows[0] ?? null;
}

const PUBLIC_PATHS = [
  "/login",
  "/setup",
  "/healthz",
  "/api/connectors/google-ads/oauth-callback",
  "/api/connectors/search-console/oauth-callback",
  "/static/",
];

function isPublic(path: string): boolean {
  return PUBLIC_PATHS.some((p) => (p.endsWith("/") ? path.startsWith(p) : path === p));
}

/** Middleware that enforces auth. Redirects to /login if no session and route is private. */
export const requireAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (isPublic(new URL(c.req.url).pathname)) {
    return next();
  }
  // If no admin user exists yet, force /setup
  const admin = await db(c.env).select({ id: schema.adminUser.id }).from(schema.adminUser).limit(1);
  if (admin.length === 0 && !c.req.path.startsWith("/setup")) {
    return c.redirect("/setup");
  }
  const user = await getCurrentUser(c);
  if (!user) return c.redirect(`/login?next=${encodeURIComponent(c.req.path)}`);
  c.set("user", user);
  return next();
};
