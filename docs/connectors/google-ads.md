# Google Ads connector

## What you need

1. A **Google Ads MCC account** (Manager) with at least one client account
2. A **developer token** (free; takes 1–2 business days to be approved). Apply at: `https://ads.google.com/aw/apicenter`
3. A **Google Cloud OAuth 2.0 web client** with:
   - Authorized redirect URI: `{PUBLIC_BASE_URL}/api/connectors/google-ads/oauth-callback`
   - Scope: `https://www.googleapis.com/auth/adwords`

## Set secrets

```bash
wrangler secret put GOOGLE_OAUTH_CLIENT_ID
wrangler secret put GOOGLE_OAUTH_CLIENT_SECRET
wrangler secret put GOOGLE_ADS_DEVELOPER_TOKEN
```

## Connect

`Settings → Connections → Google Ads → Connect`. You'll be redirected to Google for consent, then back. openadscan stores the refresh token AES-GCM-encrypted, and refreshes the access token automatically on every API call.

## What we pull

GAQL queries are in `src/connectors/google-ads/queries.ts`:

- `keyword_view` → daily keyword performance (clicks, impressions, cost, conversions)
- `search_term_view` → actual queries triggering your ads
- `paid_organic_search_term_view` → the gold mine: paid + organic data on the same query

We segment by `segments.date` and only pull `ENABLED` keywords / campaigns by default.

## Rate / quotas

Google Ads API allows ~15,000 ops per 24h on a basic-access developer token. We chunk by date range and parallelise sparingly through the queue. If you hit quota errors, lower the cron frequency or upgrade the developer token to standard access.

## Manager accounts

If your developer token belongs to an MCC, set `loginCustomerId` in the connection's `config_json` to the manager's customer id. The client sends the `login-customer-id` header automatically.
