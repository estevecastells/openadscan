/**
 * Brand monitor — parses a SERP snapshot into "us vs them" facts.
 */
import type { SerpAd, SerpOrganic } from "@/connectors/dataforseo/serp";

export type BrandMonitorFacts = {
  ourTopAdPos: number | null;
  competitorCount: number;
  topCompetitorDomain: string | null;
  ourOrganicTop3: boolean;
  sovPaid: number; // 0..1
  sovOrganic: number; // 0..1
};

export function analyzeSerpAgainstBrand(args: {
  ourDomain: string;
  ads: SerpAd[];
  organic: SerpOrganic[];
}): BrandMonitorFacts {
  const ours = normalizeDomain(args.ourDomain);
  let ourTopAdPos: number | null = null;
  let competitorCount = 0;
  const competitorPos = new Map<string, number>();
  for (const a of args.ads) {
    const dom = normalizeDomain(a.domain);
    if (!dom) continue;
    if (sameDomain(dom, ours)) {
      if (ourTopAdPos === null || a.position < ourTopAdPos) ourTopAdPos = a.position;
    } else {
      competitorCount += 1;
      if (!competitorPos.has(dom) || (competitorPos.get(dom) ?? 99) > a.position) {
        competitorPos.set(dom, a.position);
      }
    }
  }
  const topCompetitorDomain = sortByValue(competitorPos)[0] ?? null;
  let ourOrganicTop3 = false;
  let totalOrganicTop = 0;
  let ourOrganicTop = 0;
  for (const o of args.organic.slice(0, 10)) {
    totalOrganicTop += 1;
    if (sameDomain(normalizeDomain(o.domain), ours)) {
      ourOrganicTop += 1;
      if (o.position <= 3) ourOrganicTop3 = true;
    }
  }
  const totalAds = args.ads.length;
  const ourAds = args.ads.filter((a) => sameDomain(normalizeDomain(a.domain), ours)).length;
  const sovPaid = totalAds > 0 ? ourAds / totalAds : 0;
  const sovOrganic = totalOrganicTop > 0 ? ourOrganicTop / totalOrganicTop : 0;
  return { ourTopAdPos, competitorCount, topCompetitorDomain, ourOrganicTop3, sovPaid, sovOrganic };
}

export function normalizeDomain(d: string): string {
  return (d ?? "").toLowerCase().replace(/^www\./, "").trim();
}
function sameDomain(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  return a.endsWith(`.${b}`) || b.endsWith(`.${a}`);
}
function sortByValue(map: Map<string, number>): string[] {
  return [...map.entries()].sort((a, b) => a[1] - b[1]).map(([k]) => k);
}
