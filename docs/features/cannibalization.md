# Cannibalization

The cannibalization analyzer joins GSC and Ads daily facts on **(query, date, country)** and surfaces queries where you appear both organically and paid. This is the input the NKLG evaluator and the Cannibalization dashboard both read from.

## How the join works

The pure function `joinCannibalization` in `src/features/cannibalization/analyzer.ts`:

1. Builds an index of Ads rows keyed by `(keyword.toLowerCase(), date, country)`
2. For each GSC row, looks up the matching Ads row (country-specific first, then country-agnostic)
3. Returns a merged row with `paid_clicks`, `paid_impressions`, `paid_cost_micros`, organic equivalents, and `combined_clicks = organic_clicks + paid_clicks`

Tested in `tests/features/cannibalization.test.ts`.

## What the dashboard shows

- Top queries by paid spend in the trailing 28 days
- For each: organic position, organic CTR, paid clicks, paid cost, combined clicks
- Two KPIs:
  - **Total paid spend** in the window
  - **Spend overlapping organic top-3** — the dollars at greatest risk of pure substitution

Click a row to send it to the NKLG evaluator on the next nightly tick.

## Why this matters

This is the cheap, deterministic precursor to NKLG. Once you have it, you can:

- Tag queries where organic is doing the work
- Build the case for shifting budget from brand-defence to mid-funnel acquisition
- Negotiate with finance using the "spend at risk" number as a savings ceiling
