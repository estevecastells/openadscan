import { and, eq } from "drizzle-orm";
import type { Bindings } from "@/env";
import { randomId } from "@/lib/crypto";
import { db, schema } from "@/lib/db/client";

/**
 * Watches for applied NKLG recommendations whose decision flipped to `re_enable`
 * since the previous run, and emits one alert event per flip.
 */
export async function monitorReEnables(env: Bindings, brandId: string): Promise<number> {
  const rows = await db(env)
    .select()
    .from(schema.nklgRecommendations)
    .where(
      and(
        eq(schema.nklgRecommendations.brandId, brandId),
        eq(schema.nklgRecommendations.decision, "re_enable"),
      ),
    );

  // Find or create a default alert rule of type nklg_re_enable for the brand
  let [rule] = await db(env)
    .select()
    .from(schema.alertRules)
    .where(and(eq(schema.alertRules.brandId, brandId), eq(schema.alertRules.type, "nklg_re_enable")))
    .limit(1);
  if (!rule) {
    const ruleId = randomId();
    await db(env).insert(schema.alertRules).values({
      id: ruleId,
      brandId,
      type: "nklg_re_enable",
      paramsJson: "{}",
      channel: "email",
      enabled: true,
    });
    [rule] = await db(env).select().from(schema.alertRules).where(eq(schema.alertRules.id, ruleId)).limit(1);
  }
  if (!rule) return 0;

  let inserted = 0;
  for (const r of rows) {
    await db(env).insert(schema.alertEvents).values({
      id: randomId(),
      ruleId: rule.id,
      firedAt: new Date(),
      payloadJson: JSON.stringify({
        keyword: r.keyword,
        country: r.country,
        competitorDensity: r.paidCompetitorDensity,
        recommendationId: r.id,
      }),
      deliveryStatus: "pending",
    });
    inserted += 1;
  }
  return inserted;
}
