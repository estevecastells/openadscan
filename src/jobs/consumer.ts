/**
 * Queue consumer. Dispatches a single IngestMessage to the right handler.
 * Each handler is written to be idempotent on retry — composite uniques in
 * the schema collide cleanly on duplicate inserts.
 */
import { eq } from "drizzle-orm";
import type { Bindings, IngestMessage } from "@/env";
import { randomId } from "@/lib/crypto";
import { db, schema } from "@/lib/db/client";
import { ingestKeywordPerformance, ingestSearchTerms } from "@/connectors/google-ads/ingest";
import { ingestGscDay } from "@/connectors/search-console/ingest";
import { persistSerpForBrandTerm } from "@/connectors/dataforseo/ingest";
import { runCannibalizationForBrand } from "@/features/cannibalization/analyzer";
import { runIncrementalityForBrand } from "@/features/incrementality/analyzer";
import { runNKLGForBrand } from "@/features/nklg/recommender";
import { dispatchAllAlerts } from "@/features/alerts/dispatcher";
import { snapshotBrandMonitor } from "@/features/brand-monitor/snapshot";

export async function handleMessage(
  env: Bindings,
  msg: IngestMessage,
): Promise<{ ok: true; rows: number } | { ok: false; error: string }> {
  const start = Date.now();
  const jobId = randomId();
  await db(env).insert(schema.jobRuns).values({
    id: jobId,
    kind: msg.kind,
    startedAt: new Date(start),
    status: "running",
  });

  try {
    let rows = 0;
    let cost = 0;
    switch (msg.kind) {
      case "pull-ads": {
        rows += await ingestKeywordPerformance({
          env,
          connectionId: msg.connectionId,
          dateFrom: msg.from,
          dateTo: msg.to,
        });
        rows += await ingestSearchTerms({
          env,
          connectionId: msg.connectionId,
          dateFrom: msg.from,
          dateTo: msg.to,
        });
        break;
      }
      case "pull-gsc": {
        rows = await ingestGscDay({
          env,
          connectionId: msg.connectionId,
          propertyId: msg.propertyId,
          date: msg.date,
        });
        break;
      }
      case "pull-serp": {
        const r = await persistSerpForBrandTerm({ env, brandTermId: msg.brandTermId, device: msg.device });
        rows = r.ads + r.organic;
        cost = r.cost;
        await snapshotBrandMonitor(env, msg.brandTermId, r.snapshotId);
        break;
      }
      case "evaluate-cannibalization": {
        rows = await runCannibalizationForBrand(env, msg.brandId);
        break;
      }
      case "evaluate-incrementality": {
        rows = await runIncrementalityForBrand(env, msg.brandId);
        break;
      }
      case "evaluate-nklg": {
        rows = await runNKLGForBrand(env, msg.brandId);
        break;
      }
      case "evaluate-alerts": {
        rows = await dispatchAllAlerts(env);
        break;
      }
    }

    await db(env)
      .update(schema.jobRuns)
      .set({ endedAt: new Date(), status: "ok", rowsIngested: rows, costUsd: cost })
      .where(eq(schema.jobRuns.id, jobId));
    return { ok: true, rows };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db(env)
      .update(schema.jobRuns)
      .set({ endedAt: new Date(), status: "error", error: message })
      .where(eq(schema.jobRuns.id, jobId));
    return { ok: false, error: message };
  }
}
