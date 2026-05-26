/**
 * Bindings & secrets exposed to every request. Mirrors wrangler.toml.
 *
 * Cloudflare's typed bindings are accessed as `c.env.<name>` inside route handlers
 * and as `env` inside cron/queue handlers.
 */
export type Bindings = {
  // bindings
  DB: D1Database;
  KV: KVNamespace;
  INGEST_QUEUE: Queue<IngestMessage>;
  ASSETS: Fetcher;

  // vars
  ADMIN_EMAIL: string;
  PUBLIC_BASE_URL: string;
  DATAFORSEO_DAILY_BUDGET_USD: string;
  DEFAULT_LOCALE: string;
  NODE_ENV: string;

  // secrets
  SESSION_SECRET: string;
  ENCRYPTION_KEY: string;
  GOOGLE_OAUTH_CLIENT_ID: string;
  GOOGLE_OAUTH_CLIENT_SECRET: string;
  GOOGLE_ADS_DEVELOPER_TOKEN: string;
  RESEND_API_KEY?: string;
  SLACK_WEBHOOK_URL?: string;
};

export type Variables = {
  user?: { id: string; email: string };
};

export type AppEnv = { Bindings: Bindings; Variables: Variables };

/**
 * Payload shape for every message dropped on INGEST_QUEUE.
 * Each job kind has its own discriminator so the consumer can route.
 */
export type IngestMessage =
  | { kind: "pull-ads"; connectionId: string; from: string; to: string }
  | { kind: "pull-gsc"; connectionId: string; propertyId: string; date: string }
  | { kind: "pull-serp"; brandTermId: string; country: string; language: string; device: "desktop" | "mobile" }
  | { kind: "evaluate-nklg"; brandId: string }
  | { kind: "evaluate-cannibalization"; brandId: string }
  | { kind: "evaluate-incrementality"; brandId: string }
  | { kind: "evaluate-alerts" };

export function envBudgetUsd(env: Bindings): number {
  const n = Number.parseFloat(env.DATAFORSEO_DAILY_BUDGET_USD ?? "0");
  return Number.isFinite(n) ? n : 0;
}
