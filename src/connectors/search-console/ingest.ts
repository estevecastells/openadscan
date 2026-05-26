import { and, eq } from "drizzle-orm";
import type { Bindings } from "@/env";
import { randomId } from "@/lib/crypto";
import { db, schema } from "@/lib/db/client";
import { listSites, searchAnalyticsQuery } from "./client";

export async function ensurePropertiesForConnection(env: Bindings, connectionId: string): Promise<string[]> {
  const sites = await listSites(env, connectionId);
  for (const siteUrl of sites) {
    const existing = await db(env)
      .select({ id: schema.gscProperties.id })
      .from(schema.gscProperties)
      .where(and(eq(schema.gscProperties.connectionId, connectionId), eq(schema.gscProperties.siteUrl, siteUrl)))
      .limit(1);
    if (existing.length === 0) {
      await db(env).insert(schema.gscProperties).values({ id: randomId(), connectionId, siteUrl });
    }
  }
  return sites;
}

export async function ingestGscDay(args: {
  env: Bindings;
  connectionId: string;
  propertyId: string;
  date: string;
}): Promise<number> {
  const [property] = await db(args.env)
    .select()
    .from(schema.gscProperties)
    .where(eq(schema.gscProperties.id, args.propertyId))
    .limit(1);
  if (!property) throw new Error("property not found");

  const rows = await searchAnalyticsQuery({
    env: args.env,
    connectionId: args.connectionId,
    siteUrl: property.siteUrl,
    date: args.date,
  });
  if (rows.length === 0) return 0;
  const inserts = rows.map((r) => {
    const [query = "", page = "", country = "zzz", device = "desktop"] = r.keys ?? [];
    return {
      id: randomId(),
      propertyId: property.id,
      date: args.date,
      query,
      page,
      country,
      device: (device.toLowerCase() as "desktop" | "mobile" | "tablet") || "desktop",
      clicks: r.clicks,
      impressions: r.impressions,
      ctr: r.ctr,
      position: r.position,
    };
  });
  for (let i = 0; i < inserts.length; i += 250) {
    await db(args.env).insert(schema.gscQueryDaily).values(inserts.slice(i, i + 250));
  }
  return inserts.length;
}
