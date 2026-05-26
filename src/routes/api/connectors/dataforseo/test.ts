import { createRoute } from "honox/factory";
import { randomId } from "@/lib/crypto";
import { db, schema } from "@/lib/db/client";
import { fetchWithRetry } from "@/lib/http";

export const POST = createRoute(async (c) => {
  const form = await c.req.parseBody();
  const login = String(form.login ?? "");
  const password = String(form.password ?? "");

  // Probe the cheap /v3/serp/screenshot/locations endpoint (free) to verify creds.
  const res = await fetchWithRetry("https://api.dataforseo.com/v3/appendix/user_data", {
    headers: { Authorization: `Basic ${btoa(`${login}:${password}`)}` },
  });
  if (!res.ok) return c.text(`DataForSEO credential test failed (${res.status})`, 400);

  await db(c.env).insert(schema.connections).values({
    id: randomId(),
    type: "dataforseo",
    displayName: `DataForSEO (${login})`,
    configJson: JSON.stringify({ login, password }),
    status: "active",
  });
  return c.redirect("/settings/connections");
});
