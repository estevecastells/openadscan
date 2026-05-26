# DataForSEO connector

## Why DataForSEO

We use it for **SERP snapshots** (ads + organic in one call) and **keyword data** (volume, CPC, related terms, SERP competitors). DataForSEO is pay-per-request — typical cost per Live SERP fetch is ~$0.002, keyword overview is ~$0.001 / keyword.

## What you need

A **DataForSEO account** at https://dataforseo.com. They issue you an API login (your email) and a password.

## Connect

`Settings → Connections → DataForSEO`. Paste login + password. We test the credentials by hitting the free `/v3/appendix/user_data` endpoint, then store them encrypted inside `connections.config_json`.

## Budget guard

The DataForSEO client maintains a daily USD ledger in KV (`cost:dfs:YYYY-MM-DD`). Every response includes its `cost` field; we sum it. If today's spend exceeds `DATAFORSEO_DAILY_BUDGET_USD` (default `$5.00`), every new call throws `BudgetExceeded` until UTC midnight. This is the single most important safety net for self-hosted setups — increase the cap deliberately.

## Endpoints used

| Endpoint | Purpose |
|---|---|
| `/v3/serp/google/organic/live/advanced` | SERP snapshot for brand terms (ads + organic) |
| `/v3/dataforseo_labs/google/keyword_overview/live` | Search volume, CPC, competition for a batch of keywords |
| `/v3/dataforseo_labs/google/related_keywords/live` | Keyword discovery |
| `/v3/dataforseo_labs/google/serp_competitors/live` | Organic competitor identification |

## Cache

Identical (endpoint, params hash) requests are cached in KV. Default TTL: 12h for SERP, 7d for keyword data. Override per-call in `dfsPost({ cacheTtlSec })`.

## Locations

We map country codes to DataForSEO `location_code` in `src/connectors/dataforseo/serp.ts`. Unknown country codes fall back to US (2840). Add more in the `COUNTRY_TO_LOCATION_CODE` map as needed.
