/**
 * The Search Console client is an HTTPS wrapper around webmasters.googleapis.
 * Unit tests for the fetcher logic would need a fake D1 to wire connection
 * state, so we exercise it via the integration tests in tests/integration.
 *
 * Here we lock down the OAuth re-export surface.
 */
import { describe, expect, it } from "vitest";
import { buildAuthUrl, GSC_SCOPES } from "../../src/connectors/search-console/oauth";
import type { Bindings } from "../../src/env";

describe("GSC OAuth helpers", () => {
  it("exposes the webmasters.readonly scope", () => {
    expect(GSC_SCOPES[0]).toBe("https://www.googleapis.com/auth/webmasters.readonly");
  });
  it("buildAuthUrl forwards through to Google", () => {
    const url = buildAuthUrl({
      env: { GOOGLE_OAUTH_CLIENT_ID: "x", GOOGLE_OAUTH_CLIENT_SECRET: "y" } as unknown as Bindings,
      redirectUri: "https://localhost/cb",
      state: "s",
      scopes: GSC_SCOPES,
    });
    expect(url).toMatch(/scope=https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fwebmasters.readonly/);
  });
});
