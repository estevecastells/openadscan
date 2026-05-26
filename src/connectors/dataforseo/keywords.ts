import type { Bindings } from "@/env";
import { dfsPost } from "./client";
import { locationCode } from "./serp";
import type { DataForSeoConfig, DfsKeywordOverviewItem } from "./types";

export async function keywordOverview(args: {
  env: Bindings;
  cfg: DataForSeoConfig;
  keywords: string[];
  country: string;
  language: string;
}): Promise<DfsKeywordOverviewItem[]> {
  if (args.keywords.length === 0) return [];
  const body = [
    {
      keywords: args.keywords.slice(0, 1000),
      location_code: locationCode(args.country),
      language_code: args.language,
    },
  ];
  const cacheKey = `kw:overview:${args.country}:${args.language}:${args.keywords.join("|").slice(0, 256)}`;
  const res = await dfsPost<{
    result?: Array<{ items?: DfsKeywordOverviewItem[] }>;
  }>({
    env: args.env,
    cfg: args.cfg,
    path: "/v3/dataforseo_labs/google/keyword_overview/live",
    body,
    cacheKey,
    cacheTtlSec: 60 * 60 * 24 * 7,
  });
  const task = res.tasks?.[0];
  const items = task?.result?.flatMap((r) => r.items ?? []) ?? [];
  return items;
}

export async function relatedKeywords(args: {
  env: Bindings;
  cfg: DataForSeoConfig;
  seed: string;
  country: string;
  language: string;
  limit?: number;
}): Promise<string[]> {
  const body = [
    {
      keyword: args.seed,
      location_code: locationCode(args.country),
      language_code: args.language,
      depth: 2,
      limit: args.limit ?? 100,
    },
  ];
  const cacheKey = `kw:related:${args.country}:${args.language}:${args.seed}`;
  const res = await dfsPost<{
    result?: Array<{ items?: Array<{ keyword_data?: { keyword?: string } }> }>;
  }>({
    env: args.env,
    cfg: args.cfg,
    path: "/v3/dataforseo_labs/google/related_keywords/live",
    body,
    cacheKey,
    cacheTtlSec: 60 * 60 * 24 * 7,
  });
  const items = res.tasks?.[0]?.result?.flatMap((r) => r.items ?? []) ?? [];
  return items.map((i) => i.keyword_data?.keyword ?? "").filter(Boolean);
}
