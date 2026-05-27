# Alerts

Open AdScan watches for six conditions, fires events into `alert_events`, then a 15-minute cron tick dispatches pending events via the configured channel.

## Rule types

| Type | Fires when | Source |
|---|---|---|
| `competitor_new` | A new advertiser domain shows up in ads for a brand term in the last N days | SERP snapshots |
| `competitor_returning` | A known competitor that was gone for ≥ N days came back | SERP snapshots |
| `hijack_detected` | An ad copy from a non-allowlisted domain contains your brand token | Brand monitor |
| `ranking_drop` | Organic position dropped by ≥ X for a tracked query day-over-day | GSC daily |
| `nklg_re_enable` | A previously-applied NKLG recommendation flipped to `re_enable` | NKLG monitor |
| `ingestion_failed` | A consumer job errored | Job runs |

Pure evaluators in `src/features/alerts/rules.ts` (covered by `tests/features/alerts.test.ts`).

## Channels

| Channel | Transport |
|---|---|
| `email` | Resend if `RESEND_API_KEY` is set, otherwise MailChannels |
| `webhook` | POST with `x-openadscan-signature` HMAC header (uses `SESSION_SECRET`) |
| `slack` | Slack incoming webhook (`SLACK_WEBHOOK_URL` or per-rule target) |

## Adding rules

`Settings → Alert rules` lets you pick:

- Brand
- Rule type
- Channel
- Channel target (email address, webhook URL, or Slack webhook URL)

The dispatcher (`src/features/alerts/dispatcher.ts`) iterates pending events, renders human-readable text via `renderAlertText`, and marks events `delivered` / `failed` with the error for diagnosis.

## Testing

You can fire a synthetic event from `Settings → Alert rules → Test` (POST to `/api/alerts/test` with `rule_id`) to verify end-to-end delivery without waiting for a real condition.
