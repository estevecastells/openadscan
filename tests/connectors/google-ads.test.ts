import { afterEach, describe, expect, it } from "vitest";
import { keywordPerformanceGAQL, paidOrganicGAQL, searchTermGAQL } from "../../src/connectors/google-ads/queries";
import { buildAuthUrl, exchangeCode, refreshAccessToken, GOOGLE_ADS_SCOPES } from "../../src/connectors/google-ads/oauth";
import { json, mockFetch } from "../helpers/mock-fetch";
import type { Bindings } from "../../src/env";

function env(): Bindings {
  return {
    GOOGLE_OAUTH_CLIENT_ID: "client",
    GOOGLE_OAUTH_CLIENT_SECRET: "secret",
  } as unknown as Bindings;
}

let restore: (() => void) | null = null;
afterEach(() => {
  restore?.();
  restore = null;
});

describe("GAQL templates", () => {
  it("renders keyword performance with dates and ENABLED filter", () => {
    const q = keywordPerformanceGAQL("2026-05-01", "2026-05-27");
    expect(q).toMatch(/segments.date BETWEEN '2026-05-01' AND '2026-05-27'/);
    expect(q).toMatch(/ad_group_criterion.status = 'ENABLED'/);
  });
  it("renders search-term GAQL", () => {
    const q = searchTermGAQL("2026-05-01", "2026-05-27");
    expect(q).toMatch(/FROM search_term_view/);
  });
  it("renders paid+organic GAQL", () => {
    const q = paidOrganicGAQL("2026-05-01", "2026-05-27");
    expect(q).toMatch(/FROM paid_organic_search_term_view/);
  });
});

describe("buildAuthUrl", () => {
  it("includes the right scopes, state and offline access", () => {
    const url = buildAuthUrl({
      env: env(),
      redirectUri: "https://localhost/cb",
      state: "abc",
      scopes: GOOGLE_ADS_SCOPES,
    });
    const u = new URL(url);
    expect(u.origin + u.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(u.searchParams.get("scope")).toBe(GOOGLE_ADS_SCOPES.join(" "));
    expect(u.searchParams.get("access_type")).toBe("offline");
    expect(u.searchParams.get("state")).toBe("abc");
  });
});

describe("exchangeCode / refreshAccessToken", () => {
  it("posts form-encoded body and parses JSON", async () => {
    const m = mockFetch({
      "POST https://oauth2.googleapis.com/token": (req) => {
        return json({ access_token: "a", refresh_token: "r", expires_in: 3600, scope: "x" });
      },
    });
    restore = m.restore;
    const out = await exchangeCode({ env: env(), code: "c", redirectUri: "u" });
    expect(out.access_token).toBe("a");
    expect(out.refresh_token).toBe("r");
  });

  it("refreshAccessToken parses 200 OK", async () => {
    const m = mockFetch({
      "POST https://oauth2.googleapis.com/token": () => json({ access_token: "new", expires_in: 3600 }),
    });
    restore = m.restore;
    const out = await refreshAccessToken({ env: env(), refreshToken: "r" });
    expect(out.access_token).toBe("new");
  });

  it("exchangeCode throws on non-2xx", async () => {
    const m = mockFetch({ "POST https://oauth2.googleapis.com/token": () => new Response("bad", { status: 400 }) });
    restore = m.restore;
    await expect(exchangeCode({ env: env(), code: "c", redirectUri: "u" })).rejects.toThrow(/code exchange failed/);
  });
});
