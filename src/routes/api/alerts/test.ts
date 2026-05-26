import { createRoute } from "honox/factory";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import { randomId } from "@/lib/crypto";

export const POST = createRoute(async (c) => {
  const form = await c.req.parseBody();
  const ruleId = String(form.rule_id ?? "");
  const [rule] = await db(c.env).select().from(schema.alertRules).where(eq(schema.alertRules.id, ruleId)).limit(1);
  if (!rule) return c.text("rule not found", 404);
  await db(c.env).insert(schema.alertEvents).values({
    id: randomId(),
    ruleId: rule.id,
    firedAt: new Date(),
    payloadJson: JSON.stringify({ test: true, message: "synthetic test event" }),
    deliveryStatus: "pending",
  });
  return c.redirect("/alerts");
});
