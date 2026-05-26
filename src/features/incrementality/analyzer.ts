/**
 * Incrementality analyzer.
 *
 * Implements the framework from the SEO vs SEM deck:
 *   - For each query split days into paid_on / paid_off
 *   - ctr_with_sem    = organic CTR on paid_on days
 *   - ctr_without_sem = organic CTR on paid_off days
 *   - incremental_ctr = ctr_with_sem - ctr_without_sem
 *   - incremental_clicks = paid_clicks - paid_impressions × max(0, ctr_without_sem)
 *   - cost_per_incremental_click = paid_cost / incremental_clicks
 *
 * Pure logic + DB writer are split so unit tests can exercise the math without
 * a database.
 */
import { and, eq, gte } from "drizzle-orm";
import type { Bindings } from "@/env";
import { randomId } from "@/lib/crypto";
import { db, schema } from "@/lib/db/client";
import { daysAgo, isoDate } from "@/lib/time";

export type IncrementalityInputDay = {
  date: string;
  paidClicks: number;
  paidImpressions: number;
  paidCostMicros: number;
  organicClicks: number;
  organicImpressions: number;
};

export type IncrementalityResult = {
  daysPaidOn: number;
  daysPaidOff: number;
  ctrWithSem: number;
  ctrWithoutSem: number;
  incrementalCtr: number;
  paidClicks: number;
  paidImpressions: number;
  paidCostMicros: number;
  incrementalClicks: number;
  costPerIncrementalClick: number;
  sampleConfidence: number;
};

export function computeIncrementality(days: IncrementalityInputDay[]): IncrementalityResult {
  let on = 0;
  let off = 0;
  let onClicks = 0;
  let onImps = 0;
  let offClicks = 0;
  let offImps = 0;
  let paidClicks = 0;
  let paidImps = 0;
  let paidCost = 0;
  for (const d of days) {
    paidClicks += d.paidClicks;
    paidImps += d.paidImpressions;
    paidCost += d.paidCostMicros;
    if (d.paidImpressions > 0) {
      on += 1;
      onClicks += d.organicClicks;
      onImps += d.organicImpressions;
    } else {
      off += 1;
      offClicks += d.organicClicks;
      offImps += d.organicImpressions;
    }
  }
  const ctrWith = onImps > 0 ? onClicks / onImps : 0;
  const ctrWithout = offImps > 0 ? offClicks / offImps : 0;
  const incrementalCtr = ctrWith - ctrWithout;
  const counterfactualOrganic = paidImps * Math.max(0, ctrWithout);
  const incrementalClicks = Math.max(0, paidClicks - counterfactualOrganic);
  const costPerInc = incrementalClicks > 0 ? paidCost / 1_000_000 / incrementalClicks : 0;
  // Crude confidence: scale by min(on, off) sample size, plateau at 14 of each
  const sampleConfidence = Math.min(1, Math.min(on, off) / 14);
  return {
    daysPaidOn: on,
    daysPaidOff: off,
    ctrWithSem: ctrWith,
    ctrWithoutSem: ctrWithout,
    incrementalCtr,
    paidClicks,
    paidImpressions: paidImps,
    paidCostMicros: paidCost,
    incrementalClicks,
    costPerIncrementalClick: costPerInc,
    sampleConfidence,
  };
}

export async function runIncrementalityForBrand(
  env: Bindings,
  brandId: string,
  windowDays = 56,
): Promise<number> {
  const from = daysAgo(windowDays - 1);
  const to = isoDate();

  // Build per-(query, country, date) aggregates joining GSC and Ads.
  const gscRows = await db(env)
    .select()
    .from(schema.gscQueryDaily)
    .where(gte(schema.gscQueryDaily.date, from));

  const adsRows = await db(env)
    .select()
    .from(schema.adsKeywordDaily)
    .where(gte(schema.adsKeywordDaily.date, from));

  type Bucket = { query: string; country: string; days: Map<string, IncrementalityInputDay> };
  const buckets = new Map<string, Bucket>();

  for (const g of gscRows) {
    const key = `${g.query.toLowerCase()}|${g.country}`;
    let b = buckets.get(key);
    if (!b) {
      b = { query: g.query, country: g.country, days: new Map() };
      buckets.set(key, b);
    }
    let day = b.days.get(g.date);
    if (!day) {
      day = {
        date: g.date,
        paidClicks: 0,
        paidImpressions: 0,
        paidCostMicros: 0,
        organicClicks: 0,
        organicImpressions: 0,
      };
      b.days.set(g.date, day);
    }
    day.organicClicks += g.clicks;
    day.organicImpressions += g.impressions;
  }
  for (const a of adsRows) {
    if (!a.country) continue;
    const key = `${a.keyword.toLowerCase()}|${a.country}`;
    const b = buckets.get(key);
    if (!b) continue;
    let day = b.days.get(a.date);
    if (!day) {
      day = {
        date: a.date,
        paidClicks: 0,
        paidImpressions: 0,
        paidCostMicros: 0,
        organicClicks: 0,
        organicImpressions: 0,
      };
      b.days.set(a.date, day);
    }
    day.paidClicks += a.clicks;
    day.paidImpressions += a.impressions;
    day.paidCostMicros += a.costMicros;
  }

  let written = 0;
  for (const b of buckets.values()) {
    const days = Array.from(b.days.values());
    if (days.length < 7) continue;
    const r = computeIncrementality(days);
    if (r.daysPaidOn === 0 || r.daysPaidOff === 0) continue; // need both halves
    await db(env)
      .delete(schema.incrementalityMetrics)
      .where(
        and(
          eq(schema.incrementalityMetrics.brandId, brandId),
          eq(schema.incrementalityMetrics.query, b.query),
          eq(schema.incrementalityMetrics.country, b.country),
          eq(schema.incrementalityMetrics.windowStart, from),
          eq(schema.incrementalityMetrics.windowEnd, to),
        ),
      );
    await db(env).insert(schema.incrementalityMetrics).values({
      id: randomId(),
      brandId,
      query: b.query,
      country: b.country,
      windowStart: from,
      windowEnd: to,
      daysPaidOn: r.daysPaidOn,
      daysPaidOff: r.daysPaidOff,
      ctrWithSem: r.ctrWithSem,
      ctrWithoutSem: r.ctrWithoutSem,
      incrementalCtr: r.incrementalCtr,
      paidClicks: r.paidClicks,
      paidImpressions: r.paidImpressions,
      paidCostMicros: r.paidCostMicros,
      incrementalClicks: r.incrementalClicks,
      costPerIncrementalClick: r.costPerIncrementalClick,
      sampleConfidence: r.sampleConfidence,
    });
    written += 1;
  }
  return written;
}
