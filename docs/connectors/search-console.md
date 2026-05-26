# Search Console connector

## What you need

1. A **verified property** in Google Search Console
2. The same **OAuth client** used for Google Ads, with the `https://www.googleapis.com/auth/webmasters.readonly` scope authorized

## Connect

`Settings → Connections → Search Console → Connect`. You consent through Google, openadscan stores the refresh token, then `Settings → Connections` lets you pick which property to ingest.

## What we pull

`searchanalytics.query` with:

- Dimensions: `query`, `page`, `country`, `device`
- Row limit: 25,000 per page, paginated via `startRow`
- `dataState: "all"` to include fresh data

## Data lag

GSC has a ~48-hour data lag. The hourly cron pulls **today − 2 days** by default — when fresh days appear, future ticks will pick them up automatically.

## First connect

Backfill is opt-in. The Connections page surfaces a *Backfill 16 months* action that enqueues one `pull-gsc` job per (property, day). Expect a few hours for the queue to drain on a high-traffic property.

## Rate limits

GSC quota is 1,200 queries per minute per project. Our per-day fetch is one paginated query call per property, so we sit well inside the budget.
