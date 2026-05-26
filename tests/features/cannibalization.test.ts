import { describe, expect, it } from "vitest";
import { joinCannibalization } from "../../src/features/cannibalization/analyzer";

describe("joinCannibalization", () => {
  const gsc = [
    { query: "acme", date: "2026-05-25", country: "US", clicks: 100, impressions: 1000, position: 1.2 },
    { query: "acme", date: "2026-05-26", country: "US", clicks: 110, impressions: 1100, position: 1.1 },
    { query: "no-paid", date: "2026-05-25", country: "US", clicks: 50, impressions: 800, position: 4.5 },
  ];
  const ads = [
    { keyword: "Acme", date: "2026-05-25", country: "US", clicks: 30, impressions: 400, costMicros: 5_000_000 },
    { keyword: "acme", date: "2026-05-26", country: "US", clicks: 20, impressions: 300, costMicros: 3_000_000 },
  ];

  it("joins keyword case-insensitively on (query, date, country)", () => {
    const out = joinCannibalization({ brandId: "b1", gsc, ads });
    expect(out).toHaveLength(3);
    const day1 = out.find((r) => r.date === "2026-05-25" && r.query === "acme")!;
    expect(day1.paidClicks).toBe(30);
    expect(day1.paidCostMicros).toBe(5_000_000);
    expect(day1.combinedClicks).toBe(130);
  });

  it("returns 0 paid for queries with no matching ad", () => {
    const out = joinCannibalization({ brandId: "b1", gsc, ads });
    const noPaid = out.find((r) => r.query === "no-paid")!;
    expect(noPaid.paidClicks).toBe(0);
    expect(noPaid.combinedClicks).toBe(50);
  });

  it("computes CTR safely on zero impressions", () => {
    const out = joinCannibalization({
      brandId: "b1",
      gsc: [{ query: "x", date: "2026-05-25", country: "US", clicks: 0, impressions: 0, position: 0 }],
      ads: [],
    });
    expect(out[0]!.organicCtr).toBe(0);
  });

  it("deduplicates by composite key", () => {
    const out = joinCannibalization({
      brandId: "b1",
      gsc: [
        { query: "acme", date: "2026-05-25", country: "US", clicks: 1, impressions: 1, position: 1 },
        { query: "acme", date: "2026-05-25", country: "US", clicks: 1, impressions: 1, position: 1 },
      ],
      ads: [],
    });
    expect(out).toHaveLength(1);
  });
});
