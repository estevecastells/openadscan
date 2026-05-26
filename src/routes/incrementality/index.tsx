import { createRoute } from "honox/factory";
import { desc } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import { AppShell } from "@/ui/Layout";
import { Card, EmptyState, KPI } from "@/ui/Card";

export default createRoute(async (c) => {
  const rows = await db(c.env)
    .select()
    .from(schema.incrementalityMetrics)
    .orderBy(desc(schema.incrementalityMetrics.windowEnd))
    .limit(300);

  const totalPaid = rows.reduce((a, r) => a + r.paidCostMicros, 0);
  const totalIncrementalClicks = rows.reduce((a, r) => a + r.incrementalClicks, 0);
  const blendedCpic = totalIncrementalClicks > 0 ? totalPaid / 1_000_000 / totalIncrementalClicks : 0;

  return c.render(
    <AppShell current="/incrementality" title="Incrementality" subtitle="CTR delta and cost per incremental click. Based on the Adevinta SEO vs SEM framework.">
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <KPI label="Queries analysed" value={`${rows.length}`} />
        <KPI label="Total paid spend" value={`$${(totalPaid / 1_000_000).toFixed(0)}`} />
        <KPI label="Blended cost per incremental click" value={`$${blendedCpic.toFixed(2)}`} tone="positive" />
      </div>

      <Card title="Per-query incrementality">
        {rows.length === 0 ? (
          <EmptyState title="Not enough overlap yet" description="Incrementality needs at least 1 paid_on and 1 paid_off day per query within the 56-day window." />
        ) : (
          <table class="table-default">
            <thead>
              <tr>
                <th>Query</th>
                <th>Country</th>
                <th>Days on/off</th>
                <th>CTR with</th>
                <th>CTR without</th>
                <th>Δ CTR</th>
                <th>Paid clicks</th>
                <th>Incremental clicks</th>
                <th>Cost / incremental</th>
                <th>Confidence</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr>
                  <td class="font-medium">{r.query}</td>
                  <td class="text-muted">{r.country}</td>
                  <td class="text-muted">{r.daysPaidOn}/{r.daysPaidOff}</td>
                  <td>{(r.ctrWithSem * 100).toFixed(1)}%</td>
                  <td>{(r.ctrWithoutSem * 100).toFixed(1)}%</td>
                  <td class={r.incrementalCtr >= 0 ? "text-positive" : "text-danger"}>{(r.incrementalCtr * 100).toFixed(1)} pp</td>
                  <td>{r.paidClicks}</td>
                  <td>{r.incrementalClicks.toFixed(0)}</td>
                  <td>${r.costPerIncrementalClick.toFixed(2)}</td>
                  <td class="text-muted">{(r.sampleConfidence * 100).toFixed(0)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </AppShell>,
    { title: "Incrementality" },
  );
});
