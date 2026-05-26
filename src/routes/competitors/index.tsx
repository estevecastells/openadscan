import { createRoute } from "honox/factory";
import { db, schema } from "@/lib/db/client";
import { competitorLeaderboard } from "@/features/competitors/analyzer";
import { AppShell } from "@/ui/Layout";
import { Card, EmptyState } from "@/ui/Card";

export default createRoute(async (c) => {
  const [brand] = await db(c.env).select().from(schema.brands).limit(1);
  if (!brand) return c.render(<AppShell current="/competitors" title="Competitors"><EmptyState title="Set up a brand first" /></AppShell>);
  const rows = await competitorLeaderboard(c.env, brand.id, 14);
  return c.render(
    <AppShell current="/competitors" title="Competitor Intel" subtitle="Domains that bid against you in the last 14 days.">
      <Card title="Leaderboard">
        {rows.length === 0 ? (
          <EmptyState title="No competitor activity captured yet" description="Wait for the next SERP cron tick, then check back." />
        ) : (
          <table class="table-default">
            <thead><tr><th>Domain</th><th>Appearances</th><th>Avg position</th><th>Last seen</th><th /></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr>
                  <td class="font-medium">{r.domain}</td>
                  <td>{r.appearances}</td>
                  <td>{r.avgPosition.toFixed(1)}</td>
                  <td class="text-muted font-mono text-xs">{r.lastSeen.slice(0, 16).replace("T", " ")} UTC</td>
                  <td><a class="text-accent hover:underline" href={`/competitors/${encodeURIComponent(r.domain)}`}>open</a></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </AppShell>,
    { title: "Competitors" },
  );
});
