import { describe, expect, it } from "vitest";
import { evaluateNKLG, type NKLGObservation } from "../../src/features/nklg/evaluator";
import { DEFAULT_THRESHOLDS } from "../../src/features/nklg/config";

function obs(partial: Partial<NKLGObservation> = {}): NKLGObservation {
  return {
    keyword: "acme",
    country: "US",
    daysObserved: 28,
    avgOrganicPosition: 1,
    organicClicks: 400,
    organicImpressions: 1000,
    paidCompetitorDensity: 0,
    paidCostMicros: 10_000_000,
    paidClicks: 50,
    paidImpressions: 800,
    previouslyApplied: false,
    ...partial,
  };
}

describe("evaluateNKLG", () => {
  it("recommends add_negative when organic strong and no competitors", () => {
    const r = evaluateNKLG(obs());
    expect(r.decision).toBe("add_negative");
    expect(r.savingsOpportunityMicros).toBe(10_000_000);
    expect(r.confidence).toBeGreaterThan(0.4);
  });

  it("recommends keep_paying when organic position is weak", () => {
    const r = evaluateNKLG(obs({ avgOrganicPosition: 8 }));
    expect(r.decision).toBe("keep_paying");
    expect(r.reason).toMatch(/Organic not strong/);
  });

  it("recommends keep_paying when CTR is too low even with good position", () => {
    const r = evaluateNKLG(obs({ avgOrganicPosition: 1, organicClicks: 30, organicImpressions: 1000 }));
    expect(r.decision).toBe("keep_paying");
  });

  it("recommends keep_paying when a competitor is bidding", () => {
    const r = evaluateNKLG(obs({ paidCompetitorDensity: 1 }));
    expect(r.decision).toBe("keep_paying");
    expect(r.reason).toMatch(/competitors are bidding/);
  });

  it("recommends re_enable when previously applied and competitor returns", () => {
    const r = evaluateNKLG(obs({ previouslyApplied: true, paidCompetitorDensity: 2 }));
    expect(r.decision).toBe("re_enable");
    expect(r.reason).toMatch(/Competitor activity returned/);
  });

  it("requires minimum days of observation to add_negative", () => {
    const r = evaluateNKLG(obs({ daysObserved: 3 }));
    expect(r.decision).toBe("keep_paying");
    expect(r.reason).toMatch(/observation history/);
  });

  it("respects custom thresholds", () => {
    // tighten max position to 1, so position=2 now fails
    const r = evaluateNKLG(obs({ avgOrganicPosition: 2 }), { ...DEFAULT_THRESHOLDS, maxOrganicPos: 1 });
    expect(r.decision).toBe("keep_paying");
  });

  it("calculates organic CTR correctly on zero impressions", () => {
    const r = evaluateNKLG(obs({ organicClicks: 0, organicImpressions: 0 }));
    expect(r.organicCtr).toBe(0);
    expect(r.decision).toBe("keep_paying");
  });
});
