import { createRoute } from "honox/factory";
import { and, desc, eq, gte } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import { daysAgo } from "@/lib/time";
import { AppShell } from "@/ui/Layout";
import { Badge, Card } from "@/ui/Card";

export default createRoute(async (c) => {
  const id = c.req.param("id") ?? "";
  const [rec] = await db(c.env).select().from(schema.nklgRecommendations).where(eq(schema.nklgRecommendations.id, id)).limit(1);
  if (!rec) {
    return c.render(<AppShell current="/nklg" title="Not found"><p class="text-sm text-muted">Recommendation not found.</p></AppShell>);
  }
  const from = daysAgo(28);
  const gscHist = await db(c.env)
    .select()
    .from(schema.gscQueryDaily)
    .where(and(eq(schema.gscQueryDaily.query, rec.keyword), gte(schema.gscQueryDaily.date, from)))
    .orderBy(schema.gscQueryDaily.date);
  const adsHist = await db(c.env)
    .select()
    .from(schema.adsKeywordDaily)
    .where(and(eq(schema.adsKeywordDaily.keyword, rec.keyword), gte(schema.adsKeywordDaily.date, from)))
    .orderBy(schema.adsKeywordDaily.date);
  const snapshots = await db(c.env)
    .select()
    .from(schema.serpSnapshots)
    .where(and(eq(schema.serpSnapshots.query, rec.keyword), eq(schema.serpSnapshots.country, rec.country)))
    .orderBy(desc(schema.serpSnapshots.fetchedAt))
    .limit(20);

  return c.render(
    <AppShell current="/nklg" title={`NKLG · ${rec.keyword}`} subtitle={`${rec.country} · evaluated ${new Date(rec.evaluatedAt).toISOString().slice(0, 16)} UTC`}>
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <Card title="Decision">
          <p class="mb-3">
            {rec.decision === "add_negative" && <Badge tone="positive">Pause paid bidding</Badge>}
            {rec.decision === "keep_paying" && <Badge tone="muted">Keep paying</Badge>}
            {rec.decision === "re_enable" && <Badge tone="danger">Re-enable paid bidding</Badge>}
          </p>
          <p class="text-sm text-muted">{rec.reason}</p>
          <p class="text-xs text-muted mt-3">Confidence: {(rec.confidence * 100).toFixed(0)}%</p>
        </Card>
        <Card title="Organic">
          <p class="text-sm">Avg position: <strong>{rec.organicPosition.toFixed(1)}</strong></p>
          <p class="text-sm">CTR: <strong>{(rec.organicCtr * 100).toFixed(1)}%</strong></p>
        </Card>
        <Card title="Paid">
          <p class="text-sm">Spend: <strong>${(rec.paidCostMicros / 1_000_000).toFixed(2)}</strong></p>
          <p class="text-sm">Clicks: <strong>{rec.paidClicks}</strong></p>
          <p class="text-sm">Competitors avg: <strong>{rec.paidCompetitorDensity.toFixed(2)}</strong></p>
        </Card>
      </div>

      <Card title="GSC daily">
        <table class="table-default">
          <thead><tr><th>Date</th><th>Clicks</th><th>Impr</th><th>CTR</th><th>Pos</th></tr></thead>
          <tbody>
            {gscHist.slice(-14).map((g) => (
              <tr>
                <td class="font-mono text-xs">{g.date}</td>
                <td>{g.clicks}</td>
                <td>{g.impressions}</td>
                <td>{(g.ctr * 100).toFixed(1)}%</td>
                <td>{g.position.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
        <Card title="Paid daily">
          <table class="table-default">
            <thead><tr><th>Date</th><th>Clicks</th><th>Cost</th></tr></thead>
            <tbody>
              {adsHist.slice(-14).map((a) => (
                <tr>
                  <td class="font-mono text-xs">{a.date}</td>
                  <td>{a.clicks}</td>
                  <td>${(a.costMicros / 1_000_000).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card title="Recent SERPs">
          <ul class="space-y-2 text-sm">
            {snapshots.map((s) => (
              <li class="flex items-center justify-between">
                <span class="font-mono text-xs text-muted">{new Date(s.fetchedAt).toISOString().slice(0, 16)} UTC</span>
                <span class="text-muted">${s.costUsd.toFixed(3)}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </AppShell>,
    { title: `NKLG · ${rec.keyword}` },
  );
});
