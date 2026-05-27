import { createRoute } from "honox/factory";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import { hashPassword, randomId } from "@/lib/crypto";
import { startSession } from "@/lib/auth";

export const GET = createRoute(async (c) => {
  const admin = await db(c.env).select().from(schema.adminUser).limit(1);
  if (admin.length > 0) return c.redirect("/login");

  return c.render(
    <div class="min-h-screen bg-bg py-12">
      <div class="max-w-2xl mx-auto card p-10">
        <div class="flex items-center gap-2 mb-6">
          <svg width="24" height="24" viewBox="0 0 32 32">
            <rect width="32" height="32" rx="6" fill="rgb(var(--accent))" />
            <path d="M9 22 L23 10" stroke="white" stroke-width="3" stroke-linecap="round" />
            <circle cx="11" cy="20" r="3" fill="white" />
            <circle cx="21" cy="12" r="3" fill="white" />
          </svg>
          <h1 class="text-xl font-semibold tracking-tight">Welcome to Open AdScan</h1>
        </div>
        <p class="text-sm text-muted mb-8">
          One-time setup. We'll create your admin account, your first brand and direct you to the connector setup.
        </p>
        <form method="post" class="space-y-5">
          <fieldset>
            <legend class="text-sm font-medium mb-2">Admin account</legend>
            <label class="label">Email</label>
            <input class="input mb-3" name="email" type="email" required value={c.env.ADMIN_EMAIL} />
            <label class="label">Password</label>
            <input class="input" name="password" type="password" required minlength={8} autocomplete="new-password" />
          </fieldset>
          <fieldset>
            <legend class="text-sm font-medium mb-2 mt-4">Your brand</legend>
            <label class="label">Brand name</label>
            <input class="input mb-3" name="brand_name" required placeholder="Acme Inc" />
            <label class="label">Primary domain</label>
            <input class="input" name="brand_domain" required placeholder="acme.com" />
          </fieldset>
          <fieldset>
            <legend class="text-sm font-medium mb-2 mt-4">First market &amp; brand term</legend>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="label">Country (ISO 2-letter)</label>
                <input class="input" name="country" required value="US" maxlength={2} />
              </div>
              <div>
                <label class="label">Language</label>
                <input class="input" name="language" required value="en" maxlength={5} />
              </div>
            </div>
            <label class="label mt-3">Brand term to monitor</label>
            <input class="input" name="brand_term" required placeholder="acme" />
          </fieldset>
          <button class="btn-primary w-full" type="submit">Continue</button>
        </form>
      </div>
    </div>,
    { title: "Setup" },
  );
});

export const POST = createRoute(async (c) => {
  const form = await c.req.parseBody();
  // Bail if already initialised — prevents tampering.
  const existing = await db(c.env).select().from(schema.adminUser).limit(1);
  if (existing.length > 0) return c.redirect("/login");

  const email = String(form.email).trim().toLowerCase();
  const password = String(form.password);
  const passwordHash = await hashPassword(password);
  const userId = randomId();
  await db(c.env).insert(schema.adminUser).values({ id: userId, email, passwordHash });

  const brandId = randomId();
  await db(c.env).insert(schema.brands).values({
    id: brandId,
    name: String(form.brand_name),
    domain: String(form.brand_domain).toLowerCase().replace(/^https?:\/\//, "").replace(/\/+$/, ""),
  });

  await db(c.env).insert(schema.brandTerms).values({
    id: randomId(),
    brandId,
    term: String(form.brand_term),
    matchType: "exact",
    country: String(form.country).toUpperCase(),
    language: String(form.language).toLowerCase(),
    monitorPaid: true,
  });

  // Seed default schedules so the cron triggers in wrangler.toml have descriptors in DB
  const schedules = [
    { connectorType: "google_ads", cron_expr: "0 */1 * * *" },
    { connectorType: "search_console", cron_expr: "0 */1 * * *" },
    { connectorType: "dataforseo", cron_expr: "0 */6 * * *" },
    { connectorType: "evaluator", cron_expr: "30 2 * * *" },
    { connectorType: "alerts", cron_expr: "*/15 * * * *" },
  ] as const;
  for (const s of schedules) {
    await db(c.env).insert(schema.schedules).values({
      id: randomId(),
      connectorType: s.connectorType,
      cronExpr: s.cron_expr,
      enabled: true,
    });
  }

  await startSession(c, userId);
  return c.redirect("/settings/connections?welcome=1");
});
