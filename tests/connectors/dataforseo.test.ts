import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { webcrypto } from "node:crypto";
import { fetchSerp, locationCode } from "../../src/connectors/dataforseo/serp";
import type { Bindings } from "../../src/env";
import { json, mockFetch } from "../helpers/mock-fetch";

if (!(globalThis as { crypto?: unknown }).crypto) {
  Object.defineProperty(globalThis, "crypto", { value: webcrypto });
}

function makeKv(): KVNamespace & { _store: Map<string, string> } {
  const store = new Map<string, string>();
  return {
    _store: store,
    async get(key: string, type?: "json") {
      const v = store.get(key);
      return v === undefined ? null : type === "json" ? JSON.parse(v) : v;
    },
    async put(key: string, value: string) {
      store.set(key, value);
    },
    async delete(key: string) {
      store.delete(key);
    },
  } as unknown as KVNamespace & { _store: Map<string, string> };
}

function env(): Bindings {
  return {
    KV: makeKv(),
    DATAFORSEO_DAILY_BUDGET_USD: "5.00",
  } as unknown as Bindings;
}

let restore: (() => void) | null = null;
afterEach(() => {
  restore?.();
  restore = null;
});

describe("locationCode", () => {
  it("returns the right code for known countries", () => {
    expect(locationCode("US")).toBe(2840);
    expect(locationCode("gb")).toBe(2826);
  });
  it("falls back to 2840 (US) for unknown", () => {
    expect(locationCode("ZZ")).toBe(2840);
  });
});

describe("fetchSerp", () => {
  const cfg = { login: "u", password: "p" };

  it("parses ads and organic items from the response", async () => {
    const m = mockFetch({
      "POST match:/v3/serp/google/organic/live/advanced": () =>
        json({
          status_code: 20000,
          status_message: "Ok.",
          cost: 0.002,
          tasks: [
            {
              status_code: 20000,
              status_message: "Ok.",
              cost: 0.002,
              result: [
                {
                  keyword: "acme",
                  type: "organic",
                  se_domain: "google.com",
                  location_code: 2840,
                  language_code: "en",
                  items: [
                    { type: "paid", domain: "competitor.com", title: "Competitor ad" },
                    { type: "organic", domain: "acme.com", url: "https://acme.com" },
                    { type: "organic", url: "https://example.com" },
                    { type: "people_also_ask" },
                  ],
                },
              ],
            },
          ],
        }),
    });
    restore = m.restore;
    const out = await fetchSerp({ env: env(), cfg, keyword: "acme", country: "US", language: "en", device: "desktop" });
    expect(out.ads).toHaveLength(1);
    expect(out.ads[0]!.domain).toBe("competitor.com");
    expect(out.organic).toHaveLength(2);
    expect(out.organic[1]!.domain).toBe("example.com"); // extracted from URL
    expect(out.cost).toBeCloseTo(0.002, 5);
  });

  it("handles empty results gracefully", async () => {
    const m = mockFetch({
      "POST match:/v3/serp/google/organic/live/advanced": () =>
        json({ status_code: 20000, status_message: "Ok.", cost: 0, tasks: [] }),
    });
    restore = m.restore;
    const out = await fetchSerp({ env: env(), cfg, keyword: "x", country: "US", language: "en", device: "desktop" });
    expect(out.ads).toEqual([]);
    expect(out.organic).toEqual([]);
  });

  it("caches identical fetches in KV (no second HTTP call)", async () => {
    const m = mockFetch({
      "POST match:/v3/serp/google/organic/live/advanced": () =>
        json({ status_code: 20000, status_message: "Ok.", cost: 0.001, tasks: [] }),
    });
    restore = m.restore;
    const e = env();
    await fetchSerp({ env: e, cfg, keyword: "acme", country: "US", language: "en", device: "desktop" });
    const callsBefore = m.calls.length;
    await fetchSerp({ env: e, cfg, keyword: "acme", country: "US", language: "en", device: "desktop" });
    expect(m.calls.length).toBe(callsBefore); // cached, no extra call
  });

  it("throws BudgetExceeded when daily budget is hit", async () => {
    const m = mockFetch({ "POST match:/v3/serp/google/organic/live/advanced": () => json({ tasks: [], cost: 0 }) });
    restore = m.restore;
    const e = env();
    // pre-load the spend above budget
    await e.KV.put(`cost:dfs:${new Date().toISOString().slice(0, 10)}`, JSON.stringify(10));
    await expect(
      fetchSerp({ env: e, cfg, keyword: "x", country: "US", language: "en", device: "desktop" }),
    ).rejects.toThrow(/budget exceeded/i);
  });
});
