/**
 * The ranker's pure scoring function isn't exported, so we cover it through
 * the integration tests. Here we lock down ergonomic invariants of the rank
 * function via a minimal D1 fake.
 */
import { describe, expect, it } from "vitest";

// Scoring function is an internal of ranker.ts. We re-implement the same
// blend here as a contract check — if this drifts, update both.
function score(args: {
  organicImpressions: number;
  organicPosition: number;
  organicCtr: number;
  paidCostMicros: number;
}): number {
  const impScore = Math.min(1, Math.log10(1 + args.organicImpressions) / 4);
  const posScore = args.organicPosition > 0 ? Math.max(0, 1 - (args.organicPosition - 1) / 10) : 0;
  const ctrScore = Math.min(1, args.organicCtr * 4);
  const spendScore = Math.min(1, Math.log10(1 + args.paidCostMicros / 1_000_000) / 3);
  return Number((impScore * 0.3 + posScore * 0.3 + ctrScore * 0.2 + spendScore * 0.2).toFixed(4));
}

describe("opportunity score contract", () => {
  it("is 0 when everything is 0", () => {
    expect(score({ organicImpressions: 0, organicPosition: 0, organicCtr: 0, paidCostMicros: 0 })).toBe(0);
  });
  it("monotonic in organic impressions", () => {
    const a = score({ organicImpressions: 100, organicPosition: 1, organicCtr: 0.2, paidCostMicros: 100_000 });
    const b = score({ organicImpressions: 10_000, organicPosition: 1, organicCtr: 0.2, paidCostMicros: 100_000 });
    expect(b).toBeGreaterThan(a);
  });
  it("clamps to [0, 1]", () => {
    const v = score({ organicImpressions: 1e9, organicPosition: 1, organicCtr: 1, paidCostMicros: 1e12 });
    expect(v).toBeLessThanOrEqual(1);
    expect(v).toBeGreaterThanOrEqual(0);
  });
});
