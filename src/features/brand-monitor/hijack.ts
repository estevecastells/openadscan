/**
 * Brand hijacking detection: a competitor's ad copy contains the brand name.
 * Returns the offending ads with the matched brand token so the UI can
 * highlight them.
 */
import type { SerpAd } from "@/connectors/dataforseo/serp";
import { normalizeDomain } from "./analyzer";

export type HijackHit = { ad: SerpAd; matched: string };

export function detectHijacks(args: {
  ourDomain: string;
  brandTokens: string[]; // e.g. ["acme", "acme corp"]
  ads: SerpAd[];
  allowlistDomains?: string[];
}): HijackHit[] {
  const ours = normalizeDomain(args.ourDomain);
  const allow = new Set((args.allowlistDomains ?? []).map(normalizeDomain));
  const hits: HijackHit[] = [];
  const lcTokens = args.brandTokens.map((t) => t.toLowerCase()).filter(Boolean);
  for (const ad of args.ads) {
    const dom = normalizeDomain(ad.domain);
    if (!dom || dom === ours || allow.has(dom)) continue;
    const blob = `${ad.title ?? ""} ${ad.description ?? ""} ${ad.displayUrl ?? ""}`.toLowerCase();
    for (const tok of lcTokens) {
      if (blob.includes(tok)) {
        hits.push({ ad, matched: tok });
        break;
      }
    }
  }
  return hits;
}
