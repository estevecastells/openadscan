import { describe, expect, it } from "vitest";
import {
  evaluateCompetitorNew,
  evaluateCompetitorReturning,
  evaluateRankingDrop,
} from "../../src/features/alerts/rules";
import { renderAlertText } from "../../src/features/alerts/dispatcher";

describe("alert rules", () => {
  it("evaluateCompetitorNew filters to first-seen in window", () => {
    const out = evaluateCompetitorNew({
      observations: [
        { domain: "old.com", firstSeenAt: "2026-01-01", lastSeenAt: "2026-05-26", daysAbsentBeforeReturn: 0 },
        { domain: "new.com", firstSeenAt: "2026-05-26", lastSeenAt: "2026-05-26", daysAbsentBeforeReturn: 0 },
      ],
      windowStart: "2026-05-25",
    });
    expect(out).toEqual([{ domain: "new.com" }]);
  });

  it("evaluateCompetitorReturning respects minAbsenceDays", () => {
    const out = evaluateCompetitorReturning({
      observations: [
        { domain: "a.com", firstSeenAt: "2026-01-01", lastSeenAt: "2026-05-26", daysAbsentBeforeReturn: 21 },
        { domain: "b.com", firstSeenAt: "2026-01-01", lastSeenAt: "2026-05-26", daysAbsentBeforeReturn: 2 },
      ],
      params: { brandId: "x", minAbsenceDays: 14 },
    });
    expect(out).toEqual([{ domain: "a.com", daysAbsent: 21 }]);
  });

  it("evaluateRankingDrop returns null with no history", () => {
    expect(evaluateRankingDrop({ history: [], params: { minPositionDelta: 2 } })).toBe(null);
  });

  it("evaluateRankingDrop fires on a sufficient drop", () => {
    const out = evaluateRankingDrop({
      history: [
        { date: "2026-05-25", position: 1.2 },
        { date: "2026-05-26", position: 4.5 },
      ],
      params: { minPositionDelta: 2 },
    });
    expect(out).toEqual({ dropped: true, from: 1.2, to: 4.5 });
  });

  it("evaluateRankingDrop ignores tiny moves", () => {
    expect(
      evaluateRankingDrop({
        history: [
          { date: "2026-05-25", position: 1.2 },
          { date: "2026-05-26", position: 1.7 },
        ],
        params: { minPositionDelta: 2 },
      }),
    ).toBe(null);
  });
});

describe("renderAlertText", () => {
  it("renders competitor_new", () => {
    expect(renderAlertText("competitor_new", { domain: "x.com" })).toContain("x.com");
  });
  it("renders ranking_drop", () => {
    expect(renderAlertText("ranking_drop", { query: "q", from: 1, to: 6 })).toContain("q");
  });
  it("renders nklg_re_enable", () => {
    expect(renderAlertText("nklg_re_enable", { keyword: "k", competitorDensity: 1.5 })).toContain("k");
  });
  it("falls back to JSON for unknown types", () => {
    expect(renderAlertText("nope", { x: 1 })).toBe('{"x":1}');
  });
});
