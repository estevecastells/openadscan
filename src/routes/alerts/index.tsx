import { createRoute } from "honox/factory";
import { desc, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import { AppShell } from "@/ui/Layout";
import { Badge, Card, EmptyState } from "@/ui/Card";

export default createRoute(async (c) => {
  const events = await db(c.env)
    .select({
      event: schema.alertEvents,
      rule: schema.alertRules,
    })
    .from(schema.alertEvents)
    .innerJoin(schema.alertRules, sql`${schema.alertEvents.ruleId} = ${schema.alertRules.id}`)
    .orderBy(desc(schema.alertEvents.firedAt))
    .limit(200);

  return c.render(
    <AppShell current="/alerts" title="Alerts" subtitle="Recent alert events and delivery status.">
      <Card title="Events" actions={<a class="btn" href="/settings/alerts">Rules</a>}>
        {events.length === 0 ? (
          <EmptyState title="No alerts yet" description="Configure rules under Settings → Alert rules." />
        ) : (
          <table class="table-default">
            <thead><tr><th>When</th><th>Type</th><th>Channel</th><th>Status</th><th>Payload</th></tr></thead>
            <tbody>
              {events.map(({ event, rule }) => (
                <tr>
                  <td class="font-mono text-xs">{new Date(event.firedAt).toISOString().slice(0, 16).replace("T", " ")} UTC</td>
                  <td>{rule.type}</td>
                  <td class="text-muted">{rule.channel}</td>
                  <td>
                    {event.deliveryStatus === "delivered" && <Badge tone="positive">delivered</Badge>}
                    {event.deliveryStatus === "pending" && <Badge tone="warn">pending</Badge>}
                    {event.deliveryStatus === "failed" && <Badge tone="danger">failed</Badge>}
                  </td>
                  <td class="text-muted text-xs font-mono">{event.payloadJson}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </AppShell>,
    { title: "Alerts" },
  );
});
