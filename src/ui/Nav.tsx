type NavItem = { href: string; label: string };

const ITEMS: NavItem[] = [
  { href: "/", label: "Overview" },
  { href: "/brand-monitor", label: "Brand Monitor" },
  { href: "/nklg", label: "NKLG" },
  { href: "/cannibalization", label: "Cannibalization" },
  { href: "/incrementality", label: "Incrementality" },
  { href: "/competitors", label: "Competitors" },
  { href: "/keywords", label: "Keywords" },
  { href: "/alerts", label: "Alerts" },
];

export function Sidebar(props: { current: string; email?: string }) {
  return (
    <aside class="hidden md:flex md:flex-col w-56 shrink-0 border-r border-border bg-surface">
      <a href="/" class="flex items-center gap-2 px-4 h-16 border-b border-border">
        <svg width="22" height="22" viewBox="0 0 32 32" aria-hidden="true">
          <rect width="32" height="32" rx="6" fill="rgb(var(--accent))" />
          <path d="M9 22 L23 10" stroke="white" stroke-width="3" stroke-linecap="round" />
          <circle cx="11" cy="20" r="3" fill="white" />
          <circle cx="21" cy="12" r="3" fill="white" />
        </svg>
        <span class="font-semibold tracking-tight">Open AdScan</span>
      </a>
      <nav class="flex-1 px-2 py-3">
        {ITEMS.map((item) => {
          const active = item.href === "/" ? props.current === "/" : props.current.startsWith(item.href);
          return (
            <a
              href={item.href}
              class={
                "block px-3 py-2 rounded-md text-sm mb-0.5 " +
                (active ? "bg-accent/10 text-accent font-medium" : "text-text hover:bg-bg")
              }
            >
              {item.label}
            </a>
          );
        })}
      </nav>
      <div class="px-3 py-3 border-t border-border text-xs text-muted">
        <a href="/settings/connections" class="block py-1 hover:text-text">Connections</a>
        <a href="/settings/brands" class="block py-1 hover:text-text">Brands &amp; terms</a>
        <a href="/settings/schedules" class="block py-1 hover:text-text">Schedules</a>
        <a href="/settings/alerts" class="block py-1 hover:text-text">Alert rules</a>
        <a href="/settings/account" class="block py-1 hover:text-text">Account</a>
        <form method="post" action="/logout" class="pt-2 mt-2 border-t border-border">
          <button class="text-muted hover:text-danger" type="submit">Sign out</button>
        </form>
      </div>
    </aside>
  );
}
