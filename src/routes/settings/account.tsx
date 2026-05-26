import { createRoute } from "honox/factory";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import { hashPassword, verifyPassword } from "@/lib/crypto";
import { getCurrentUser } from "@/lib/auth";
import { AppShell } from "@/ui/Layout";
import { Card } from "@/ui/Card";

export const GET = createRoute(async (c) => {
  const user = await getCurrentUser(c);
  return c.render(
    <AppShell current="/settings/account" title="Account">
      <Card title="Change password">
        <form method="post" class="space-y-3 max-w-sm">
          <input class="input" name="current" type="password" placeholder="Current password" required />
          <input class="input" name="next" type="password" placeholder="New password" minlength={8} required />
          <button class="btn-primary" type="submit">Update password</button>
        </form>
        <p class="text-xs text-muted mt-4">Email: <strong>{user?.email}</strong></p>
      </Card>
    </AppShell>,
    { title: "Account" },
  );
});

export const POST = createRoute(async (c) => {
  const user = await getCurrentUser(c);
  if (!user) return c.redirect("/login");
  const form = await c.req.parseBody();
  const [row] = await db(c.env).select().from(schema.adminUser).where(eq(schema.adminUser.id, user.id)).limit(1);
  if (!row || !(await verifyPassword(String(form.current), row.passwordHash))) {
    return c.text("Current password incorrect", 400);
  }
  await db(c.env).update(schema.adminUser).set({ passwordHash: await hashPassword(String(form.next)) }).where(eq(schema.adminUser.id, user.id));
  return c.redirect("/settings/account");
});
