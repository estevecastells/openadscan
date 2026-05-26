import { createRoute } from "honox/factory";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import { randomId } from "@/lib/crypto";
import { AppShell } from "@/ui/Layout";
import { Card } from "@/ui/Card";

const TYPES = ["competitor_new", "competitor_returning", "hijack_detected", "ranking_drop", "nklg_re_enable", "ingestion_failed"] as const;
const CHANNELS = ["email", "webhook", "slack"] as const;

export const GET = createRoute(async (c) => {
  const brands = await db(c.env).select().from(schema.brands);
  const rules = await db(c.env).select().from(schema.alertRules);
  return c.render(
    <AppShell current="/settings/alerts" title="Alert rules">
      <Card title="Active rules">
        {rules.length === 0 ? (
          <p class="text-sm text-muted">No rules yet.</p>
        ) : (
          <table class="table-default">
            <thead><tr><th>Type</th><th>Channel</th><th>Target</th><th>Enabled</th><th /></tr></thead>
            <tbody>
              {rules.map((r) => (
                <tr>
                  <td>{r.type}</td>
                  <td>{r.channel}</td>
                  <td class="text-muted text-xs font-mono">{r.channelTarget ?? "—"}</td>
                  <td>{r.enabled ? "✓" : "—"}</td>
                  <td>
                    <form method="post" class="inline">
                      <input type="hidden" name="action" value="delete" />
                      <input type="hidden" name="id" value={r.id} />
                      <button class="text-xs text-danger hover:underline" type="submit">remove</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
      <Card title="Add rule" subtitle="Channels: email (Resend/MailChannels), webhook (HMAC-signed), Slack incoming webhook.">
        <form method="post" class="grid grid-cols-2 gap-3">
          <input type="hidden" name="action" value="add" />
          <select class="input" name="brand_id">
            {brands.map((b) => <option value={b.id}>{b.name}</option>)}
          </select>
          <select class="input" name="type">
            {TYPES.map((t) => <option value={t}>{t}</option>)}
          </select>
          <select class="input" name="channel">
            {CHANNELS.map((ch) => <option value={ch}>{ch}</option>)}
          </select>
          <input class="input" name="target" placeholder="email@example.com or webhook URL" />
          <div class="col-span-2 flex justify-end">
            <button class="btn-primary" type="submit">Add rule</button>
          </div>
        </form>
      </Card>
    </AppShell>,
    { title: "Alert rules" },
  );
});

export const POST = createRoute(async (c) => {
  const form = await c.req.parseBody();
  const action = String(form.action ?? "");
  if (action === "add") {
    await db(c.env).insert(schema.alertRules).values({
      id: randomId(),
      brandId: String(form.brand_id),
      type: String(form.type) as "competitor_new",
      paramsJson: "{}",
      channel: String(form.channel) as "email",
      channelTarget: String(form.target ?? "") || null,
      enabled: true,
    });
  } else if (action === "delete") {
    await db(c.env).delete(schema.alertRules).where(eq(schema.alertRules.id, String(form.id)));
  }
  return c.redirect("/settings/alerts");
});
