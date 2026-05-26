# Brand Monitor

Continuous SERP monitoring for every brand term, every market. Every 6 hours (configurable) the cron trigger enqueues a `pull-serp` job per active brand term. The consumer calls DataForSEO's *Google Organic Live (advanced)* endpoint — which returns ads + organic in a single call — parses the result, persists it as `serp_snapshots / serp_ads / serp_organic`, then derives a `brand_monitor_daily` row.

## What's tracked

Per (brand, term, country, day):

| Field | Meaning |
|---|---|
| `our_top_ad_pos` | Lowest position of our paid ad in the SERP (null if we have none) |
| `competitor_count` | Number of non-allowlisted advertisers in the SERP |
| `top_competitor_domain` | Highest-ranking competitor |
| `our_organic_top3` | Boolean — true if our domain appears in organic positions 1–3 |
| `sov_paid` | Our share of paid impressions (ours / total ads) |
| `sov_organic` | Our share of top-10 organic results |

The brand-monitor analyzer (`src/features/brand-monitor/analyzer.ts`) is pure: it takes the parsed SERP and our domain, returns the facts above. No DB access. Unit-tested in `tests/features/brand-monitor.test.ts`.

## Auto-registration of competitors

Every unique advertiser domain we see is upserted into the `competitors` table (`is_known = false` by default). The Competitor Intel module surfaces them and lets you mark them as `is_known = true` so they don't trigger the `competitor_new` alert.

## Hijacking

`src/features/brand-monitor/hijack.ts` flags any ad whose title/description/displayUrl contains a configured brand token from a non-allowlisted domain. This fires `hijack_detected` alerts.

## SERP cache

The DataForSEO client caches identical (keyword, country, language, device) requests in KV for 12 hours by default — so re-runs of the same day don't burn budget.
