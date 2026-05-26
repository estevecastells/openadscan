import { and, eq, isNull } from "drizzle-orm";
import type { Bindings } from "@/env";
import { db, schema } from "@/lib/db/client";
import { sendEmail } from "./channels/email";
import { sendSlack } from "./channels/slack";
import { sendWebhook } from "./channels/webhook";

/**
 * Iterate over pending alert events and deliver each via its rule's configured channel.
 * Returns the number of events delivered (or marked failed).
 */
export async function dispatchAllAlerts(env: Bindings): Promise<number> {
  const pending = await db(env)
    .select({
      event: schema.alertEvents,
      rule: schema.alertRules,
    })
    .from(schema.alertEvents)
    .innerJoin(schema.alertRules, eq(schema.alertEvents.ruleId, schema.alertRules.id))
    .where(and(eq(schema.alertEvents.deliveryStatus, "pending"), isNull(schema.alertEvents.deliveredAt)))
    .limit(50);

  let delivered = 0;
  for (const row of pending) {
    if (!row.rule.enabled) {
      await markStatus(env, row.event.id, "failed", "rule disabled");
      continue;
    }
    const text = renderAlertText(row.rule.type, JSON.parse(row.event.payloadJson));
    try {
      switch (row.rule.channel) {
        case "email":
          await sendEmail(env, {
            to: row.rule.channelTarget ?? env.ADMIN_EMAIL,
            subject: `[openadscan] ${row.rule.type}`,
            text,
          });
          break;
        case "webhook":
          if (!row.rule.channelTarget) throw new Error("webhook target missing");
          await sendWebhook(env, row.rule.channelTarget, {
            type: row.rule.type,
            brandId: row.rule.brandId,
            firedAt: new Date(row.event.firedAt).toISOString(),
            data: JSON.parse(row.event.payloadJson),
          });
          break;
        case "slack":
          await sendSlack(env, row.rule.channelTarget ?? undefined, `*${row.rule.type}*\n${text}`);
          break;
      }
      await markStatus(env, row.event.id, "delivered");
      delivered += 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await markStatus(env, row.event.id, "failed", message);
    }
  }
  return delivered;
}

async function markStatus(
  env: Bindings,
  eventId: string,
  status: "delivered" | "failed",
  error?: string,
): Promise<void> {
  await db(env)
    .update(schema.alertEvents)
    .set({
      deliveryStatus: status,
      deliveredAt: new Date(),
      deliveryError: error ?? null,
    })
    .where(eq(schema.alertEvents.id, eventId));
}

export function renderAlertText(type: string, payload: Record<string, unknown>): string {
  switch (type) {
    case "competitor_new":
      return `New competitor "${payload.domain}" started bidding on a brand term.`;
    case "competitor_returning":
      return `Competitor "${payload.domain}" is back after ${payload.daysAbsent} days of absence.`;
    case "hijack_detected":
      return `Brand hijack detected: "${payload.advertiser}" is using your brand "${payload.matched}" in their ad copy.`;
    case "ranking_drop":
      return `Organic ranking for "${payload.query}" dropped from position ${payload.from} to ${payload.to}.`;
    case "nklg_re_enable":
      return `NKLG: competitor returned on "${payload.keyword}" (density ${payload.competitorDensity}). Recommend re-enabling paid bidding.`;
    case "ingestion_failed":
      return `Ingestion job failed: ${payload.kind} — ${payload.error}`;
    default:
      return JSON.stringify(payload);
  }
}
