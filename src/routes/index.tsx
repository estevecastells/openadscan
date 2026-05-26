import { createRoute } from "honox/factory";
import { gte, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import { daysAgo } from "@/lib/time";
import { AppShell } from "@/ui/Layout";
import { Card, KPI } from "@/ui/Card";

export default createRoute(async (c) => {
  const since = daysAgo(7);
  const [brand] = await db(c.env).select().from(schema.brands).limit(1);
  const [nklgSavingsRow] = await db(c.env)
    .select({
      sum: sql<number>`coalesce(sum(${schema.nklgRecommendations.savingsOpportunityMicros}), 0)`.as("sum"),
      count: sql<number>`count(*)`.as("count"),
    })
    .from(schema.nklgRecommendations);
  const [alertsRecent] = await db(c.env)
    .select({ count: sql<number>`count(*)`.as("count") })
    .from(schema.alertEvents)
    .where(gte(schema.alertEvents.firedAt, new Date(`${since}T00:00:00Z`)));
  const [competitorsActive] = await db(c.env)
    .select({ count: sql<number>`count(distinct ${schema.brandMonitorDaily.topCompetitorDomain})`.as("count") })
    .from(schema.brandMonitorDaily)
    .where(gte(schema.brandMonitorDaily.date, since));
  const [sovRow] = await db(c.env)
    .select({ avg: sql<number>`coalesce(avg(${schema.brandMonitorDaily.sovPaid}), 0)`.as("avg") })
    .from(schema.brandMonitorDaily)
    .where(gte(schema.brandMonitorDaily.date, since));

  const recentAlerts = await db(c.env)
    .select({
      id: schema.alertEvents.id,
      firedAt: schema.alertEvents.firedAt,
      type: schema.alertRules.type,
      payloadJson: schema.alertEvents.payloadJson,
    })
    .from(schema.alertEvents)
    .innerJoin(schema.alertRules, sql`${schema.alertEvents.ruleId} = ${schema.alertRules.id}`)
    .orderBy(sql`${schema.alertEvents.firedAt} desc`)
    .limit(10);

  return c.render(
    <AppShell current="/" title={brand ? `${brand.name} overview` : "Overview"} subtitle="Last 7 days">
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KPI label="Paid SOV (7d avg)" value={`${((sovRow?.avg ?? 0) * 100).toFixed(0)}%`} />
        <KPI
          label="NKLG opportunity"
          value={`$${((nklgSavingsRow?.sum ?? 0) / 1_000_000).toFixed(0)}`}
          delta={`${nklgSavingsRow?.count ?? 0} recommendations`}
          tone="positive"
        />
        <KPI label="Active competitors" value={`${competitorsActive?.count ?? 0}`} />
        <KPI label="Alerts (7d)" value={`${alertsRecent?.count ?? 0}`} tone={(alertsRecent?.count ?? 0) > 0 ? "danger" : "default"} />
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Get started" subtitle="If your data looks empty, finish wiring connectors.">
          <ol class="space-y-2 text-sm">
            <li>1. <a class="text-accent hover:underline" href="/settings/connections">Connect Google Ads</a></li>
            <li>2. <a class="text-accent hover:underline" href="/settings/connections">Connect Search Console</a></li>
            <li>3. <a class="text-accent hover:underline" href="/settings/connections">Add DataForSEO credentials</a></li>
            <li>4. <a class="text-accent hover:underline" href="/settings/brands">Add brand terms to monitor</a></li>
            <li>5. Wait for the first cron tick (or trigger one from <a class="text-accent hover:underline" href="/settings/schedules">Schedules</a>).</li>
          </ol>
        </Card>
        <Card title="Recent alerts">
          {recentAlerts.length === 0 ? (
            <p class="text-sm text-muted">No alerts yet. Once SERP snapshots accumulate, hijacks and new competitors will show here.</p>
          ) : (
            <ul class="space-y-2">
              {recentAlerts.map((a) => (
                <li class="text-sm flex items-start gap-3">
                  <span class="badge-warn">{a.type}</span>
                  <span class="flex-1 text-muted">{new Date(a.firedAt).toISOString().replace("T", " ").slice(0, 16)} UTC</span>
                  <a class="text-accent hover:underline" href="/alerts">view</a>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </AppShell>,
    { title: "Overview" },
  );
});
