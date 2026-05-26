import { Sidebar } from "./Nav";

export function AppShell(props: { current: string; title: string; subtitle?: string; children: unknown }) {
  return (
    <div class="flex min-h-screen">
      <Sidebar current={props.current} />
      <main class="flex-1 min-w-0">
        <header class="flex items-center justify-between px-6 h-16 border-b border-border bg-surface">
          <div>
            <h1 class="text-lg font-semibold tracking-tight">{props.title}</h1>
            {props.subtitle ? <p class="text-xs text-muted mt-0.5">{props.subtitle}</p> : null}
          </div>
          <a href="/settings/connections" class="text-sm text-muted hover:text-text">⚙ Settings</a>
        </header>
        <div class="p-6">{props.children}</div>
      </main>
    </div>
  );
}
