/**
 * Pull keyword performance + search-term + paid/organic for a given date range
 * and persist into D1. Idempotent — re-running for the same date overwrites.
 */
import { and, eq } from "drizzle-orm";
import type { Bindings } from "@/env";
import { db, schema } from "@/lib/db/client";
import { randomId } from "@/lib/crypto";
import { gaqlSearch, listAccessibleCustomers } from "./client";
import { keywordPerformanceGAQL, paidOrganicGAQL, searchTermGAQL } from "./queries";
import type { GoogleAdsConfig } from "./types";

function micros(v: unknown): number {
  if (typeof v === "string") return Number.parseInt(v, 10) || 0;
  if (typeof v === "number") return v;
  return 0;
}

function num(v: unknown): number {
  if (typeof v === "string") return Number.parseInt(v, 10) || 0;
  if (typeof v === "number") return v;
  return 0;
}

function matchType(raw: unknown): "exact" | "phrase" | "broad" {
  const s = String(raw ?? "").toLowerCase();
  if (s.includes("exact")) return "exact";
  if (s.includes("phrase")) return "phrase";
  return "broad";
}

export async function ensureAccountsForConnection(env: Bindings, connectionId: string): Promise<string[]> {
  const customers = await listAccessibleCustomers(env, connectionId);
  for (const customerId of customers) {
    const existing = await db(env)
      .select({ id: schema.adsAccounts.id })
      .from(schema.adsAccounts)
      .where(and(eq(schema.adsAccounts.connectionId, connectionId), eq(schema.adsAccounts.customerId, customerId)))
      .limit(1);
    if (existing.length === 0) {
      await db(env).insert(schema.adsAccounts).values({
        id: randomId(),
        connectionId,
        customerId,
      });
    }
  }
  return customers;
}

export async function ingestKeywordPerformance(args: {
  env: Bindings;
  connectionId: string;
  dateFrom: string;
  dateTo: string;
}): Promise<number> {
  const [conn] = await db(args.env).select().from(schema.connections).where(eq(schema.connections.id, args.connectionId)).limit(1);
  if (!conn) throw new Error("connection not found");
  const config = JSON.parse(conn.configJson) as GoogleAdsConfig;
  const account = await db(args.env)
    .select()
    .from(schema.adsAccounts)
    .where(eq(schema.adsAccounts.connectionId, args.connectionId))
    .limit(1);
  if (account.length === 0) await ensureAccountsForConnection(args.env, args.connectionId);
  const accounts = await db(args.env)
    .select()
    .from(schema.adsAccounts)
    .where(eq(schema.adsAccounts.connectionId, args.connectionId));

  let rowsWritten = 0;
  for (const acc of accounts) {
    const results = await gaqlSearch({
      env: args.env,
      connectionId: args.connectionId,
      config: { ...config, customerId: acc.customerId },
      query: keywordPerformanceGAQL(args.dateFrom, args.dateTo),
    });
    const inserts = (results ?? []).map((r) => ({
      id: randomId(),
      accountId: acc.id,
      campaignId: String(r.campaign?.id ?? ""),
      campaignName: r.campaign?.name ?? null,
      adGroupId: String(r.adGroup?.id ?? ""),
      adGroupName: r.adGroup?.name ?? null,
      keyword: String(r.adGroupCriterion?.keyword?.text ?? ""),
      matchType: matchType(r.adGroupCriterion?.keyword?.matchType),
      date: String(r.segments?.date ?? args.dateTo),
      country: null as string | null,
      clicks: num(r.metrics?.clicks),
      impressions: num(r.metrics?.impressions),
      costMicros: micros(r.metrics?.costMicros),
      conversions: r.metrics?.conversions ?? 0,
      conversionsValue: r.metrics?.conversionsValue ?? 0,
    }));
    if (inserts.length === 0) continue;
    // chunked insert
    for (let i = 0; i < inserts.length; i += 250) {
      const slice = inserts.slice(i, i + 250);
      await db(args.env).insert(schema.adsKeywordDaily).values(slice);
      rowsWritten += slice.length;
    }
  }
  return rowsWritten;
}

export async function ingestSearchTerms(args: {
  env: Bindings;
  connectionId: string;
  dateFrom: string;
  dateTo: string;
}): Promise<number> {
  const [conn] = await db(args.env).select().from(schema.connections).where(eq(schema.connections.id, args.connectionId)).limit(1);
  if (!conn) throw new Error("connection not found");
  const config = JSON.parse(conn.configJson) as GoogleAdsConfig;
  const accounts = await db(args.env)
    .select()
    .from(schema.adsAccounts)
    .where(eq(schema.adsAccounts.connectionId, args.connectionId));
  let written = 0;
  for (const acc of accounts) {
    const results = await gaqlSearch({
      env: args.env,
      connectionId: args.connectionId,
      config: { ...config, customerId: acc.customerId },
      query: searchTermGAQL(args.dateFrom, args.dateTo),
    });
    const rows = (results ?? []).map((r) => ({
      id: randomId(),
      accountId: acc.id,
      keyword: String((r as Record<string, unknown>).segments && ((r as Record<string, unknown>).segments as Record<string, unknown>).keyword
        ? ((((r as Record<string, unknown>).segments as Record<string, unknown>).keyword as Record<string, unknown>).info as Record<string, unknown>)?.text ?? ""
        : ""),
      searchTerm: String((r as Record<string, unknown>).searchTermView
        ? ((r as Record<string, unknown>).searchTermView as Record<string, unknown>).searchTerm ?? ""
        : ""),
      matchType: matchType(((((r as Record<string, unknown>).segments as Record<string, unknown> | undefined)?.keyword as Record<string, unknown> | undefined)?.info as Record<string, unknown> | undefined)?.matchType),
      date: String(r.segments?.date ?? args.dateTo),
      country: null,
      clicks: num(r.metrics?.clicks),
      impressions: num(r.metrics?.impressions),
      costMicros: micros(r.metrics?.costMicros),
      conversions: r.metrics?.conversions ?? 0,
    }));
    if (rows.length === 0) continue;
    for (let i = 0; i < rows.length; i += 250) {
      const slice = rows.slice(i, i + 250);
      await db(args.env).insert(schema.adsSearchTermDaily).values(slice);
      written += slice.length;
    }
  }
  return written;
}

export async function ingestPaidOrganic(args: {
  env: Bindings;
  connectionId: string;
  dateFrom: string;
  dateTo: string;
}): Promise<unknown[]> {
  // Returns raw rows; cannibalization analyzer consumes them directly.
  const [conn] = await db(args.env).select().from(schema.connections).where(eq(schema.connections.id, args.connectionId)).limit(1);
  if (!conn) throw new Error("connection not found");
  const config = JSON.parse(conn.configJson) as GoogleAdsConfig;
  const accounts = await db(args.env)
    .select()
    .from(schema.adsAccounts)
    .where(eq(schema.adsAccounts.connectionId, args.connectionId));
  const out: unknown[] = [];
  for (const acc of accounts) {
    const results = await gaqlSearch({
      env: args.env,
      connectionId: args.connectionId,
      config: { ...config, customerId: acc.customerId },
      query: paidOrganicGAQL(args.dateFrom, args.dateTo),
    });
    if (results) out.push(...results);
  }
  return out;
}
