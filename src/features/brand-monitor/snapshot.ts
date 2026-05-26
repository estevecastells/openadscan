import { and, eq } from "drizzle-orm";
import type { Bindings } from "@/env";
import { randomId } from "@/lib/crypto";
import { db, schema } from "@/lib/db/client";
import { isoDate } from "@/lib/time";
import { analyzeSerpAgainstBrand, normalizeDomain } from "./analyzer";

/**
 * Convert a fresh SERP snapshot into the daily brand monitor row, joining the
 * brand domain from `brands` and auto-registering any unknown competitor
 * domains so they show up in the Competitor Intel module.
 */
export async function snapshotBrandMonitor(
  env: Bindings,
  brandTermId: string,
  snapshotId: string,
): Promise<void> {
  const [term] = await db(env)
    .select()
    .from(schema.brandTerms)
    .where(eq(schema.brandTerms.id, brandTermId))
    .limit(1);
  if (!term) return;
  const [brand] = await db(env).select().from(schema.brands).where(eq(schema.brands.id, term.brandId)).limit(1);
  if (!brand) return;
  const ads = await db(env).select().from(schema.serpAds).where(eq(schema.serpAds.snapshotId, snapshotId));
  const organic = await db(env)
    .select()
    .from(schema.serpOrganic)
    .where(eq(schema.serpOrganic.snapshotId, snapshotId));

  const facts = analyzeSerpAgainstBrand({
    ourDomain: brand.domain,
    ads: ads.map((a) => ({
      position: a.position,
      domain: a.advertiserDomain,
      title: a.title ?? undefined,
      description: a.description ?? undefined,
      displayUrl: a.displayUrl ?? undefined,
      url: a.url ?? undefined,
    })),
    organic: organic.map((o) => ({
      position: o.position,
      domain: o.domain,
      url: o.url ?? undefined,
      title: o.title ?? undefined,
    })),
  });

  // Upsert daily row
  const date = isoDate();
  await db(env)
    .delete(schema.brandMonitorDaily)
    .where(
      and(
        eq(schema.brandMonitorDaily.brandId, brand.id),
        eq(schema.brandMonitorDaily.term, term.term),
        eq(schema.brandMonitorDaily.date, date),
        eq(schema.brandMonitorDaily.country, term.country),
      ),
    );
  await db(env).insert(schema.brandMonitorDaily).values({
    id: randomId(),
    brandId: brand.id,
    brandTermId: term.id,
    term: term.term,
    date,
    country: term.country,
    ourTopAdPos: facts.ourTopAdPos,
    competitorCount: facts.competitorCount,
    topCompetitorDomain: facts.topCompetitorDomain,
    ourOrganicTop3: facts.ourOrganicTop3,
    sovPaid: facts.sovPaid,
    sovOrganic: facts.sovOrganic,
  });

  // Auto-register competitors
  const competitors = new Set<string>();
  for (const a of ads) {
    const d = normalizeDomain(a.advertiserDomain);
    if (!d) continue;
    if (d === normalizeDomain(brand.domain)) continue;
    competitors.add(d);
  }
  for (const dom of competitors) {
    const existing = await db(env)
      .select({ id: schema.competitors.id })
      .from(schema.competitors)
      .where(and(eq(schema.competitors.brandId, brand.id), eq(schema.competitors.domain, dom)))
      .limit(1);
    if (existing.length === 0) {
      await db(env).insert(schema.competitors).values({
        id: randomId(),
        brandId: brand.id,
        domain: dom,
        isKnown: false,
      });
    }
  }
}
