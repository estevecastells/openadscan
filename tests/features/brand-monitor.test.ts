import { describe, expect, it } from "vitest";
import { analyzeSerpAgainstBrand, normalizeDomain } from "../../src/features/brand-monitor/analyzer";
import { detectHijacks } from "../../src/features/brand-monitor/hijack";

describe("normalizeDomain", () => {
  it("strips www and lowercases", () => {
    expect(normalizeDomain("WWW.ACME.com")).toBe("acme.com");
  });
});

describe("analyzeSerpAgainstBrand", () => {
  it("identifies our ad position and competitors", () => {
    const facts = analyzeSerpAgainstBrand({
      ourDomain: "acme.com",
      ads: [
        { position: 1, domain: "competitor-a.com" },
        { position: 2, domain: "acme.com" },
        { position: 3, domain: "competitor-b.com" },
      ],
      organic: [
        { position: 1, domain: "acme.com" },
        { position: 2, domain: "wikipedia.org" },
        { position: 3, domain: "another.com" },
      ],
    });
    expect(facts.ourTopAdPos).toBe(2);
    expect(facts.competitorCount).toBe(2);
    expect(facts.topCompetitorDomain).toBe("competitor-a.com");
    expect(facts.ourOrganicTop3).toBe(true);
    expect(facts.sovPaid).toBeCloseTo(1 / 3, 5);
    expect(facts.sovOrganic).toBeCloseTo(1 / 3, 5);
  });

  it("returns null top ad when we have none", () => {
    const facts = analyzeSerpAgainstBrand({
      ourDomain: "acme.com",
      ads: [{ position: 1, domain: "competitor.com" }],
      organic: [],
    });
    expect(facts.ourTopAdPos).toBe(null);
    expect(facts.sovOrganic).toBe(0);
  });

  it("ignores blank-domain rows", () => {
    const facts = analyzeSerpAgainstBrand({
      ourDomain: "acme.com",
      ads: [{ position: 1, domain: "" }],
      organic: [],
    });
    expect(facts.competitorCount).toBe(0);
  });
});

describe("detectHijacks", () => {
  it("flags ads from non-allowed domains using brand token", () => {
    const hits = detectHijacks({
      ourDomain: "acme.com",
      brandTokens: ["acme"],
      ads: [
        { position: 1, domain: "evil.com", title: "Buy Acme shoes cheap!" },
        { position: 2, domain: "acme.com", title: "Acme — official" },
        { position: 3, domain: "ally.com", title: "Acme reseller" },
      ],
      allowlistDomains: ["ally.com"],
    });
    expect(hits).toHaveLength(1);
    expect(hits[0]!.ad.domain).toBe("evil.com");
    expect(hits[0]!.matched).toBe("acme");
  });

  it("returns empty if no token matches", () => {
    const hits = detectHijacks({
      ourDomain: "acme.com",
      brandTokens: ["acme"],
      ads: [{ position: 1, domain: "evil.com", title: "Generic shoes" }],
    });
    expect(hits).toHaveLength(0);
  });
});
