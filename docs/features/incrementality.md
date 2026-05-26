# Incrementality

> Implements the framework from the [SEO vs SEM: Final Round](https://speakerdeck.com/estevecastells/seo-vs-sem-final-round-esteve-castells-number-vamostalegon) deck.

## The framework

For a given query, we have N days of GSC data and Ads data. Each day is either:

- **paid_on**: we had paid impressions on the query, or
- **paid_off**: we didn't

Then:

```
ctr_with_sem    = organic CTR on paid_on days
ctr_without_sem = organic CTR on paid_off days
incremental_ctr = ctr_with_sem - ctr_without_sem
```

A *positive* `incremental_ctr` is the lift that paid bidding gives to organic CTR — sometimes ads "warm up" the user before the organic click.

The headline metric is **cost per incremental click**:

```
counterfactual_organic   = paid_impressions × max(0, ctr_without_sem)
incremental_clicks       = max(0, paid_clicks - counterfactual_organic)
cost_per_incremental_click = paid_cost_usd / incremental_clicks
```

The intuition: if organic CTR is 25% when paid is off, we'd *expect* 25% of those paid impressions to click anyway via organic. The remaining 75% are the genuinely *incremental* clicks. Divide paid spend by that count and you get the true cost of an extra customer.

## The dashboard

The Incrementality page sorts queries by paid spend. For each it shows:

- `days_paid_on` / `days_paid_off`
- `ctr_with_sem` vs `ctr_without_sem` with a positive/negative tone
- `incremental_clicks` and `cost_per_incremental_click`
- `sample_confidence` — proxy for how trustworthy the split is

The blended cost per incremental click in the KPI strip is the brand-wide answer to *"are we getting our money's worth from paid?"*.

## Confidence

We compute `sampleConfidence = min(1, min(days_on, days_off) / 14)`. Queries with fewer than 7 days of data or no split between on/off are filtered out before persistence.

## Tested

Pure function `computeIncrementality` in `src/features/incrementality/analyzer.ts`. Unit tests in `tests/features/incrementality.test.ts` cover:

- Zero-history fallback
- paid_on / paid_off splitting
- Counterfactual subtraction
- Clamp at incremental ≥ 0
- Confidence ceiling
