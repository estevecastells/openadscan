/**
 * Lightweight ECharts theme tokens that read from CSS variables so charts
 * follow the rest of the UI's light/dark theme.
 */
export function readCssVar(name: string, fallback = "#000"): string {
  if (typeof window === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  if (!v) return fallback;
  // CSS vars are RGB triplets like "79 70 229" — turn into rgb(...)
  if (/^\d+\s+\d+\s+\d+$/.test(v)) {
    const [r, g, b] = v.split(/\s+/).map(Number);
    return `rgb(${r}, ${g}, ${b})`;
  }
  return v;
}

export function chartPalette(): string[] {
  return [
    readCssVar("--accent", "#4f46e5"),
    readCssVar("--positive", "#16a34a"),
    readCssVar("--warn", "#eab308"),
    readCssVar("--danger", "#dc2626"),
    "#0ea5e9",
    "#a855f7",
    "#f97316",
    "#14b8a6",
  ];
}
