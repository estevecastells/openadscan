import { createRoute } from "honox/factory";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import { randomId } from "@/lib/crypto";
import { AppShell } from "@/ui/Layout";
import { Card } from "@/ui/Card";

export const GET = createRoute(async (c) => {
  const brands = await db(c.env).select().from(schema.brands);
  const terms = await db(c.env).select().from(schema.brandTerms);
  return c.render(
    <AppShell current="/settings/brands" title="Brands & terms">
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Brands">
          <ul class="space-y-2 mb-4">
            {brands.map((b) => <li class="text-sm"><strong>{b.name}</strong> <span class="text-muted">— {b.domain}</span></li>)}
          </ul>
          <form method="post" class="space-y-3">
            <input type="hidden" name="action" value="add_brand" />
            <input class="input" name="name" placeholder="Brand name" required />
            <input class="input" name="domain" placeholder="example.com" required />
            <button class="btn-primary" type="submit">Add brand</button>
          </form>
        </Card>
        <Card title="Brand terms" subtitle="Each term will be SERP-monitored every 6h.">
          <ul class="space-y-1 mb-4 max-h-72 overflow-auto">
            {terms.map((t) => (
              <li class="text-sm flex items-center justify-between">
                <span><strong>{t.term}</strong> <span class="text-muted text-xs">{t.country.toUpperCase()}/{t.language}</span></span>
                <form method="post" class="inline">
                  <input type="hidden" name="action" value="delete_term" />
                  <input type="hidden" name="id" value={t.id} />
                  <button class="text-xs text-danger hover:underline" type="submit">remove</button>
                </form>
              </li>
            ))}
          </ul>
          <form method="post" class="space-y-3">
            <input type="hidden" name="action" value="add_term" />
            <select class="input" name="brand_id">
              {brands.map((b) => <option value={b.id}>{b.name}</option>)}
            </select>
            <div class="grid grid-cols-2 gap-3">
              <input class="input" name="country" value="US" maxlength={2} />
              <input class="input" name="language" value="en" maxlength={5} />
            </div>
            <input class="input" name="term" placeholder="brand term" required />
            <button class="btn-primary" type="submit">Add term</button>
          </form>
        </Card>
      </div>
    </AppShell>,
    { title: "Brands & terms" },
  );
});

export const POST = createRoute(async (c) => {
  const form = await c.req.parseBody();
  const action = String(form.action ?? "");
  if (action === "add_brand") {
    await db(c.env).insert(schema.brands).values({
      id: randomId(),
      name: String(form.name),
      domain: String(form.domain).toLowerCase().replace(/^https?:\/\//, "").replace(/\/+$/, ""),
    });
  } else if (action === "add_term") {
    await db(c.env).insert(schema.brandTerms).values({
      id: randomId(),
      brandId: String(form.brand_id),
      term: String(form.term),
      matchType: "exact",
      country: String(form.country).toUpperCase(),
      language: String(form.language).toLowerCase(),
      monitorPaid: true,
    });
  } else if (action === "delete_term") {
    await db(c.env).delete(schema.brandTerms).where(eq(schema.brandTerms.id, String(form.id)));
  }
  return c.redirect("/settings/brands");
});
