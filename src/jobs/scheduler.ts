/**
 * Cron entry point. Fans work out onto the INGEST_QUEUE based on the cron
 * pattern that fired. Cron handlers must finish quickly (CPU limits), so
 * each one just enqueues messages — the heavy lifting happens in the queue
 * consumer.
 */
import { eq } from "drizzle-orm";
import type { Bindings, IngestMessage } from "@/env";
import { db, schema } from "@/lib/db/client";
import { enqueueBatch } from "@/lib/queue";
import { daysAgo, isoDate } from "@/lib/time";

export async function runScheduled(env: Bindings, cron: string): Promise<{ enqueued: number }> {
  const now = new Date();
  const messages: IngestMessage[] = [];

  if (cron === "0 */1 * * *") {
    // hourly: pull GSC + Ads incremental
    const adsConns = await db(env)
      .select()
      .from(schema.connections)
      .where(eq(schema.connections.type, "google_ads"));
    for (const conn of adsConns) {
      // pull the last 2 days to capture conversion lag
      messages.push({ kind: "pull-ads", connectionId: conn.id, from: daysAgo(2, now), to: isoDate(now) });
    }
    const gscConns = await db(env)
      .select()
      .from(schema.connections)
      .where(eq(schema.connections.type, "search_console"));
    for (const conn of gscConns) {
      const properties = await db(env)
        .select()
        .from(schema.gscProperties)
        .where(eq(schema.gscProperties.connectionId, conn.id));
      for (const prop of properties) {
        // GSC has ~48h data lag — target day-2
        messages.push({
          kind: "pull-gsc",
          connectionId: conn.id,
          propertyId: prop.id,
          date: daysAgo(2, now),
        });
      }
    }
  } else if (cron === "0 */6 * * *") {
    // every 6h: SERP for every active brand term
    const terms = await db(env)
      .select()
      .from(schema.brandTerms);
    for (const t of terms) {
      if (!t.monitorPaid) continue;
      messages.push({
        kind: "pull-serp",
        brandTermId: t.id,
        country: t.country,
        language: t.language,
        device: "desktop",
      });
    }
  } else if (cron === "30 2 * * *") {
    // nightly: evaluators
    const brands = await db(env).select().from(schema.brands);
    for (const b of brands) {
      messages.push({ kind: "evaluate-cannibalization", brandId: b.id });
      messages.push({ kind: "evaluate-incrementality", brandId: b.id });
      messages.push({ kind: "evaluate-nklg", brandId: b.id });
    }
  } else if (cron === "*/15 * * * *") {
    messages.push({ kind: "evaluate-alerts" });
  }

  await enqueueBatch(env, messages);
  return { enqueued: messages.length };
}
