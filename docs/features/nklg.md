# NKLG — Negative Keyword List Generator

> *Originally built at [Adevinta](https://www.adevinta.com/) by Esteve Castells together with **Marcin**, **Filippo**, and the **SAI team**. NKLG is the conceptual core of openadscan — every other module exists to feed it the data it needs.*

## The rule

If, for a given branded or near-branded keyword:

1. Your **organic ranking** is consistently strong (avg position ≤ N, default `2`)
2. Your **organic CTR** is consistently high (≥ X, default `0.20` for brand)
3. **No paid competitor** is bidding on the term across the window (mean competitor density `0`)
4. You have **enough observation history** (≥ 14 days)

then you should **stop paying** for that keyword. Add it to your Google Ads negative keyword list.

The moment a competitor returns (mean density > 0 for ≥ 3 consecutive SERP snapshots on a previously paused term), openadscan flips the decision to **`re_enable`** and fires an alert so you can reactivate paid bidding to defend the SERP.

## Why it works

On a branded SERP where:

- You rank #1 organically,
- Click-through to your organic listing is strong,
- And nobody else is competing for the ad slot,

…paying for the ad slot is almost pure substitution: the paid click is one you would have captured for free. The Adevinta team's incrementality analysis (see [docs/features/incrementality.md](./incrementality.md) and the [SEO vs SEM SpeakerDeck](https://speakerdeck.com/estevecastells/seo-vs-sem-final-round-esteve-castells-number-vamostalegon)) quantified the savings at €300k run-rate per quarter on a single business unit, with up to €1.5M annual savings across the wider organisation.

The catch is the *defence* requirement: brand bidding exists in part to keep competitors off your brand SERP. NKLG explicitly handles that by **continuously monitoring** for competitor activity and **automatically re-enabling** paid bidding when needed.

## The algorithm

The pure logic lives in `src/features/nklg/evaluator.ts`. For each (keyword, market) over an observation window (default 28 days):

1. **Aggregate** GSC for the query, Ads for the matched keyword, and SERP snapshots for the term
2. **Compute**:
   - `avg_organic_position`
   - `organic_ctr = organic_clicks / organic_impressions`
   - `paid_competitor_density = mean number of competitor ads per SERP snapshot`
   - `paid_cost_micros`, `paid_clicks` over the window
3. **Decide**:
   - `re_enable` if previously applied and competitor density > threshold
   - `keep_paying` if observation history < `minDaysObserved`
   - `add_negative` if organic strong AND no competitors
   - `keep_paying` otherwise, with a specific reason for the diagnosis
4. **Confidence**: Wilson lower bound on organic CTR × position score × sample size × competitor penalty, clamped to [0, 1]

The `savings_opportunity_micros` field is just the paid cost over the window — that's what you save by switching the term off, assuming the counterfactual (no traffic loss) holds.

## Thresholds

Defaults are in `src/features/nklg/config.ts`. Override per-evaluation via the second argument to `evaluateNKLG()`. The **Settings → NKLG** UI exposes the same knobs.

| Threshold | Default | Effect |
|---|---|---|
| `maxOrganicPos` | 2 | Tighter → fewer pause recommendations, higher confidence |
| `minOrganicCtr` | 0.2 | Tighter → fewer pause recommendations |
| `maxCompetitorDensity` | 0 | Raise to tolerate occasional competitor presence |
| `minDaysObserved` | 14 | Lower → faster recommendations on new terms (but noisier) |
| `minConfidence` | 0.4 | Below this, recommendations appear in "low confidence" tab |

## Confidence

```
ctrFloor    = wilson(successes, total)
positionScore = max(0, 1 - (pos - 1) / 3)
sampleScore   = min(1, daysObserved / 28)
competitorPen = density <= 0 ? 1 : max(0, 1 - density / 2)

confidence = clamp(ctrFloor * 0.5 + positionScore * 0.2 + sampleScore * 0.15 + competitorPen * 0.15)
```

Low-sample 100% CTRs collapse toward 0 via Wilson, which is critical for not pausing paid bidding on noise. See `tests/lib/stats.test.ts`.

## Simulator

`src/islands/nklg/NKLGSimulator.tsx` is an interactive client island that re-evaluates a supplied set of observations against user-dragged thresholds in real time. It's the fastest way to find the right threshold mix for a given brand.

## Export

`src/features/nklg/exporter.ts` produces a Google Ads-compatible CSV:

```
Keyword,Match Type,Country,Confidence,Savings (USD)
acme support,Exact,US,0.823,9.50
acme,Exact,US,0.910,21.00
```

Upload via *Google Ads → Tools → Shared Library → Negative keyword lists*.

## Alerts

The `nklg_re_enable` rule fires when a previously-applied recommendation flips to `re_enable`. See [docs/features/alerts.md](./alerts.md).
