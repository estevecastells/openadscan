import { eq } from "drizzle-orm";
import type { Bindings } from "@/env";
import { randomId } from "@/lib/crypto";
import { db, schema } from "@/lib/db/client";
import { fetchSerp } from "./serp";
import type { DataForSeoConfig } from "./types";

/**
 * Fetch and persist a fresh SERP snapshot for a brand term.
 * Returns the snapshot id and ad/organic counts.
 */
export async function persistSerpForBrandTerm(args: {
  env: Bindings;
  brandTermId: string;
  device?: "desktop" | "mobile";
}): Promise<{ snapshotId: string; ads: number; organic: number; cost: number }> {
  const [term] = await db(args.env)
    .select()
    .from(schema.brandTerms)
    .where(eq(schema.brandTerms.id, args.brandTermId))
    .limit(1);
  if (!term) throw new Error(`brand term ${args.brandTermId} not found`);

  const [dfsConn] = await db(args.env)
    .select()
    .from(schema.connections)
    .where(eq(schema.connections.type, "dataforseo"))
    .limit(1);
  if (!dfsConn) throw new Error("No DataForSEO connection configured");
  const cfg = JSON.parse(dfsConn.configJson) as DataForSeoConfig;

  const device = args.device ?? "desktop";
  const parsed = await fetchSerp({
    env: args.env,
    cfg,
    keyword: term.term,
    country: term.country,
    language: term.language,
    device,
  });

  const snapshotId = randomId();
  await db(args.env).insert(schema.serpSnapshots).values({
    id: snapshotId,
    brandTermId: term.id,
    query: term.term,
    country: term.country,
    language: term.language,
    device,
    fetchedAt: new Date(),
    costUsd: parsed.cost,
    source: "dataforseo",
  });

  if (parsed.ads.length > 0) {
    await db(args.env).insert(schema.serpAds).values(
      parsed.ads.map((a) => ({
        id: randomId(),
        snapshotId,
        position: a.position,
        advertiserDomain: a.domain,
        title: a.title ?? null,
        description: a.description ?? null,
        displayUrl: a.displayUrl ?? null,
        url: a.url ?? null,
      })),
    );
  }
  if (parsed.organic.length > 0) {
    await db(args.env).insert(schema.serpOrganic).values(
      parsed.organic.map((o) => ({
        id: randomId(),
        snapshotId,
        position: o.position,
        domain: o.domain,
        url: o.url ?? null,
        title: o.title ?? null,
      })),
    );
  }
  return { snapshotId, ads: parsed.ads.length, organic: parsed.organic.length, cost: parsed.cost };
}
