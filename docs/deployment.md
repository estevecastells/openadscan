# Deployment

A complete checklist to ship openadscan to your own Cloudflare account.

## 0. Prereqs

- Node 20+, pnpm 9+
- A Cloudflare account with Workers Paid plan (Queues + Cron are free on the Paid plan; D1 / KV are free up to generous limits)
- A Google Cloud OAuth web client (for Ads + GSC)
- A Google Ads MCC with a developer token
- A DataForSEO account

## 1. Clone + install

```bash
git clone https://github.com/estevecastells/openadscan
cd openadscan
pnpm install
```

## 2. Create Cloudflare resources

```bash
wrangler d1 create openadscan
wrangler kv namespace create KV
wrangler queues create openadscan-ingest
wrangler queues create openadscan-ingest-dlq
```

Copy the printed IDs into `wrangler.toml` (replace `REPLACE_ME`).

## 3. Apply the migration

```bash
wrangler d1 migrations apply DB --remote
```

## 4. Secrets

```bash
openssl rand -hex 32 | wrangler secret put ENCRYPTION_KEY
openssl rand -base64 32 | wrangler secret put SESSION_SECRET
wrangler secret put GOOGLE_OAUTH_CLIENT_ID
wrangler secret put GOOGLE_OAUTH_CLIENT_SECRET
wrangler secret put GOOGLE_ADS_DEVELOPER_TOKEN

# optional
wrangler secret put RESEND_API_KEY
wrangler secret put SLACK_WEBHOOK_URL
```

Edit `wrangler.toml` `[vars]`:

- `ADMIN_EMAIL` — the only login email
- `PUBLIC_BASE_URL` — the public URL of your Worker (used as OAuth redirect base)
- `DATAFORSEO_DAILY_BUDGET_USD` — pick a number you're comfortable losing in one day

## 5. Deploy

```bash
pnpm deploy
```

## 6. First-run setup

Open the deployed URL. The `/setup` wizard:

1. Creates your admin user
2. Creates your first brand and brand term
3. Seeds five cron `schedules` rows so the Schedules dashboard renders

Then go to **Settings → Connections** and:

- Connect Google Ads (OAuth)
- Connect Search Console (OAuth)
- Paste DataForSEO login + password

## 7. Verify

- Visit `/settings/schedules` — you should see five enabled schedules
- Trigger an immediate ingestion run: paste this in your shell:

  ```bash
  curl -X POST https://<your-worker>/api/jobs/trigger -d 'kind=evaluate-alerts' \
       -b 'oas_session=<copied-from-browser>'
  ```

- Wait 5–10 minutes for the next cron tick (or invoke handlers manually via `wrangler cron trigger`)
- Visit `/`, `/brand-monitor`, `/nklg` to confirm data is flowing

## 8. Optional: seed demo data locally

```bash
wrangler d1 migrations apply DB --local
pnpm seed && wrangler d1 execute DB --local --file=seed/demo.sql
pnpm dev
```

## Operational notes

- Worker free plan limits to 100k requests/day, which is plenty for a single-tenant deploy
- D1 free plan: 5M reads / 100k writes per day, 5GB storage — fine for years of data on a moderate-sized brand
- Queues: free on Workers Paid plan up to 1M operations / month
- DataForSEO is the only paid third party; set `DATAFORSEO_DAILY_BUDGET_USD` conservatively at first

## Updating

```bash
git pull
pnpm install
wrangler d1 migrations apply DB --remote
pnpm deploy
```
