/**
 * Google Ads OAuth 2.0 web flow.
 *
 * Shared with the Search Console connector (same Google identity, different scopes).
 * We keep separate functions to make scope intent explicit at call sites.
 */
import type { Bindings } from "@/env";
import { fetchWithRetry } from "@/lib/http";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";

export const GOOGLE_ADS_SCOPES = ["https://www.googleapis.com/auth/adwords"];
export const GSC_SCOPES = ["https://www.googleapis.com/auth/webmasters.readonly"];

export function buildAuthUrl(args: {
  env: Bindings;
  redirectUri: string;
  state: string;
  scopes: string[];
}): string {
  const params = new URLSearchParams({
    client_id: args.env.GOOGLE_OAUTH_CLIENT_ID,
    redirect_uri: args.redirectUri,
    response_type: "code",
    access_type: "offline",
    include_granted_scopes: "true",
    prompt: "consent",
    scope: args.scopes.join(" "),
    state: args.state,
  });
  return `${AUTH_URL}?${params.toString()}`;
}

export async function exchangeCode(args: {
  env: Bindings;
  code: string;
  redirectUri: string;
}): Promise<{ access_token: string; refresh_token: string; expires_in: number; scope: string }> {
  const res = await fetchWithRetry(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: args.env.GOOGLE_OAUTH_CLIENT_ID,
      client_secret: args.env.GOOGLE_OAUTH_CLIENT_SECRET,
      code: args.code,
      grant_type: "authorization_code",
      redirect_uri: args.redirectUri,
    }).toString(),
  });
  if (!res.ok) throw new Error(`Google OAuth code exchange failed: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function refreshAccessToken(args: {
  env: Bindings;
  refreshToken: string;
}): Promise<{ access_token: string; expires_in: number }> {
  const res = await fetchWithRetry(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: args.env.GOOGLE_OAUTH_CLIENT_ID,
      client_secret: args.env.GOOGLE_OAUTH_CLIENT_SECRET,
      refresh_token: args.refreshToken,
      grant_type: "refresh_token",
    }).toString(),
  });
  if (!res.ok) throw new Error(`Google OAuth refresh failed: ${res.status} ${await res.text()}`);
  return res.json();
}
