import { describe, expect, it } from "vitest";
import { addDfsSpend, getDfsSpend, kvDelete, kvGet, kvPut } from "../../src/lib/kv";
import type { Bindings } from "../../src/env";

function makeKv(): KVNamespace & { _store: Map<string, string> } {
  const store = new Map<string, string>();
  return {
    _store: store,
    async get(key: string, type?: "json") {
      const v = store.get(key);
      if (v === undefined) return null;
      return type === "json" ? JSON.parse(v) : v;
    },
    async put(key: string, value: string) {
      store.set(key, value);
    },
    async delete(key: string) {
      store.delete(key);
    },
  } as unknown as KVNamespace & { _store: Map<string, string> };
}

function makeEnv(): Bindings {
  return { KV: makeKv() } as unknown as Bindings;
}

describe("KV helpers", () => {
  it("kvPut/kvGet round-trip", async () => {
    const env = makeEnv();
    await kvPut(env, "k", { hello: 1 });
    expect(await kvGet<{ hello: number }>(env, "k")).toEqual({ hello: 1 });
  });
  it("kvDelete removes the key", async () => {
    const env = makeEnv();
    await kvPut(env, "k", 42);
    await kvDelete(env, "k");
    expect(await kvGet(env, "k")).toBe(null);
  });
  it("addDfsSpend accumulates within a day", async () => {
    const env = makeEnv();
    expect(await getDfsSpend(env)).toBe(0);
    await addDfsSpend(env, 0.1);
    await addDfsSpend(env, 0.05);
    expect((await getDfsSpend(env)) ?? 0).toBeCloseTo(0.15, 5);
  });
});
