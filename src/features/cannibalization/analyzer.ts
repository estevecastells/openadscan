/**
 * Cannibalization analyzer.
 *
 * Joins GSC + Ads daily facts on (query, date, country) and writes a single
 * merged row per (brand, query, day, country) into cannibalization_daily.
 *
 * The downstream UI then derives:
 *   - paid_share, organic_share, combined_clicks
 *   - "redundant paid" candidates where organic position is strong
 *
 * The actual NKLG decision lives in src/features/nklg, but this table is the
 * shared substrate both the dashboard and NKLG draw from.
 */
import { and, eq, gte, sql } from "drizzle-orm";
import type { Bindings } from "@/env";
import { randomId } from "@/lib/crypto";
import { db, schema } from "@/lib/db/client";
import { daysAgo, isoDate } from "@/lib/time";

export type CannibalizationRow = {
  brandId: string;
  query: string;
  date: string;
  country: string;
  paidClicks: number;
  paidImpressions: number;
  paidCostMicros: number;
  organicClicks: number;
  organicImpressions: number;
  organicCtr: number;
  organicPosition: number;
  combinedClicks: number;
};

/** Pure join over already-loaded rows — useful for tests and previews. */
export function joinCannibalization(args: {
  brandId: string;
  gsc: Array<{
    query: string;
    date: string;
    country: string;
    clicks: number;
    impressions: number;
    position: number;
  }>;
  ads: Array<{
    keyword: string;
    date: string;
    country: string | null;
    clicks: number;
    impressions: number;
    costMicros: number;
  }>;
}): CannibalizationRow[] {
  const adsIdx = new Map<string, (typeof args.ads)[number]>();
  for (const a of args.ads) adsIdx.set(`${a.keyword.toLowerCase()}|${a.date}|${a.country ?? ""}`, a);

  const out: CannibalizationRow[] = [];
  const seen = new Set<string>();
  for (const g of args.gsc) {
    const key = `${g.query.toLowerCase()}|${g.date}|${g.country}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const adsForCountry = adsIdx.get(key) ?? adsIdx.get(`${g.query.toLowerCase()}|${g.date}|`);
    out.push({
      brandId: args.brandId,
      query: g.query,
      date: g.date,
      country: g.country,
      paidClicks: adsForCountry?.clicks ?? 0,
      paidImpressions: adsForCountry?.impressions ?? 0,
      paidCostMicros: adsForCountry?.costMicros ?? 0,
      organicClicks: g.clicks,
      organicImpressions: g.impressions,
      organicCtr: g.impressions > 0 ? g.clicks / g.impressions : 0,
      organicPosition: g.position,
      combinedClicks: g.clicks + (adsForCountry?.clicks ?? 0),
    });
  }
  return out;
}

export async function runCannibalizationForBrand(
  env: Bindings,
  brandId: string,
  windowDays = 28,
): Promise<number> {
  const from = daysAgo(windowDays - 1);
  const to = isoDate();

  const gscRows = await db(env)
    .select({
      query: schema.gscQueryDaily.query,
      date: schema.gscQueryDaily.date,
      country: schema.gscQueryDaily.country,
      clicks: sql<number>`sum(${schema.gscQueryDaily.clicks})`.as("clicks"),
      impressions: sql<number>`sum(${schema.gscQueryDaily.impressions})`.as("impressions"),
      position: sql<number>`avg(${schema.gscQueryDaily.position})`.as("position"),
    })
    .from(schema.gscQueryDaily)
    .where(and(gte(schema.gscQueryDaily.date, from)))
    .groupBy(schema.gscQueryDaily.query, schema.gscQueryDaily.date, schema.gscQueryDaily.country);

  const adsRows = await db(env)
    .select({
      keyword: schema.adsKeywordDaily.keyword,
      date: schema.adsKeywordDaily.date,
      country: schema.adsKeywordDaily.country,
      clicks: sql<number>`sum(${schema.adsKeywordDaily.clicks})`.as("clicks"),
      impressions: sql<number>`sum(${schema.adsKeywordDaily.impressions})`.as("impressions"),
      costMicros: sql<number>`sum(${schema.adsKeywordDaily.costMicros})`.as("costMicros"),
    })
    .from(schema.adsKeywordDaily)
    .where(gte(schema.adsKeywordDaily.date, from))
    .groupBy(schema.adsKeywordDaily.keyword, schema.adsKeywordDaily.date, schema.adsKeywordDaily.country);

  const merged = joinCannibalization({
    brandId,
    gsc: gscRows.map((g) => ({
      query: g.query,
      date: g.date,
      country: g.country,
      clicks: g.clicks ?? 0,
      impressions: g.impressions ?? 0,
      position: g.position ?? 0,
    })),
    ads: adsRows.map((a) => ({
      keyword: a.keyword,
      date: a.date,
      country: a.country,
      clicks: a.clicks ?? 0,
      impressions: a.impressions ?? 0,
      costMicros: a.costMicros ?? 0,
    })),
  });

  // Wipe + reinsert for the window: simpler than per-row upsert at SQLite scale
  for (const m of merged) {
    await db(env)
      .delete(schema.cannibalizationDaily)
      .where(
        and(
          eq(schema.cannibalizationDaily.brandId, m.brandId),
          eq(schema.cannibalizationDaily.query, m.query),
          eq(schema.cannibalizationDaily.date, m.date),
          eq(schema.cannibalizationDaily.country, m.country),
        ),
      );
  }
  if (merged.length > 0) {
    for (let i = 0; i < merged.length; i += 250) {
      const slice = merged.slice(i, i + 250);
      await db(env).insert(schema.cannibalizationDaily).values(
        slice.map((m) => ({
          id: randomId(),
          brandId: m.brandId,
          query: m.query,
          page: null,
          date: m.date,
          country: m.country,
          paidClicks: m.paidClicks,
          paidImpressions: m.paidImpressions,
          paidCostMicros: m.paidCostMicros,
          organicClicks: m.organicClicks,
          organicImpressions: m.organicImpressions,
          organicCtr: m.organicCtr,
          organicPosition: m.organicPosition,
          combinedClicks: m.combinedClicks,
        })),
      );
    }
  }
  return merged.length;
}
