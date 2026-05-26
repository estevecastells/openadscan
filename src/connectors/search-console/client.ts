import { eq } from "drizzle-orm";
import type { Bindings } from "@/env";
import { decryptString, encryptString } from "@/lib/crypto";
import { db, schema } from "@/lib/db/client";
import { fetchWithRetry } from "@/lib/http";
import { refreshAccessToken } from "./oauth";
import type { GscSearchAnalyticsResponse, GscSitesListResponse } from "./types";

const BASE = "https://www.googleapis.com/webmasters/v3";

async function getAccessToken(env: Bindings, connectionId: string): Promise<string> {
  const [row] = await db(env).select().from(schema.connections).where(eq(schema.connections.id, connectionId)).limit(1);
  if (!row?.oauthRefreshTokenEnc || !row.oauthAccessTokenEnc) throw new Error("not authorized");
  if (row.expiresAt && row.expiresAt.getTime() - 60_000 > Date.now()) {
    return decryptString(row.oauthAccessTokenEnc, env.ENCRYPTION_KEY);
  }
  const refreshed = await refreshAccessToken({
    env,
    refreshToken: await decryptString(row.oauthRefreshTokenEnc, env.ENCRYPTION_KEY),
  });
  await db(env)
    .update(schema.connections)
    .set({
      oauthAccessTokenEnc: await encryptString(refreshed.access_token, env.ENCRYPTION_KEY),
      expiresAt: new Date(Date.now() + refreshed.expires_in * 1000),
    })
    .where(eq(schema.connections.id, connectionId));
  return refreshed.access_token;
}

export async function listSites(env: Bindings, connectionId: string): Promise<string[]> {
  const token = await getAccessToken(env, connectionId);
  const res = await fetchWithRetry(`${BASE}/sites`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`gsc listSites ${res.status}: ${await res.text()}`);
  const body = (await res.json()) as GscSitesListResponse;
  return (body.siteEntry ?? []).map((e) => e.siteUrl);
}

export async function searchAnalyticsQuery(args: {
  env: Bindings;
  connectionId: string;
  siteUrl: string;
  date: string;
  rowLimit?: number;
}): Promise<NonNullable<GscSearchAnalyticsResponse["rows"]>> {
  const token = await getAccessToken(args.env, args.connectionId);
  const url = `${BASE}/sites/${encodeURIComponent(args.siteUrl)}/searchAnalytics/query`;
  const out: NonNullable<GscSearchAnalyticsResponse["rows"]> = [];
  const pageSize = args.rowLimit ?? 25_000;
  let startRow = 0;
  while (true) {
    const res = await fetchWithRetry(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        startDate: args.date,
        endDate: args.date,
        dimensions: ["query", "page", "country", "device"],
        rowLimit: pageSize,
        startRow,
        dataState: "all",
      }),
    });
    if (!res.ok) throw new Error(`gsc searchAnalytics ${res.status}: ${await res.text()}`);
    const body = (await res.json()) as GscSearchAnalyticsResponse;
    if (!body.rows || body.rows.length === 0) break;
    out.push(...body.rows);
    if (body.rows.length < pageSize) break;
    startRow += body.rows.length;
  }
  return out;
}
