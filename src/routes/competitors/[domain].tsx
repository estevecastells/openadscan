import { createRoute } from "honox/factory";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import { AppShell } from "@/ui/Layout";
import { Card } from "@/ui/Card";

export default createRoute(async (c) => {
  const domain = decodeURIComponent(c.req.param("domain") ?? "");
  const ads = await db(c.env)
    .select({
      title: schema.serpAds.title,
      description: schema.serpAds.description,
      displayUrl: schema.serpAds.displayUrl,
      position: schema.serpAds.position,
      query: schema.serpSnapshots.query,
      country: schema.serpSnapshots.country,
      fetchedAt: schema.serpSnapshots.fetchedAt,
    })
    .from(schema.serpAds)
    .innerJoin(schema.serpSnapshots, eq(schema.serpAds.snapshotId, schema.serpSnapshots.id))
    .where(eq(schema.serpAds.advertiserDomain, domain))
    .orderBy(desc(schema.serpSnapshots.fetchedAt))
    .limit(100);

  return c.render(
    <AppShell current="/competitors" title={`Competitor · ${domain}`}>
      <Card title="Ads seen for your brand terms">
        {ads.length === 0 ? (
          <p class="text-sm text-muted">Nothing seen yet.</p>
        ) : (
          <table class="table-default">
            <thead><tr><th>Query</th><th>Country</th><th>Position</th><th>Title / description</th><th>Display URL</th><th>When</th></tr></thead>
            <tbody>
              {ads.map((a) => (
                <tr>
                  <td class="font-medium">{a.query}</td>
                  <td class="text-muted">{a.country}</td>
                  <td>{a.position}</td>
                  <td>
                    <div class="text-sm">{a.title ?? "—"}</div>
                    <div class="text-xs text-muted">{a.description ?? ""}</div>
                  </td>
                  <td class="text-muted text-xs">{a.displayUrl ?? "—"}</td>
                  <td class="text-muted text-xs font-mono">{new Date(a.fetchedAt).toISOString().slice(0, 16).replace("T", " ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </AppShell>,
    { title: domain },
  );
});
