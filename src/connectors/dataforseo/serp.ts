import type { Bindings } from "@/env";
import { dfsPost } from "./client";
import type { DataForSeoConfig, DfsSerpItem, DfsSerpTask } from "./types";

const COUNTRY_TO_LOCATION_CODE: Record<string, number> = {
  US: 2840,
  GB: 2826,
  DE: 2276,
  FR: 2250,
  ES: 2724,
  IT: 2380,
  NL: 2528,
  BE: 2056,
  SE: 2752,
  NO: 2578,
  DK: 2208,
  FI: 2246,
  PT: 2620,
  AT: 2040,
  CH: 2756,
  PL: 2616,
  CA: 2124,
  AU: 2036,
  BR: 2076,
  MX: 2484,
  AR: 2032,
  JP: 2392,
  IN: 2356,
  // fallback: 0 (DataForSEO will use language_code only)
};

export function locationCode(country: string): number {
  return COUNTRY_TO_LOCATION_CODE[country.toUpperCase()] ?? 2840;
}

export type SerpAd = {
  position: number;
  domain: string;
  title?: string;
  description?: string;
  displayUrl?: string;
  url?: string;
};
export type SerpOrganic = {
  position: number;
  domain: string;
  url?: string;
  title?: string;
};
export type ParsedSerp = {
  query: string;
  cost: number;
  ads: SerpAd[];
  organic: SerpOrganic[];
};

function domainOf(item: DfsSerpItem): string {
  if (item.domain) return item.domain;
  if (item.url) {
    try {
      return new URL(item.url).hostname.replace(/^www\./, "");
    } catch {
      return "";
    }
  }
  return "";
}

export async function fetchSerp(args: {
  env: Bindings;
  cfg: DataForSeoConfig;
  keyword: string;
  country: string;
  language: string;
  device: "desktop" | "mobile";
}): Promise<ParsedSerp> {
  const body = [
    {
      keyword: args.keyword,
      location_code: locationCode(args.country),
      language_code: args.language,
      device: args.device,
      depth: 30,
    },
  ];
  const cacheKey = `serp:${args.keyword}:${args.country}:${args.language}:${args.device}:${new Date().toISOString().slice(0, 10)}`;
  const res = await dfsPost<DfsSerpTask>({
    env: args.env,
    cfg: args.cfg,
    path: "/v3/serp/google/organic/live/advanced",
    body,
    cacheKey,
    cacheTtlSec: 60 * 60 * 12,
  });
  const task = res.tasks?.[0];
  if (!task || !task.result?.[0]) {
    return { query: args.keyword, cost: res.cost ?? 0, ads: [], organic: [] };
  }
  const items = task.result[0].items ?? [];
  const ads: SerpAd[] = [];
  const organic: SerpOrganic[] = [];
  let adIdx = 0;
  let orgIdx = 0;
  for (const item of items) {
    if (item.type === "paid" || item.type === "ad") {
      adIdx += 1;
      ads.push({
        position: adIdx,
        domain: domainOf(item),
        title: item.title,
        description: item.description,
        displayUrl: item.display_url,
        url: item.url,
      });
    } else if (item.type === "organic") {
      orgIdx += 1;
      organic.push({
        position: orgIdx,
        domain: domainOf(item),
        url: item.url,
        title: item.title,
      });
    }
  }
  return { query: args.keyword, cost: res.cost ?? 0, ads, organic };
}
