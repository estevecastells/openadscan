# Architecture

openadscan is a single Cloudflare Worker with three handlers:

- **`fetch`** — HonoX-driven UI + API
- **`scheduled`** — cron handler that fans work onto a queue
- **`queue`** — consumer that runs ingestion and evaluation jobs

All persistent state lives in **D1** (relational) and **KV** (cache + ledger). No external infrastructure.

## Data flow

```
Cron Trigger ──▶ src/jobs/scheduler.ts ──▶ INGEST_QUEUE
                                            │
                                            ▼
                                  src/jobs/consumer.ts
                                            │
        ┌───────────────────────────────────┼───────────────────────────────────┐
        ▼                                   ▼                                   ▼
 pull-ads / pull-gsc            pull-serp (DataForSEO)              evaluate-* (NKLG, etc.)
        │                                   │                                   │
        ▼                                   ▼                                   ▼
   D1 fact tables                    serp_snapshots                       derived rollups
        └─────────────────────────────────────┘
                                            │
                                            ▼
                                 evaluate-alerts ─▶ Email / Webhook / Slack
```

## Modules

| Path | Purpose |
|---|---|
| `src/routes/` | HonoX file routes (UI + API) |
| `src/islands/` | Client-side interactive components (charts, NKLG simulator) |
| `src/ui/` | SSR-safe shared components (Card, KPI, Nav) |
| `src/lib/` | Shared utilities: db, kv, queue, crypto, time, stats, csv, http, auth |
| `src/connectors/` | Google Ads, Search Console, DataForSEO clients + OAuth + ingest |
| `src/features/` | Pure feature logic: NKLG, brand-monitor, cannibalization, incrementality, competitors, keywords, alerts |
| `src/jobs/` | Scheduler + queue consumer |
| `src/seed/` | Demo data generator |

## Why this split

Two invariants matter:

1. **Pure logic is in `features/*/analyzer.ts` and `features/*/evaluator.ts`** — they take inputs, return outputs, no IO. Every one of them is unit-tested.
2. **IO lives in `*/recommender.ts`, `*/ingest.ts`, `*/snapshot.ts`** — they wrap the pure logic with DB reads/writes.

This makes the algorithms auditable in isolation and lets us test the substance of the product without spinning up an entire Worker.
