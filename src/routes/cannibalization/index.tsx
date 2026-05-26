import { createRoute } from "honox/factory";
import { desc, gte, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import { daysAgo } from "@/lib/time";
import { AppShell } from "@/ui/Layout";
import { Card, EmptyState, KPI } from "@/ui/Card";

export default createRoute(async (c) => {
  const since = daysAgo(28);
  const aggregated = await db(c.env)
    .select({
      query: schema.cannibalizationDaily.query,
      country: schema.cannibalizationDaily.country,
      paidClicks: sql<number>`sum(${schema.cannibalizationDaily.paidClicks})`.as("paidClicks"),
      paidCost: sql<number>`sum(${schema.cannibalizationDaily.paidCostMicros})`.as("paidCost"),
      organicClicks: sql<number>`sum(${schema.cannibalizationDaily.organicClicks})`.as("organicClicks"),
      organicPosAvg: sql<number>`avg(${schema.cannibalizationDaily.organicPosition})`.as("organicPosAvg"),
      organicCtrAvg: sql<number>`avg(${schema.cannibalizationDaily.organicCtr})`.as("organicCtrAvg"),
      combined: sql<number>`sum(${schema.cannibalizationDaily.combinedClicks})`.as("combined"),
    })
    .from(schema.cannibalizationDaily)
    .where(gte(schema.cannibalizationDaily.date, since))
    .groupBy(schema.cannibalizationDaily.query, schema.cannibalizationDaily.country)
    .orderBy(desc(sql`sum(${schema.cannibalizationDaily.paidCostMicros})`))
    .limit(200);

  const totalPaid = aggregated.reduce((a, r) => a + (r.paidCost ?? 0), 0);
  const overlap = aggregated.filter((r) => r.organicPosAvg && r.organicPosAvg <= 3 && (r.paidCost ?? 0) > 0);
  const overlapSpend = overlap.reduce((a, r) => a + (r.paidCost ?? 0), 0);

  return c.render(
    <AppShell current="/cannibalization" title="Cannibalization" subtitle="Queries where you appear both organically and paid in the last 28 days.">
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <KPI label="Total paid spend (28d)" value={`$${(totalPaid / 1_000_000).toFixed(0)}`} />
        <KPI label="Spend overlapping organic top-3" value={`$${(overlapSpend / 1_000_000).toFixed(0)}`} tone="warn" />
        <KPI label="Queries with overlap" value={`${overlap.length}`} />
      </div>
      <Card title="Top queries by paid spend">
        {aggregated.length === 0 ? (
          <EmptyState title="No data yet" description="Run the nightly evaluator after Ads + GSC data is in." />
        ) : (
          <table class="table-default">
            <thead>
              <tr>
                <th>Query</th>
                <th>Country</th>
                <th>Paid spend</th>
                <th>Paid clicks</th>
                <th>Organic clicks</th>
                <th>Organic CTR</th>
                <th>Organic pos</th>
                <th>Combined</th>
              </tr>
            </thead>
            <tbody>
              {aggregated.map((r) => (
                <tr>
                  <td class="font-medium">{r.query}</td>
                  <td class="text-muted">{r.country}</td>
                  <td>${((r.paidCost ?? 0) / 1_000_000).toFixed(2)}</td>
                  <td>{r.paidClicks ?? 0}</td>
                  <td>{r.organicClicks ?? 0}</td>
                  <td>{((r.organicCtrAvg ?? 0) * 100).toFixed(1)}%</td>
                  <td>{(r.organicPosAvg ?? 0).toFixed(1)}</td>
                  <td>{r.combined ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </AppShell>,
    { title: "Cannibalization" },
  );
});
