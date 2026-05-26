import { describe, expect, it } from "vitest";
import { average, nklgConfidence, sum, wilsonLowerBound } from "../../src/lib/stats";

describe("wilsonLowerBound", () => {
  it("returns 0 when total is 0", () => {
    expect(wilsonLowerBound(0, 0)).toBe(0);
  });
  it("collapses toward 0 for low-sample 100% rates", () => {
    expect(wilsonLowerBound(1, 1)).toBeLessThan(0.5);
  });
  it("approaches the true rate for big samples", () => {
    const bound = wilsonLowerBound(500, 1000);
    expect(bound).toBeGreaterThan(0.4);
    expect(bound).toBeLessThan(0.5);
  });
  it("is monotonic in sample size", () => {
    const small = wilsonLowerBound(8, 10);
    const big = wilsonLowerBound(800, 1000);
    expect(big).toBeGreaterThan(small);
  });
});

describe("nklgConfidence", () => {
  it("returns 0 when no impressions and no observation history", () => {
    const c = nklgConfidence({
      organicCtr: 0,
      organicImpressions: 0,
      organicPosition: 50,
      paidCompetitorDensity: 5,
      daysObserved: 0,
    });
    expect(c).toBeLessThanOrEqual(0.1);
  });
  it("rewards strong organic + no competitors + 28 days", () => {
    const c = nklgConfidence({
      organicCtr: 0.5,
      organicImpressions: 4000,
      organicPosition: 1,
      paidCompetitorDensity: 0,
      daysObserved: 28,
    });
    expect(c).toBeGreaterThan(0.6);
  });
  it("penalises competitor density", () => {
    const withComp = nklgConfidence({
      organicCtr: 0.5,
      organicImpressions: 4000,
      organicPosition: 1,
      paidCompetitorDensity: 3,
      daysObserved: 28,
    });
    const without = nklgConfidence({
      organicCtr: 0.5,
      organicImpressions: 4000,
      organicPosition: 1,
      paidCompetitorDensity: 0,
      daysObserved: 28,
    });
    expect(without).toBeGreaterThan(withComp);
  });
});

describe("sum / average", () => {
  it("sum returns 0 on empty input", () => {
    expect(sum([])).toBe(0);
  });
  it("average returns 0 on empty input", () => {
    expect(average([])).toBe(0);
  });
  it("computes correct sum + avg", () => {
    expect(sum([1, 2, 3, 4])).toBe(10);
    expect(average([2, 4, 6])).toBe(4);
  });
});
