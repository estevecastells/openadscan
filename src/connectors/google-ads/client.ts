/**
 * Thin Google Ads REST client. Handles:
 *   - access token refresh
 *   - login-customer-id header (for manager accounts)
 *   - GAQL search with pagination
 */
import { eq } from "drizzle-orm";
import type { Bindings } from "@/env";
import { decryptString, encryptString } from "@/lib/crypto";
import { db, schema } from "@/lib/db/client";
import { fetchWithRetry } from "@/lib/http";
import { refreshAccessToken } from "./oauth";
import type {
  AccessibleCustomersResponse,
  GoogleAdsConfig,
  GoogleAdsSearchResponse,
} from "./types";

const API_VERSION = "v17";
const BASE = `https://googleads.googleapis.com/${API_VERSION}`;

async function getAccessToken(env: Bindings, connectionId: string): Promise<string> {
  const [row] = await db(env)
    .select()
    .from(schema.connections)
    .where(eq(schema.connections.id, connectionId))
    .limit(1);
  if (!row) throw new Error(`connection ${connectionId} not found`);
  if (!row.oauthRefreshTokenEnc || !row.oauthAccessTokenEnc) {
    throw new Error(`connection ${connectionId} not authorized`);
  }
  const now = Date.now();
  if (row.expiresAt && row.expiresAt.getTime() - 60_000 > now) {
    return decryptString(row.oauthAccessTokenEnc, env.ENCRYPTION_KEY);
  }
  const refreshToken = await decryptString(row.oauthRefreshTokenEnc, env.ENCRYPTION_KEY);
  const refreshed = await refreshAccessToken({ env, refreshToken });
  const newAccess = await encryptString(refreshed.access_token, env.ENCRYPTION_KEY);
  await db(env)
    .update(schema.connections)
    .set({
      oauthAccessTokenEnc: newAccess,
      expiresAt: new Date(Date.now() + refreshed.expires_in * 1000),
    })
    .where(eq(schema.connections.id, connectionId));
  return refreshed.access_token;
}

export async function listAccessibleCustomers(env: Bindings, connectionId: string): Promise<string[]> {
  const token = await getAccessToken(env, connectionId);
  const res = await fetchWithRetry(`${BASE}/customers:listAccessibleCustomers`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "developer-token": env.GOOGLE_ADS_DEVELOPER_TOKEN,
    },
  });
  if (!res.ok) throw new Error(`listAccessibleCustomers ${res.status}: ${await res.text()}`);
  const body = (await res.json()) as AccessibleCustomersResponse;
  // resourceNames look like "customers/1234567890"
  return (body.resourceNames ?? []).map((r) => r.split("/").pop()!).filter(Boolean);
}

export async function gaqlSearch(args: {
  env: Bindings;
  connectionId: string;
  config: GoogleAdsConfig;
  query: string;
  pageSize?: number;
}): Promise<GoogleAdsSearchResponse["results"]> {
  const token = await getAccessToken(args.env, args.connectionId);
  const customerId = args.config.customerId.replace(/-/g, "");
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "developer-token": args.env.GOOGLE_ADS_DEVELOPER_TOKEN,
    "content-type": "application/json",
  };
  if (args.config.loginCustomerId) {
    headers["login-customer-id"] = args.config.loginCustomerId.replace(/-/g, "");
  }
  const url = `${BASE}/customers/${customerId}/googleAds:search`;
  const out: GoogleAdsSearchResponse["results"] = [];
  let pageToken: string | undefined;
  do {
    const res = await fetchWithRetry(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        query: args.query,
        pageSize: args.pageSize ?? 1000,
        pageToken,
      }),
    });
    if (!res.ok) throw new Error(`gaqlSearch ${res.status}: ${await res.text()}`);
    const body = (await res.json()) as GoogleAdsSearchResponse;
    if (body.results) out.push(...body.results);
    pageToken = body.nextPageToken;
  } while (pageToken);
  return out;
}
