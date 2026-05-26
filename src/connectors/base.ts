import type { Bindings } from "@/env";

export type ConnectorType = "google_ads" | "search_console" | "dataforseo";

export interface Connector<Config = Record<string, unknown>> {
  type: ConnectorType;
  /** Verify credentials and return human-readable account/property labels. */
  test(env: Bindings, config: Config): Promise<{ ok: true; accounts: { id: string; label: string }[] } | { ok: false; error: string }>;
  /** Trigger a one-off ingestion run. Implementations enqueue per-shard jobs. */
  ingest(env: Bindings, connectionId: string): Promise<{ enqueued: number }>;
}
