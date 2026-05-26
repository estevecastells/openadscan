/**
 * Typed KV helpers. We treat KV as the cache for SERP responses, the OAuth-state
 * scratchpad, and the DataForSEO daily-cost ledger.
 */
import type { Bindings } from "@/env";

export async function kvGet<T>(env: Bindings, key: string): Promise<T | null> {
  const v = await env.KV.get(key, "json");
  return (v as T | null) ?? null;
}

export async function kvPut<T>(
  env: Bindings,
  key: string,
  value: T,
  options: { ttlSec?: number } = {},
): Promise<void> {
  await env.KV.put(key, JSON.stringify(value), {
    expirationTtl: options.ttlSec,
  });
}

export async function kvDelete(env: Bindings, key: string): Promise<void> {
  await env.KV.delete(key);
}

/* ----- DataForSEO daily cost ledger -----
 * Key shape: cost:dfs:YYYY-MM-DD. Value: number (USD).
 */

function todayKey(now = new Date()): string {
  return `cost:dfs:${now.toISOString().slice(0, 10)}`;
}

export async function getDfsSpend(env: Bindings): Promise<number> {
  return (await kvGet<number>(env, todayKey())) ?? 0;
}

export async function addDfsSpend(env: Bindings, amountUsd: number): Promise<number> {
  const key = todayKey();
  const current = (await kvGet<number>(env, key)) ?? 0;
  const next = current + amountUsd;
  await kvPut(env, key, next, { ttlSec: 60 * 60 * 48 });
  return next;
}
