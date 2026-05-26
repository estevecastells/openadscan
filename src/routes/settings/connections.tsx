import { createRoute } from "honox/factory";
import { desc } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import { AppShell } from "@/ui/Layout";
import { Badge, Card, EmptyState } from "@/ui/Card";

export default createRoute(async (c) => {
  const conns = await db(c.env).select().from(schema.connections).orderBy(desc(schema.connections.createdAt));
  const welcome = new URL(c.req.url).searchParams.get("welcome") === "1";
  return c.render(
    <AppShell current="/settings/connections" title="Connections" subtitle="Authorize Google and add DataForSEO credentials.">
      {welcome && (
        <div class="card p-5 mb-6 border-accent/40 bg-accent/5">
          <h3 class="font-semibold mb-1">Welcome aboard 👋</h3>
          <p class="text-sm text-muted">Set up at least Google Ads, Search Console and DataForSEO to unlock every dashboard.</p>
        </div>
      )}

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="Google Ads" subtitle="OAuth via your Google account">
          <p class="text-sm text-muted mb-4">Needs a Google Ads developer token + OAuth client. See docs/connectors/google-ads.md.</p>
          <a class="btn-primary" href="/api/connectors/google-ads/oauth-start">Connect</a>
        </Card>
        <Card title="Search Console" subtitle="OAuth via your Google account">
          <p class="text-sm text-muted mb-4">Uses the same OAuth client as Google Ads, with the webmasters.readonly scope.</p>
          <a class="btn-primary" href="/api/connectors/search-console/oauth-start">Connect</a>
        </Card>
        <Card title="DataForSEO" subtitle="API login / password">
          <form method="post" action="/api/connectors/dataforseo/test" class="space-y-3">
            <input class="input" name="login" placeholder="API login (email)" required />
            <input class="input" name="password" type="password" placeholder="API password" required />
            <button class="btn-primary w-full" type="submit">Save credentials</button>
          </form>
        </Card>
      </div>

      <h2 class="text-sm font-semibold mt-8 mb-3">Configured connections</h2>
      {conns.length === 0 ? (
        <EmptyState title="No connections yet" description="Authorize at least one connector above." />
      ) : (
        <div class="card">
          <table class="table-default">
            <thead><tr><th>Type</th><th>Name</th><th>Status</th><th>Last synced</th><th>Created</th></tr></thead>
            <tbody>
              {conns.map((c) => (
                <tr>
                  <td class="font-medium">{c.type.replace("_", " ")}</td>
                  <td>{c.displayName}</td>
                  <td>{c.status === "active" ? <Badge tone="positive">active</Badge> : c.status === "error" ? <Badge tone="danger">error</Badge> : <Badge tone="muted">disabled</Badge>}</td>
                  <td class="text-muted text-xs font-mono">{c.lastSyncedAt ? new Date(c.lastSyncedAt).toISOString().slice(0, 16).replace("T", " ") : "—"}</td>
                  <td class="text-muted text-xs font-mono">{new Date(c.createdAt).toISOString().slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AppShell>,
    { title: "Connections" },
  );
});
