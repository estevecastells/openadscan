import { createRoute } from "honox/factory";
import { desc } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import { AppShell } from "@/ui/Layout";
import { Badge, Card } from "@/ui/Card";

export default createRoute(async (c) => {
  const schedules = await db(c.env).select().from(schema.schedules);
  const recent = await db(c.env)
    .select()
    .from(schema.jobRuns)
    .orderBy(desc(schema.jobRuns.startedAt))
    .limit(30);
  return c.render(
    <AppShell current="/settings/schedules" title="Schedules & jobs">
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Cron schedules">
          <table class="table-default">
            <thead><tr><th>Connector</th><th>Cron</th><th>Last run</th><th>State</th></tr></thead>
            <tbody>
              {schedules.map((s) => (
                <tr>
                  <td>{s.connectorType}</td>
                  <td class="font-mono text-xs">{s.cronExpr}</td>
                  <td class="text-muted text-xs">{s.lastRunAt ? new Date(s.lastRunAt).toISOString().slice(0, 16).replace("T", " ") : "—"}</td>
                  <td>{s.enabled ? <Badge tone="positive">enabled</Badge> : <Badge tone="muted">paused</Badge>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card title="Recent job runs">
          <table class="table-default">
            <thead><tr><th>Kind</th><th>Status</th><th>Rows</th><th>$</th><th>Started</th></tr></thead>
            <tbody>
              {recent.map((r) => (
                <tr>
                  <td>{r.kind}</td>
                  <td>
                    {r.status === "ok" && <Badge tone="positive">ok</Badge>}
                    {r.status === "error" && <Badge tone="danger">error</Badge>}
                    {r.status === "running" && <Badge tone="warn">running</Badge>}
                  </td>
                  <td>{r.rowsIngested}</td>
                  <td>${r.costUsd.toFixed(3)}</td>
                  <td class="text-muted text-xs font-mono">{new Date(r.startedAt).toISOString().slice(11, 19)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </AppShell>,
    { title: "Schedules" },
  );
});
