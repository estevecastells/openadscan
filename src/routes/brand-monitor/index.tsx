import { createRoute } from "honox/factory";
import { desc, gte } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import { daysAgo } from "@/lib/time";
import { AppShell } from "@/ui/Layout";
import { Card, EmptyState } from "@/ui/Card";

export default createRoute(async (c) => {
  const since = daysAgo(7);
  const rows = await db(c.env)
    .select()
    .from(schema.brandMonitorDaily)
    .where(gte(schema.brandMonitorDaily.date, since))
    .orderBy(desc(schema.brandMonitorDaily.date), desc(schema.brandMonitorDaily.competitorCount))
    .limit(500);

  return c.render(
    <AppShell current="/brand-monitor" title="Brand Monitor" subtitle="Daily SERP snapshots and who's bidding on your brand terms.">
      <Card title="Latest snapshots">
        {rows.length === 0 ? (
          <EmptyState title="No SERP data yet" description="DataForSEO SERP fetches run every 6h. Add a brand term and connect DataForSEO to start collecting." />
        ) : (
          <table class="table-default">
            <thead>
              <tr>
                <th>Term</th>
                <th>Country</th>
                <th>Date</th>
                <th>Our ad pos</th>
                <th>Competitors</th>
                <th>Top competitor</th>
                <th>Organic top 3?</th>
                <th>SOV paid</th>
                <th>SOV organic</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr>
                  <td class="font-medium">{r.term}</td>
                  <td class="text-muted">{r.country}</td>
                  <td class="font-mono text-xs">{r.date}</td>
                  <td>{r.ourTopAdPos ?? "—"}</td>
                  <td>{r.competitorCount}</td>
                  <td class="text-muted">{r.topCompetitorDomain ?? "—"}</td>
                  <td>{r.ourOrganicTop3 ? "✅" : "—"}</td>
                  <td>{(r.sovPaid * 100).toFixed(0)}%</td>
                  <td>{(r.sovOrganic * 100).toFixed(0)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </AppShell>,
    { title: "Brand Monitor" },
  );
});
