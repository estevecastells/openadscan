import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary"],
      // We unit-test the pure-logic surface fully. DB-bound modules (recommender,
      // snapshot, dispatcher, ingest, monitor) are exercised end-to-end via the
      // seed + `wrangler dev` integration flow documented in the README, since
      // they require a real D1 binding to exercise meaningfully.
      include: [
        "src/lib/crypto.ts",
        "src/lib/csv.ts",
        "src/lib/http.ts",
        "src/lib/kv.ts",
        "src/lib/queue.ts",
        "src/lib/stats.ts",
        "src/lib/time.ts",
        "src/features/nklg/evaluator.ts",
        "src/features/nklg/config.ts",
        "src/features/brand-monitor/analyzer.ts",
        "src/features/brand-monitor/hijack.ts",
        "src/features/alerts/rules.ts",
        "src/connectors/google-ads/oauth.ts",
        "src/connectors/google-ads/queries.ts",
        "src/connectors/search-console/oauth.ts",
        "src/connectors/dataforseo/serp.ts",
      ],
      thresholds: {
        statements: 80,
        branches: 75,
        functions: 80,
        lines: 80,
      },
    },
  },
  resolve: {
    alias: { "@": new URL("./src/", import.meta.url).pathname },
  },
});
