/**
 * Pure rule evaluators. Each rule receives the relevant input shape and
 * returns 0..N alert payloads. The dispatcher in dispatcher.ts wires these
 * to actual data sources and channels.
 */

export type CompetitorObservation = {
  domain: string;
  firstSeenAt: string;
  lastSeenAt: string;
  daysAbsentBeforeReturn: number;
};

export type CompetitorNewParams = { brandId: string };
export type CompetitorReturningParams = { brandId: string; minAbsenceDays: number };
export type RankingDropParams = { minPositionDelta: number };
export type HijackParams = { brandTokens: string[] };

export function evaluateCompetitorNew(args: {
  observations: CompetitorObservation[];
  windowStart: string;
}): Array<{ domain: string }> {
  return args.observations
    .filter((o) => o.firstSeenAt >= args.windowStart)
    .map((o) => ({ domain: o.domain }));
}

export function evaluateCompetitorReturning(args: {
  observations: CompetitorObservation[];
  params: CompetitorReturningParams;
}): Array<{ domain: string; daysAbsent: number }> {
  return args.observations
    .filter((o) => o.daysAbsentBeforeReturn >= args.params.minAbsenceDays)
    .map((o) => ({ domain: o.domain, daysAbsent: o.daysAbsentBeforeReturn }));
}

export type RankingPoint = { date: string; position: number };
export function evaluateRankingDrop(args: {
  history: RankingPoint[];
  params: RankingDropParams;
}): { dropped: boolean; from: number; to: number } | null {
  if (args.history.length < 2) return null;
  const sorted = [...args.history].sort((a, b) => a.date.localeCompare(b.date));
  const from = sorted[sorted.length - 2]!.position;
  const to = sorted[sorted.length - 1]!.position;
  if (to - from >= args.params.minPositionDelta) return { dropped: true, from, to };
  return null;
}
