import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchWithRetry } from "../../src/lib/http";
import { mockFetch, status } from "../helpers/mock-fetch";

afterEach(() => {
  vi.useRealTimers();
});

describe("fetchWithRetry", () => {
  it("returns 2xx immediately", async () => {
    const { restore } = mockFetch({ "GET https://x/y": () => new Response("ok", { status: 200 }) });
    const res = await fetchWithRetry("https://x/y", { retries: 1, baseDelayMs: 1 });
    expect(res.status).toBe(200);
    restore();
  });

  it("retries on 500 then succeeds", async () => {
    let count = 0;
    const { restore, calls } = mockFetch({
      "GET https://x/y": () => {
        count += 1;
        return count < 2 ? status(500) : new Response("ok", { status: 200 });
      },
    });
    const res = await fetchWithRetry("https://x/y", { retries: 3, baseDelayMs: 1 });
    expect(res.status).toBe(200);
    expect(calls.length).toBe(2);
    restore();
  });

  it("returns the last response after exhausting retries on 500", async () => {
    const { restore } = mockFetch({ "GET https://x/y": () => status(500) });
    const res = await fetchWithRetry("https://x/y", { retries: 1, baseDelayMs: 1 });
    expect(res.status).toBe(500);
    restore();
  });

  it("throws on persistent network errors", async () => {
    const orig = globalThis.fetch;
    globalThis.fetch = (() => Promise.reject(new Error("boom"))) as typeof fetch;
    await expect(fetchWithRetry("https://x/y", { retries: 1, baseDelayMs: 1 })).rejects.toThrow(/boom/);
    globalThis.fetch = orig;
  });
});
