import { createRoute } from "honox/factory";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import { verifyPassword } from "@/lib/crypto";
import { startSession } from "@/lib/auth";

export const GET = createRoute((c) => {
  const next = new URL(c.req.url).searchParams.get("next") ?? "/";
  return c.render(
    <div class="min-h-screen flex items-center justify-center bg-bg">
      <form method="post" class="card w-full max-w-sm p-8">
        <div class="flex items-center gap-2 mb-6">
          <svg width="24" height="24" viewBox="0 0 32 32">
            <rect width="32" height="32" rx="6" fill="rgb(var(--accent))" />
            <path d="M9 22 L23 10" stroke="white" stroke-width="3" stroke-linecap="round" />
            <circle cx="11" cy="20" r="3" fill="white" />
            <circle cx="21" cy="12" r="3" fill="white" />
          </svg>
          <span class="font-semibold tracking-tight text-lg">Open AdScan</span>
        </div>
        <h1 class="text-lg font-semibold mb-1">Sign in</h1>
        <p class="text-sm text-muted mb-6">Admin access to your Open AdScan instance.</p>
        <input type="hidden" name="next" value={next} />
        <label class="label">Email</label>
        <input name="email" type="email" required class="input mb-3" autocomplete="email" />
        <label class="label">Password</label>
        <input name="password" type="password" required class="input mb-6" autocomplete="current-password" />
        <button class="btn-primary w-full" type="submit">Sign in</button>
      </form>
    </div>,
    { title: "Sign in" },
  );
});

export const POST = createRoute(async (c) => {
  const form = await c.req.parseBody();
  const email = String(form.email ?? "").trim().toLowerCase();
  const password = String(form.password ?? "");
  const next = String(form.next ?? "/");
  const [user] = await db(c.env).select().from(schema.adminUser).where(eq(schema.adminUser.email, email)).limit(1);
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return c.render(
      <div class="min-h-screen flex items-center justify-center">
        <div class="card p-6 max-w-sm">
          <p class="text-danger mb-3">Invalid credentials.</p>
          <a class="btn" href={`/login?next=${encodeURIComponent(next)}`}>Try again</a>
        </div>
      </div>,
      { title: "Sign in" },
    );
  }
  await startSession(c, user.id);
  return c.redirect(next);
});
