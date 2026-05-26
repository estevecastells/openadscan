/** Lightweight stats helpers used by NKLG confidence and incrementality. */

/**
 * Wilson lower bound for a binomial proportion.
 * Used as a CTR confidence floor — with low samples, this collapses toward 0
 * so we don't recommend pausing paid bidding on noise.
 */
export function wilsonLowerBound(successes: number, total: number, z = 1.96): number {
  if (total === 0) return 0;
  const p = successes / total;
  const denom = 1 + (z * z) / total;
  const center = p + (z * z) / (2 * total);
  const margin = z * Math.sqrt((p * (1 - p) + (z * z) / (4 * total)) / total);
  return Math.max(0, (center - margin) / denom);
}

/**
 * Confidence in [0, 1] for an NKLG recommendation given:
 *   - organicCtr observed
 *   - sample size of organic impressions
 *   - density of paid competitors (0 = nobody bidding)
 * A score of 0 means "no confidence", 1 means "extremely confident this is safe to pause".
 */
export function nklgConfidence(args: {
  organicCtr: number;
  organicImpressions: number;
  organicPosition: number;
  paidCompetitorDensity: number;
  daysObserved: number;
}): number {
  const ctrFloor = wilsonLowerBound(
    Math.round(args.organicCtr * args.organicImpressions),
    Math.max(1, args.organicImpressions),
  );
  // position closer to 1 -> higher confidence; 1.0 -> 1.0, 3.0 -> 0.33
  const positionScore = Math.max(0, 1 - (args.organicPosition - 1) / 3);
  const sampleScore = Math.min(1, args.daysObserved / 28);
  const competitorPenalty = args.paidCompetitorDensity <= 0 ? 1 : Math.max(0, 1 - args.paidCompetitorDensity / 2);
  return Math.max(0, Math.min(1, ctrFloor * 0.5 + positionScore * 0.2 + sampleScore * 0.15 + competitorPenalty * 0.15));
}

export function average(xs: number[]): number {
  if (xs.length === 0) return 0;
  let s = 0;
  for (const x of xs) s += x;
  return s / xs.length;
}

export function sum(xs: number[]): number {
  let s = 0;
  for (const x of xs) s += x;
  return s;
}
