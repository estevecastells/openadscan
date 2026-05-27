import { createRoute } from "honox/factory";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import { AppShell } from "@/ui/Layout";
import { Badge, Card, EmptyState, KPI } from "@/ui/Card";

function decisionBadge(d: string) {
  if (d === "add_negative") return <Badge tone="positive">Pause paid</Badge>;
  if (d === "re_enable") return <Badge tone="danger">Re-enable</Badge>;
  return <Badge tone="muted">Keep paying</Badge>;
}

export default createRoute(async (c) => {
  const [brand] = await db(c.env).select().from(schema.brands).limit(1);
  if (!brand) {
    return c.render(
      <AppShell current="/nklg" title="NKLG">
        <EmptyState
          title="No brand configured"
          description="Finish setup first so NKLG has data to evaluate."
          action={<a href="/setup" class="btn-primary">Open setup</a>}
        />
      </AppShell>,
      { title: "NKLG" },
    );
  }

  const recs = await db(c.env)
    .select()
    .from(schema.nklgRecommendations)
    .where(eq(schema.nklgRecommendations.brandId, brand.id))
    .orderBy(desc(schema.nklgRecommendations.savingsOpportunityMicros))
    .limit(500);

  const totalSavings = recs
    .filter((r) => r.decision === "add_negative")
    .reduce((acc, r) => acc + r.savingsOpportunityMicros, 0);
  const reEnableCount = recs.filter((r) => r.decision === "re_enable").length;
  const pauseCount = recs.filter((r) => r.decision === "add_negative").length;

  return c.render(
    <AppShell
      current="/nklg"
      title="Negative Keyword List Generator"
      subtitle="Originally built at Adevinta by Marcin, Filippo, Esteve and the rest of the SAI team."
    >
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <KPI label="Pause candidates" value={`${pauseCount}`} tone="positive" />
        <KPI label="Re-enable warnings" value={`${reEnableCount}`} tone={reEnableCount ? "danger" : "default"} />
        <KPI label="Potential savings" value={`$${(totalSavings / 1_000_000).toFixed(0)}`} tone="positive" />
      </div>

      <Card
        title="Recommendations"
        subtitle="Click a row to see the full reasoning, SERP timeline, and competitor history."
        actions={
          <div class="flex gap-2">
            <a class="btn" href="/api/reports/nklg.csv">Export CSV</a>
            <form method="post" action="/api/jobs/trigger">
              <input type="hidden" name="kind" value="evaluate-nklg" />
              <input type="hidden" name="brandId" value={brand.id} />
              <button class="btn-primary" type="submit">Re-evaluate</button>
            </form>
          </div>
        }
      >
        {recs.length === 0 ? (
          <p class="text-sm text-muted">No recommendations yet. They'll appear after the nightly evaluator runs.</p>
        ) : (
          <table class="table-default">
            <thead>
              <tr>
                <th>Keyword</th>
                <th>Country</th>
                <th>Decision</th>
                <th>Organic pos</th>
                <th>Organic CTR</th>
                <th>Competitors</th>
                <th>Spend</th>
                <th>Savings</th>
                <th>Confidence</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {recs.map((r) => (
                <tr>
                  <td class="font-medium">{r.keyword}</td>
                  <td class="text-muted">{r.country}</td>
                  <td>{decisionBadge(r.decision)}</td>
                  <td class="text-muted">{r.organicPosition.toFixed(1)}</td>
                  <td class="text-muted">{(r.organicCtr * 100).toFixed(1)}%</td>
                  <td class="text-muted">{r.paidCompetitorDensity.toFixed(2)}</td>
                  <td class="text-muted">${(r.paidCostMicros / 1_000_000).toFixed(2)}</td>
                  <td class="text-positive">${(r.savingsOpportunityMicros / 1_000_000).toFixed(2)}</td>
                  <td class="text-muted">{(r.confidence * 100).toFixed(0)}%</td>
                  <td><a class="text-accent hover:underline" href={`/nklg/${r.id}`}>open</a></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </AppShell>,
    { title: "NKLG" },
  );
});
