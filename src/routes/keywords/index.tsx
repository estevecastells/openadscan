import { createRoute } from "honox/factory";
import { db, schema } from "@/lib/db/client";
import { rankKeywords } from "@/features/keywords/ranker";
import { AppShell } from "@/ui/Layout";
import { Card, EmptyState } from "@/ui/Card";

export default createRoute(async (c) => {
  const [brand] = await db(c.env).select().from(schema.brands).limit(1);
  if (!brand) return c.render(<AppShell current="/keywords" title="Keywords"><EmptyState title="Set up a brand first" /></AppShell>);
  const rows = await rankKeywords(c.env, brand.id, 28);
  return c.render(
    <AppShell current="/keywords" title="Keywords Explorer" subtitle="Cross-source keyword view with opportunity scoring.">
      <Card title="Top 200 by opportunity">
        {rows.length === 0 ? (
          <EmptyState title="No keywords yet" description="Wait for GSC + Ads to ingest." />
        ) : (
          <table class="table-default">
            <thead>
              <tr>
                <th>Keyword</th><th>Country</th><th>Opportunity</th>
                <th>Org clicks</th><th>Org imp</th><th>Org CTR</th><th>Org pos</th>
                <th>Paid clicks</th><th>Paid cost</th><th>CPC</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 200).map((r) => (
                <tr>
                  <td class="font-medium">{r.keyword}</td>
                  <td class="text-muted">{r.country}</td>
                  <td class="text-positive">{(r.opportunityScore * 100).toFixed(0)}</td>
                  <td>{r.organicClicks}</td>
                  <td>{r.organicImpressions}</td>
                  <td>{(r.organicCtr * 100).toFixed(1)}%</td>
                  <td>{r.organicPosition.toFixed(1)}</td>
                  <td>{r.paidClicks}</td>
                  <td>${(r.paidCostMicros / 1_000_000).toFixed(2)}</td>
                  <td>${(r.paidCpcMicros / 1_000_000).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </AppShell>,
    { title: "Keywords" },
  );
});
