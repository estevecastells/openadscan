import type { Bindings } from "@/env";
import { dfsPost } from "./client";
import { locationCode } from "./serp";
import type { DataForSeoConfig } from "./types";

export async function serpCompetitors(args: {
  env: Bindings;
  cfg: DataForSeoConfig;
  keywords: string[];
  country: string;
  language: string;
  limit?: number;
}): Promise<Array<{ domain: string; intersections: number; avg_position: number }>> {
  if (args.keywords.length === 0) return [];
  const body = [
    {
      keywords: args.keywords.slice(0, 200),
      location_code: locationCode(args.country),
      language_code: args.language,
      limit: args.limit ?? 50,
    },
  ];
  const cacheKey = `comp:serp:${args.country}:${args.language}:${args.keywords.join("|").slice(0, 256)}`;
  const res = await dfsPost<{
    result?: Array<{
      items?: Array<{ domain: string; intersections: number; avg_position: number }>;
    }>;
  }>({
    env: args.env,
    cfg: args.cfg,
    path: "/v3/dataforseo_labs/google/serp_competitors/live",
    body,
    cacheKey,
    cacheTtlSec: 60 * 60 * 24 * 3,
  });
  return res.tasks?.[0]?.result?.flatMap((r) => r.items ?? []) ?? [];
}
