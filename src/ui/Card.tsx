export function Card(props: { title?: string; subtitle?: string; actions?: unknown; children: unknown }) {
  return (
    <section class="card">
      {(props.title || props.actions) && (
        <header class="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            {props.title && <h2 class="text-base font-semibold">{props.title}</h2>}
            {props.subtitle && <p class="text-xs text-muted mt-0.5">{props.subtitle}</p>}
          </div>
          {props.actions ? <div>{props.actions}</div> : null}
        </header>
      )}
      <div class="p-5">{props.children}</div>
    </section>
  );
}

export function KPI(props: { label: string; value: string; delta?: string; tone?: "default" | "positive" | "danger" | "warn" }) {
  const toneClass =
    props.tone === "positive"
      ? "text-positive"
      : props.tone === "danger"
        ? "text-danger"
        : props.tone === "warn"
          ? "text-warn"
          : "text-text";
  return (
    <div class="card p-5">
      <div class="kpi-label">{props.label}</div>
      <div class={`kpi-value mt-1 ${toneClass}`}>{props.value}</div>
      {props.delta ? <div class="text-xs text-muted mt-1">{props.delta}</div> : null}
    </div>
  );
}

export function EmptyState(props: { title: string; description?: string; action?: unknown }) {
  return (
    <div class="card p-10 text-center">
      <h3 class="text-base font-medium">{props.title}</h3>
      {props.description ? <p class="text-sm text-muted mt-2 max-w-md mx-auto">{props.description}</p> : null}
      {props.action ? <div class="mt-4">{props.action}</div> : null}
    </div>
  );
}

export function Badge(props: { children: unknown; tone?: "positive" | "warn" | "danger" | "muted" }) {
  const cls =
    props.tone === "positive"
      ? "badge-positive"
      : props.tone === "warn"
        ? "badge-warn"
        : props.tone === "danger"
          ? "badge-danger"
          : "badge-muted";
  return <span class={cls}>{props.children}</span>;
}
