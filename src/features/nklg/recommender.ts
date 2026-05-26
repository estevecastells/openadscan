/**
 * IO layer for NKLG. Aggregates observations per brand and writes (or updates)
 * recommendation rows.
 */
import { and, eq, gte, sql } from "drizzle-orm";
import type { Bindings } from "@/env";
import { randomId } from "@/lib/crypto";
import { db, schema } from "@/lib/db/client";
import { daysAgo, isoDate } from "@/lib/time";
import { evaluateNKLG, type NKLGObservation } from "./evaluator";
import { DEFAULT_THRESHOLDS } from "./config";

export type CandidateRow = {
  keyword: string;
  country: string;
  organicClicks: number;
  organicImpressions: number;
  avgOrganicPosition: number;
  paidClicks: number;
  paidImpressions: number;
  paidCostMicros: number;
  paidCompetitorDensity: number;
  daysObserved: number;
};

/**
 * Builds NKLG candidate observations for a brand by joining GSC + Ads + SERP
 * snapshot data across the last 28 days.
 */
export async function buildCandidates(
  env: Bindings,
  brandId: string,
  windowDays = 28,
): Promise<CandidateRow[]> {
  const from = daysAgo(windowDays - 1);
  const to = isoDate();

  // GSC aggregated by query × country
  const gscRows = await db(env)
    .select({
      query: schema.gscQueryDaily.query,
      country: schema.gscQueryDaily.country,
      clicks: sql<number>`sum(${schema.gscQueryDaily.clicks})`.as("clicks"),
      impressions: sql<number>`sum(${schema.gscQueryDaily.impressions})`.as("impressions"),
      position: sql<number>`avg(${schema.gscQueryDaily.position})`.as("position"),
      days: sql<number>`count(distinct ${schema.gscQueryDaily.date})`.as("days"),
    })
    .from(schema.gscQueryDaily)
    .where(gte(schema.gscQueryDaily.date, from))
    .groupBy(schema.gscQueryDaily.query, schema.gscQueryDaily.country);

  // Ads aggregated by keyword (we treat the keyword text as the join key)
  const adsRows = await db(env)
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

  // Competitor density per (query, country) over the window: avg # ad rows per snapshot
  const compRows = await db(env)
    .select({
      query: schema.serpSnapshots.query,
      country: schema.serpSnapshots.country,
      density: sql<number>`coalesce(avg(adcount.c), 0)`.as("density"),
      snapshots: sql<number>`count(distinct ${schema.serpSnapshots.id})`.as("snapshots"),
    })
    .from(schema.serpSnapshots)
    .leftJoin(
      sql`(select snapshot_id, count(*) as c from serp_ads group by snapshot_id) as adcount`,
      sql`adcount.snapshot_id = ${schema.serpSnapshots.id}`,
    )
    .where(gte(schema.serpSnapshots.fetchedAt, new Date(`${from}T00:00:00Z`)))
    .groupBy(schema.serpSnapshots.query, schema.serpSnapshots.country);

  const adsIdx = new Map<string, (typeof adsRows)[number]>();
  for (const r of adsRows) adsIdx.set(`${r.keyword.toLowerCase()}|${r.country ?? ""}`, r);
  const compIdx = new Map<string, (typeof compRows)[number]>();
  for (const r of compRows) compIdx.set(`${r.query.toLowerCase()}|${r.country}`, r);

  const candidates: CandidateRow[] = [];
  for (const g of gscRows) {
    const key = `${g.query.toLowerCase()}|${g.country}`;
    const ads = adsIdx.get(key) ?? adsIdx.get(`${g.query.toLowerCase()}|`) ?? null;
    const comp = compIdx.get(key);
    if (!ads || (ads.cost ?? 0) === 0) continue; // only consider terms we're actually paying for
    candidates.push({
      keyword: g.query,
      country: g.country,
      organicClicks: g.clicks ?? 0,
      organicImpressions: g.impressions ?? 0,
      avgOrganicPosition: g.position ?? 0,
      paidClicks: ads.clicks ?? 0,
      paidImpressions: ads.impressions ?? 0,
      paidCostMicros: ads.cost ?? 0,
      paidCompetitorDensity: comp?.density ?? 0,
      daysObserved: Math.min(windowDays, g.days ?? 0),
    });
  }
  return candidates;
}

export async function runNKLGForBrand(
  env: Bindings,
  brandId: string,
  windowDays = 28,
): Promise<number> {
  const candidates = await buildCandidates(env, brandId, windowDays);
  const now = new Date();

  // Pull previously applied recommendations to detect re_enable signals
  const previous = await db(env)
    .select()
    .from(schema.nklgRecommendations)
    .where(and(eq(schema.nklgRecommendations.brandId, brandId), eq(schema.nklgRecommendations.status, "applied")));
  const appliedIdx = new Set(previous.map((p) => `${p.keyword.toLowerCase()}|${p.country}`));

  let written = 0;
  for (const c of candidates) {
    const obs: NKLGObservation = {
      keyword: c.keyword,
      country: c.country,
      daysObserved: c.daysObserved,
      avgOrganicPosition: c.avgOrganicPosition,
      organicClicks: c.organicClicks,
      organicImpressions: c.organicImpressions,
      paidCompetitorDensity: c.paidCompetitorDensity,
      paidCostMicros: c.paidCostMicros,
      paidClicks: c.paidClicks,
      paidImpressions: c.paidImpressions,
      previouslyApplied: appliedIdx.has(`${c.keyword.toLowerCase()}|${c.country}`),
    };
    const result = evaluateNKLG(obs);

    // Upsert pattern: try insert, then update on conflict.
    const existing = await db(env)
      .select({ id: schema.nklgRecommendations.id, status: schema.nklgRecommendations.status })
      .from(schema.nklgRecommendations)
      .where(
        and(
          eq(schema.nklgRecommendations.brandId, brandId),
          eq(schema.nklgRecommendations.keyword, c.keyword),
          eq(schema.nklgRecommendations.country, c.country),
        ),
      )
      .limit(1);

    if (existing.length === 0) {
      await db(env).insert(schema.nklgRecommendations).values({
        id: randomId(),
        brandId,
        keyword: c.keyword,
        country: c.country,
        matchType: "exact",
        decision: result.decision,
        reason: result.reason,
        organicPosition: result.organicPosition,
        organicCtr: result.organicCtr,
        paidCompetitorDensity: result.paidCompetitorDensity,
        paidCostMicros: result.paidCostMicros,
        paidClicks: result.paidClicks,
        savingsOpportunityMicros: result.savingsOpportunityMicros,
        confidence: result.confidence,
        evaluatedAt: now,
        status: "open",
      });
    } else {
      // preserve `applied` status unless re_enable
      const keepStatus = existing[0]!.status === "applied" && result.decision !== "re_enable";
      await db(env)
        .update(schema.nklgRecommendations)
        .set({
          decision: result.decision,
          reason: result.reason,
          organicPosition: result.organicPosition,
          organicCtr: result.organicCtr,
          paidCompetitorDensity: result.paidCompetitorDensity,
          paidCostMicros: result.paidCostMicros,
          paidClicks: result.paidClicks,
          savingsOpportunityMicros: result.savingsOpportunityMicros,
          confidence: result.confidence,
          evaluatedAt: now,
          status: keepStatus ? "applied" : "open",
        })
        .where(eq(schema.nklgRecommendations.id, existing[0]!.id));
    }
    written += 1;
  }
  return written;
}
