# Open AdScan, the free open source alternative to Adthena

**Self-hosted brand presence and SEO/SEM intelligence** that you deploy on your own Cloudflare account — no third-party dashboards, no per-seat pricing, no data leaving your tenancy.

Open AdScan pulls from **Google Ads**, **Google Search Console** and **DataForSEO**, merges paid and organic signals, watches your brand SERPs continuously, and produces actionable decisions: pause this paid keyword, defend that one, a new competitor just appeared on your brand term, your organic ranking just dropped.

---

## Origin

The seed of this project is **NKLG — the Negative Keyword List Generator** — originally built at **[Adevinta](https://www.adevinta.com/)** by **Marcin**, **Filippo**, **Esteve** and the rest of the **SAI team**. NKLG codified a simple but high-leverage rule:

> *If your organic ranking and CTR are strong, and no paid competitors are bidding on the term, stop paying for that keyword. Reactivate paid bidding the moment a competitor returns.*

Open AdScan generalises that idea into a full platform. The wider framework — measuring the **incrementality** of paid bidding on branded terms versus organic — is documented in the SpeakerDeck *[SEO vs SEM: Final Round](https://speakerdeck.com/estevecastells/seo-vs-sem-final-round-esteve-castells-number-vamostalegon)*.

---

## What you get

- 📡 **Three first-party connectors**: Google Ads (REST API v17), Google Search Console (searchanalytics.query) and DataForSEO (live SERP + Labs)
- 🛡️ **Brand Monitor**: continuous SERP snapshots; SOV, competitor pressure, hijack detection
- 🧮 **NKLG**: the flagship — daily evaluation of every paid keyword against the *organic strong + no competitors* rule, with a Wilson-floor confidence score and CSV export ready for Google Ads
- ⚖️ **Cannibalization**: GSC × Ads merge per query/day, with overlap quantification
- 📈 **Incrementality**: CTR-with-SEM vs CTR-without-SEM, cost per incremental click, scatter chart by query
- 🔭 **Competitor Intel**: leaderboard of domains bidding against you, per-competitor ad-copy history
- 🔑 **Keywords Explorer**: cross-source view with opportunity scoring
- 🚨 **Alerts**: competitor_new, competitor_returning, hijack_detected, ranking_drop, nklg_re_enable, ingestion_failed — delivered via Email (Resend / MailChannels), Webhook (HMAC-signed) or Slack
- ⏰ **Scheduled ingestion**: Cron Triggers fan out to Cloudflare Queues; idempotent, retried with backoff
- 🔒 **OAuth tokens encrypted at rest** with AES-GCM
- 🖥️ **Polished UI**: HonoX SSR + interactive client islands (ECharts), Tailwind, light/dark
- 🧪 **88 passing tests** with **98.95% line coverage** on the pure-logic surface

---

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Language | TypeScript (strict) | Types catch bugs at the connector boundary |
| Runtime | Cloudflare Workers | Single deploy, free tier, no infra ops |
| Web framework | Hono v4 + HonoX | File-based routing + JSX SSR + islands on workerd |
| DB | Cloudflare D1 via Drizzle | Relational, free tier covers small/mid usage |
| Cache + tokens | Cloudflare KV | OAuth state, SERP cache, daily DataForSEO cost ledger |
| Job queue | Cloudflare Queues | Fan-out per (account, date-range, term) with retries |
| Scheduler | Cron Triggers | 4 cron expressions covering ingestion + evaluation + alerts |
| Charts | ECharts (client islands) | Server-rendered shells, lazy-loaded chart code |
| Styling | Tailwind CSS | JIT-built into the worker bundle |
| Tests | Vitest + v8 coverage | 88 tests, ~99% line coverage on pure logic |
| Email | Resend (default) → MailChannels fallback | Both work natively on Workers |
| Package manager | pnpm | Fast, monorepo-friendly |

---

## Quick start

```bash
git clone https://github.com/estevecastells/openadscan
cd openadscan
pnpm install

# 1. Spin up Cloudflare primitives
wrangler d1 create openadscan        # copy the database_id into wrangler.toml
wrangler kv namespace create KV      # copy the id into wrangler.toml
wrangler queues create openadscan-ingest
wrangler queues create openadscan-ingest-dlq

# 2. Run the initial migration
wrangler d1 migrations apply DB --local       # local dev
wrangler d1 migrations apply DB --remote      # production

# 3. Set secrets
wrangler secret put SESSION_SECRET
wrangler secret put ENCRYPTION_KEY          # 64 hex chars — `openssl rand -hex 32`
wrangler secret put GOOGLE_OAUTH_CLIENT_ID
wrangler secret put GOOGLE_OAUTH_CLIENT_SECRET
wrangler secret put GOOGLE_ADS_DEVELOPER_TOKEN
wrangler secret put RESEND_API_KEY          # optional
wrangler secret put SLACK_WEBHOOK_URL       # optional

# 4. Deploy
pnpm deploy
```

Then open your Workers URL and complete the **first-run setup wizard**: set admin password, create your first brand, pick a market and one brand term. Setup redirects you to **Connections** to OAuth Google Ads and Search Console and to paste your DataForSEO login.

The cron triggers in `wrangler.toml` will start collecting data on the next tick — or trigger jobs manually from `Settings → Schedules`.

---

## Architecture

```
                   ┌─────────────────────────────────────────────────┐
                   │                Cloudflare Worker                 │
                   │                                                  │
   user browser ───▶  HonoX routes (SSR + islands)  ◀─── ECharts (CDN)
                   │      │                                           │
                   │      ├──▶ Drizzle ORM ──▶  D1 (SQLite)            │
                   │      │                                           │
                   │      └──▶ KV (OAuth, SERP cache, $ ledger)        │
                   │                                                  │
                   │      ┌── Cron Triggers ──▶ scheduler ─┐           │
                   │      │                                ▼           │
                   │      └─────────────────────  INGEST_QUEUE         │
                   │                                ▲     │           │
                   │              consumer ─────────┘     ▼           │
                   │                  │            ingest jobs        │
                   │                  ├──▶ Google Ads API             │
                   │                  ├──▶ Search Console API         │
                   │                  └──▶ DataForSEO API             │
                   │                                                  │
                   │              evaluators ──▶ NKLG / Cannibalization
                   │                              / Incrementality    │
                   │                                                  │
                   │              alerts ─▶ Email / Webhook / Slack   │
                   └─────────────────────────────────────────────────┘
```

See [docs/architecture.md](docs/architecture.md) for a deeper dive.

---

## Connector setup

- **Google Ads** → [docs/connectors/google-ads.md](docs/connectors/google-ads.md). Create an OAuth web client at console.cloud.google.com, request a developer token in your Google Ads MCC, set redirect URI to `{PUBLIC_BASE_URL}/api/connectors/google-ads/oauth-callback`.
- **Search Console** → [docs/connectors/search-console.md](docs/connectors/search-console.md). Same OAuth client; add the `webmasters.readonly` scope.
- **DataForSEO** → [docs/connectors/dataforseo.md](docs/connectors/dataforseo.md). Sign up at dataforseo.com, copy login/password. Cost budget is enforced via `DATAFORSEO_DAILY_BUDGET_USD` (default $5/day).

---

## Feature deep dives

- [docs/features/nklg.md](docs/features/nklg.md) — the Adevinta origin story + the evaluator algorithm + thresholds + the simulator
- [docs/features/brand-monitor.md](docs/features/brand-monitor.md) — SERP parsing, SOV, hijack detection
- [docs/features/cannibalization.md](docs/features/cannibalization.md) — paid × organic merge
- [docs/features/incrementality.md](docs/features/incrementality.md) — CTR delta framework, cost per incremental click
- [docs/features/alerts.md](docs/features/alerts.md) — rule types and channels

---

## Local development

```bash
pnpm install
wrangler d1 migrations apply DB --local
pnpm seed && wrangler d1 execute DB --local --file=seed/demo.sql   # optional demo data
pnpm dev                                                            # http://localhost:5173
```

The seed produces 30 days of believable Ads + GSC + SERP data for a fake brand ("Acme") so every dashboard renders without OAuth.

---

## Testing

```bash
pnpm test            # 88 tests
pnpm test:coverage   # HTML report in coverage/ — ~99% line coverage on the unit-tested surface
pnpm typecheck
```

The pure-logic surface (NKLG evaluator, incrementality math, cannibalization join, brand-monitor analyzer, hijack detector, alert rules, connectors' query/OAuth helpers, DataForSEO SERP parser, all of `src/lib`) is fully unit-tested with mocked `fetch`. The DB-bound modules (recommender, snapshot writers, dispatcher, ingest jobs) are exercised end-to-end via the `pnpm dev` + seed flow against a real Miniflare-backed D1.

---

## Configuration

| Variable | Required | Description |
|---|---|---|
| `ADMIN_EMAIL` | yes | Admin account email; used in first-run setup and as the email sender |
| `PUBLIC_BASE_URL` | yes | Base URL of your deployed Worker — used in OAuth redirect URIs |
| `SESSION_SECRET` | yes (secret) | HMAC key for session cookies + webhook signatures (32+ bytes) |
| `ENCRYPTION_KEY` | yes (secret) | 32-byte hex string for AES-GCM-encrypting OAuth tokens at rest |
| `GOOGLE_OAUTH_CLIENT_ID` | yes (secret) | Google OAuth web client id |
| `GOOGLE_OAUTH_CLIENT_SECRET` | yes (secret) | Google OAuth web client secret |
| `GOOGLE_ADS_DEVELOPER_TOKEN` | yes (secret) | Google Ads developer token (approved) |
| `DATAFORSEO_DAILY_BUDGET_USD` | no | Hard cap on DataForSEO spend per UTC day (default `5.00`) |
| `RESEND_API_KEY` | no (secret) | If set, alerts are delivered via Resend; otherwise MailChannels |
| `SLACK_WEBHOOK_URL` | no (secret) | Default Slack webhook for Slack-channel alerts |
| `DEFAULT_LOCALE` | no | Default UI locale (currently only `en-US` is wired) |

---

## Roadmap

- AI Overview / LLM rank tracking (ChatGPT, Perplexity citation) — clean extension point in `serpSnapshots`
- Multi-tenant mode (orgs + RBAC)
- Bing Ads / Microsoft Ads + GA4 connectors
- Anomaly detection on KPIs
- Mobile-first responsive layout polish
- E2E test suite running inside `@cloudflare/vitest-pool-workers` for the IO layer

---

## Contributing

Issues and PRs welcome. Run `pnpm test`, `pnpm typecheck` and `pnpm lint` before pushing.

---

## License

[MIT](LICENSE).

---

## Acknowledgements

- The **Adevinta SAI team** — **Marcin**, **Filippo**, **Esteve** and everyone else who built and ran NKLG before Open AdScan existed
- The team behind **[Hono](https://hono.dev/)** and **[HonoX](https://github.com/honojs/honox)**
- **[Drizzle ORM](https://orm.drizzle.team/)**, **[ECharts](https://echarts.apache.org/)**, **[DataForSEO](https://dataforseo.com/)**
- Everyone who has ever wished their search intelligence platform was just *files in a repo they could read*
