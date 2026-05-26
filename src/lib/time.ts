/** Date helpers for daily fact tables. All dates are UTC YYYY-MM-DD strings. */

export function isoDate(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10);
}

export function parseIsoDate(s: string): Date {
  // 2026-05-27 -> Date at UTC midnight
  return new Date(`${s}T00:00:00.000Z`);
}

export function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setUTCDate(out.getUTCDate() + n);
  return out;
}

export function dateRange(from: string, to: string): string[] {
  const start = parseIsoDate(from);
  const end = parseIsoDate(to);
  const out: string[] = [];
  for (let d = start; d.getTime() <= end.getTime(); d = addDays(d, 1)) {
    out.push(isoDate(d));
  }
  return out;
}

export function daysAgo(n: number, base = new Date()): string {
  return isoDate(addDays(base, -n));
}
