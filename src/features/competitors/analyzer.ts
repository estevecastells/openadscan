import { and, eq, gte, sql } from "drizzle-orm";
import type { Bindings } from "@/env";
import { db, schema } from "@/lib/db/client";
import { daysAgo } from "@/lib/time";

/**
 * Returns a leaderboard of competitor domains seen in SERP ads for a brand
 * over the trailing window, with appearance count and avg position.
 */
export async function competitorLeaderboard(
  env: Bindings,
  brandId: string,
  windowDays = 14,
): Promise<Array<{ domain: string; appearances: number; avgPosition: number; lastSeen: string }>> {
  const from = daysAgo(windowDays - 1);
  // Join SERP ads with snapshots filtered by brand-terms of this brand
  const rows = await db(env)
    .select({
      domain: schema.serpAds.advertiserDomain,
      appearances: sql<number>`count(*)`.as("appearances"),
      avgPos: sql<number>`avg(${schema.serpAds.position})`.as("avgPos"),
      lastSeen: sql<number>`max(${schema.serpSnapshots.fetchedAt})`.as("lastSeen"),
    })
    .from(schema.serpAds)
    .innerJoin(schema.serpSnapshots, eq(schema.serpAds.snapshotId, schema.serpSnapshots.id))
    .innerJoin(schema.brandTerms, eq(schema.serpSnapshots.brandTermId, schema.brandTerms.id))
    .where(
      and(
        eq(schema.brandTerms.brandId, brandId),
        gte(schema.serpSnapshots.fetchedAt, new Date(`${from}T00:00:00Z`)),
      ),
    )
    .groupBy(schema.serpAds.advertiserDomain);
  return rows
    .map((r) => ({
      domain: r.domain,
      appearances: r.appearances ?? 0,
      avgPosition: r.avgPos ?? 0,
      lastSeen: new Date(r.lastSeen ?? 0).toISOString(),
    }))
    .sort((a, b) => b.appearances - a.appearances);
}
