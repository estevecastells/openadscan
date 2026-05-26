import { and, eq, gte, sql } from "drizzle-orm";
import type { Bindings } from "@/env";
import { db, schema } from "@/lib/db/client";
import { daysAgo } from "@/lib/time";

export type RankedKeyword = {
  keyword: string;
  country: string;
  organicClicks: number;
  organicImpressions: number;
  organicCtr: number;
  organicPosition: number;
  paidClicks: number;
  paidImpressions: number;
  paidCostMicros: number;
  paidCpcMicros: number;
  opportunityScore: number;
};

/**
 * Opportunity score (0..1):
 *   - rewards high organic impressions
 *   - rewards low organic position (already ranking well)
 *   - rewards high paid spend (indicates we believe in the term)
 *   - penalises low CTR
 * Simple linear blend so behaviour is auditable.
 */
function opportunityScore(args: {
  organicImpressions: number;
  organicPosition: number;
  organicCtr: number;
  paidCostMicros: number;
}): number {
  const impScore = Math.min(1, Math.log10(1 + args.organicImpressions) / 4);
  const posScore = args.organicPosition > 0 ? Math.max(0, 1 - (args.organicPosition - 1) / 10) : 0;
  const ctrScore = Math.min(1, args.organicCtr * 4);
  const spendScore = Math.min(1, Math.log10(1 + args.paidCostMicros / 1_000_000) / 3);
  return Number((impScore * 0.3 + posScore * 0.3 + ctrScore * 0.2 + spendScore * 0.2).toFixed(4));
}

export async function rankKeywords(env: Bindings, brandId: string, windowDays = 28): Promise<RankedKeyword[]> {
  const from = daysAgo(windowDays - 1);
  const gsc = await db(env)
    .select({
      query: schema.gscQueryDaily.query,
      country: schema.gscQueryDaily.country,
      clicks: sql<number>`sum(${schema.gscQueryDaily.clicks})`.as("clicks"),
      impressions: sql<number>`sum(${schema.gscQueryDaily.impressions})`.as("impressions"),
      position: sql<number>`avg(${schema.gscQueryDaily.position})`.as("position"),
    })
    .from(schema.gscQueryDaily)
    .where(gte(schema.gscQueryDaily.date, from))
    .groupBy(schema.gscQueryDaily.query, schema.gscQueryDaily.country);
  const ads = await db(env)
    .select({
      keyword: schema.adsKeywordDaily.keyword,
      country: schema.adsKeywordDaily.country,
      clicks: sql<number>`sum(${schema.adsKeywordDaily.clicks})`.as("clicks"),
      impressions: sql<number>`sum(${schema.adsKeywordDaily.impressions})`.as("impressions"),
      cost: sql<number>`sum(${schema.adsKeywordDaily.costMicros})`.as("cost"),
    })
    .from(schema.adsKeywordDaily)
    .where(gte(schema.adsKeywordDaily.date, from))
    .groupBy(schema.adsKeywordDaily.keyword, schema.adsKeywordDaily.country);

  const adsIdx = new Map<string, (typeof ads)[number]>();
  for (const a of ads) adsIdx.set(`${a.keyword.toLowerCase()}|${a.country ?? ""}`, a);

  return gsc
    .map((g) => {
      const a = adsIdx.get(`${g.query.toLowerCase()}|${g.country}`) ?? adsIdx.get(`${g.query.toLowerCase()}|`);
      const ctr = g.impressions > 0 ? g.clicks / g.impressions : 0;
      return {
        keyword: g.query,
        country: g.country,
        organicClicks: g.clicks ?? 0,
        organicImpressions: g.impressions ?? 0,
        organicCtr: ctr,
        organicPosition: g.position ?? 0,
        paidClicks: a?.clicks ?? 0,
        paidImpressions: a?.impressions ?? 0,
        paidCostMicros: a?.cost ?? 0,
        paidCpcMicros: a && a.clicks > 0 ? a.cost / a.clicks : 0,
        opportunityScore: opportunityScore({
          organicImpressions: g.impressions ?? 0,
          organicPosition: g.position ?? 0,
          organicCtr: ctr,
          paidCostMicros: a?.cost ?? 0,
        }),
      };
    })
    .sort((a, b) => b.opportunityScore - a.opportunityScore);
}
