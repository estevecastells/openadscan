import { describe, expect, it } from "vitest";
import { computeIncrementality, type IncrementalityInputDay } from "../../src/features/incrementality/analyzer";

function day(p: Partial<IncrementalityInputDay>): IncrementalityInputDay {
  return {
    date: "2026-05-25",
    paidClicks: 0,
    paidImpressions: 0,
    paidCostMicros: 0,
    organicClicks: 0,
    organicImpressions: 0,
    ...p,
  };
}

describe("computeIncrementality", () => {
  it("returns zero CTRs when no observations", () => {
    const r = computeIncrementality([]);
    expect(r.ctrWithSem).toBe(0);
    expect(r.ctrWithoutSem).toBe(0);
    expect(r.incrementalClicks).toBe(0);
  });

  it("identifies paid_on vs paid_off days by paidImpressions", () => {
    const days = [
      day({ date: "1", paidImpressions: 100, paidClicks: 5, paidCostMicros: 1_000_000, organicImpressions: 1000, organicClicks: 200 }),
      day({ date: "2", paidImpressions: 0, paidClicks: 0, paidCostMicros: 0, organicImpressions: 1000, organicClicks: 250 }),
    ];
    const r = computeIncrementality(days);
    expect(r.daysPaidOn).toBe(1);
    expect(r.daysPaidOff).toBe(1);
    expect(r.ctrWithSem).toBeCloseTo(0.2, 5);
    expect(r.ctrWithoutSem).toBeCloseTo(0.25, 5);
  });

  it("computes incremental clicks vs counterfactual", () => {
    const days = [
      day({ paidImpressions: 1000, paidClicks: 100, paidCostMicros: 50_000_000, organicImpressions: 2000, organicClicks: 400 }),
      day({ date: "2", paidImpressions: 0, paidClicks: 0, paidCostMicros: 0, organicImpressions: 2000, organicClicks: 200 }),
    ];
    const r = computeIncrementality(days);
    // ctrWithoutSem = 200/2000 = 0.10
    // counterfactual organic = 1000 * 0.10 = 100
    // incremental = 100 - 100 = 0
    expect(r.incrementalClicks).toBe(0);
  });

  it("clamps incremental at >= 0", () => {
    const days = [
      day({ paidImpressions: 100, paidClicks: 1, paidCostMicros: 0, organicImpressions: 100, organicClicks: 10 }),
      day({ date: "2", paidImpressions: 0, paidClicks: 0, paidCostMicros: 0, organicImpressions: 100, organicClicks: 50 }),
    ];
    const r = computeIncrementality(days);
    expect(r.incrementalClicks).toBeGreaterThanOrEqual(0);
  });

  it("confidence is min(on, off) / 14 clamped to 1", () => {
    const days = [
      day({ paidImpressions: 1 }),
      day({ date: "2", paidImpressions: 1 }),
      day({ date: "3", paidImpressions: 1 }),
      day({ date: "4", paidImpressions: 0 }),
    ];
    const r = computeIncrementality(days);
    expect(r.sampleConfidence).toBeCloseTo(1 / 14, 5);
  });
});
