/**
 * DataForSEO REST client with a daily budget guard.
 *
 * Each request returns its USD cost in the response payload (`cost` field).
 * We accumulate it in KV under cost:dfs:YYYY-MM-DD and refuse new calls once
 * DATAFORSEO_DAILY_BUDGET_USD is exceeded.
 */
import type { Bindings } from "@/env";
import { envBudgetUsd } from "@/env";
import { fetchWithRetry } from "@/lib/http";
import { addDfsSpend, getDfsSpend, kvGet, kvPut } from "@/lib/kv";
import type { DataForSeoConfig, DfsApiResponse } from "./types";

const BASE = "https://api.dataforseo.com";

function authHeader(cfg: DataForSeoConfig): string {
  return `Basic ${btoa(`${cfg.login}:${cfg.password}`)}`;
}

export class BudgetExceeded extends Error {
  constructor(public spent: number, public limit: number) {
    super(`DataForSEO daily budget exceeded: spent $${spent.toFixed(4)} of $${limit.toFixed(2)}`);
  }
}

async function ensureBudget(env: Bindings): Promise<void> {
  const limit = envBudgetUsd(env);
  if (limit <= 0) return;
  const spent = await getDfsSpend(env);
  if (spent >= limit) throw new BudgetExceeded(spent, limit);
}

export async function dfsPost<T>(args: {
  env: Bindings;
  cfg: DataForSeoConfig;
  path: string;
  body: unknown;
  cacheKey?: string;
  cacheTtlSec?: number;
}): Promise<DfsApiResponse<T>> {
  if (args.cacheKey) {
    const cached = await kvGet<DfsApiResponse<T>>(args.env, args.cacheKey);
    if (cached) return cached;
  }
  await ensureBudget(args.env);
  const res = await fetchWithRetry(`${BASE}${args.path}`, {
    method: "POST",
    headers: { Authorization: authHeader(args.cfg), "content-type": "application/json" },
    body: JSON.stringify(args.body),
  });
  if (!res.ok) throw new Error(`DataForSEO ${args.path} ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as DfsApiResponse<T>;
  if (typeof json.cost === "number" && json.cost > 0) {
    await addDfsSpend(args.env, json.cost);
  }
  if (args.cacheKey) await kvPut(args.env, args.cacheKey, json, { ttlSec: args.cacheTtlSec ?? 60 * 60 * 24 });
  return json;
}
