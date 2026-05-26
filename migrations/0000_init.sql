-- openadscan initial schema
-- Generated to mirror src/lib/db/schema.ts. Run via:
--   wrangler d1 migrations apply DB --local
--   wrangler d1 migrations apply DB --remote

CREATE TABLE `admin_user` (
  `id` TEXT PRIMARY KEY NOT NULL,
  `email` TEXT NOT NULL UNIQUE,
  `password_hash` TEXT NOT NULL,
  `created_at` INTEGER NOT NULL DEFAULT (unixepoch('subsec') * 1000)
);

CREATE TABLE `sessions` (
  `id` TEXT PRIMARY KEY NOT NULL,
  `user_id` TEXT NOT NULL REFERENCES `admin_user`(`id`) ON DELETE CASCADE,
  `expires_at` INTEGER NOT NULL
);

CREATE TABLE `brands` (
  `id` TEXT PRIMARY KEY NOT NULL,
  `name` TEXT NOT NULL,
  `domain` TEXT NOT NULL,
  `created_at` INTEGER NOT NULL DEFAULT (unixepoch('subsec') * 1000)
);

CREATE TABLE `brand_terms` (
  `id` TEXT PRIMARY KEY NOT NULL,
  `brand_id` TEXT NOT NULL REFERENCES `brands`(`id`) ON DELETE CASCADE,
  `term` TEXT NOT NULL,
  `match_type` TEXT NOT NULL DEFAULT 'exact',
  `country` TEXT NOT NULL,
  `language` TEXT NOT NULL DEFAULT 'en',
  `monitor_paid` INTEGER NOT NULL DEFAULT 1,
  `created_at` INTEGER NOT NULL DEFAULT (unixepoch('subsec') * 1000)
);
CREATE INDEX `brand_terms_brand_idx` ON `brand_terms`(`brand_id`);
CREATE UNIQUE INDEX `brand_terms_unique_idx` ON `brand_terms`(`brand_id`, `term`, `country`, `language`);

CREATE TABLE `competitors` (
  `id` TEXT PRIMARY KEY NOT NULL,
  `brand_id` TEXT NOT NULL REFERENCES `brands`(`id`) ON DELETE CASCADE,
  `name` TEXT,
  `domain` TEXT NOT NULL,
  `is_known` INTEGER NOT NULL DEFAULT 0,
  `created_at` INTEGER NOT NULL DEFAULT (unixepoch('subsec') * 1000)
);
CREATE UNIQUE INDEX `competitors_unique_idx` ON `competitors`(`brand_id`, `domain`);

CREATE TABLE `connections` (
  `id` TEXT PRIMARY KEY NOT NULL,
  `type` TEXT NOT NULL,
  `display_name` TEXT NOT NULL,
  `config_json` TEXT NOT NULL DEFAULT '{}',
  `oauth_access_token_enc` TEXT,
  `oauth_refresh_token_enc` TEXT,
  `expires_at` INTEGER,
  `status` TEXT NOT NULL DEFAULT 'active',
  `last_synced_at` INTEGER,
  `created_at` INTEGER NOT NULL DEFAULT (unixepoch('subsec') * 1000)
);

CREATE TABLE `ads_accounts` (
  `id` TEXT PRIMARY KEY NOT NULL,
  `connection_id` TEXT NOT NULL REFERENCES `connections`(`id`) ON DELETE CASCADE,
  `customer_id` TEXT NOT NULL,
  `descriptive_name` TEXT,
  `currency` TEXT,
  `time_zone` TEXT
);
CREATE UNIQUE INDEX `ads_accounts_unique_idx` ON `ads_accounts`(`connection_id`, `customer_id`);

CREATE TABLE `ads_keyword_daily` (
  `id` TEXT PRIMARY KEY NOT NULL,
  `account_id` TEXT NOT NULL REFERENCES `ads_accounts`(`id`) ON DELETE CASCADE,
  `campaign_id` TEXT,
  `campaign_name` TEXT,
  `ad_group_id` TEXT,
  `ad_group_name` TEXT,
  `keyword` TEXT NOT NULL,
  `match_type` TEXT NOT NULL,
  `date` TEXT NOT NULL,
  `country` TEXT,
  `clicks` INTEGER NOT NULL DEFAULT 0,
  `impressions` INTEGER NOT NULL DEFAULT 0,
  `cost_micros` INTEGER NOT NULL DEFAULT 0,
  `conversions` REAL NOT NULL DEFAULT 0,
  `conversions_value` REAL NOT NULL DEFAULT 0
);
CREATE INDEX `ads_kw_keyword_idx` ON `ads_keyword_daily`(`keyword`, `date`);
CREATE INDEX `ads_kw_date_idx` ON `ads_keyword_daily`(`date`);

CREATE TABLE `ads_search_term_daily` (
  `id` TEXT PRIMARY KEY NOT NULL,
  `account_id` TEXT NOT NULL REFERENCES `ads_accounts`(`id`) ON DELETE CASCADE,
  `keyword` TEXT NOT NULL,
  `search_term` TEXT NOT NULL,
  `match_type` TEXT NOT NULL,
  `date` TEXT NOT NULL,
  `country` TEXT,
  `clicks` INTEGER NOT NULL DEFAULT 0,
  `impressions` INTEGER NOT NULL DEFAULT 0,
  `cost_micros` INTEGER NOT NULL DEFAULT 0,
  `conversions` REAL NOT NULL DEFAULT 0
);
CREATE INDEX `ads_st_term_idx` ON `ads_search_term_daily`(`search_term`, `date`);

CREATE TABLE `gsc_properties` (
  `id` TEXT PRIMARY KEY NOT NULL,
  `connection_id` TEXT NOT NULL REFERENCES `connections`(`id`) ON DELETE CASCADE,
  `site_url` TEXT NOT NULL
);
CREATE UNIQUE INDEX `gsc_properties_unique_idx` ON `gsc_properties`(`connection_id`, `site_url`);

CREATE TABLE `gsc_query_daily` (
  `id` TEXT PRIMARY KEY NOT NULL,
  `property_id` TEXT NOT NULL REFERENCES `gsc_properties`(`id`) ON DELETE CASCADE,
  `date` TEXT NOT NULL,
  `query` TEXT NOT NULL,
  `page` TEXT NOT NULL,
  `country` TEXT NOT NULL,
  `device` TEXT NOT NULL,
  `clicks` INTEGER NOT NULL DEFAULT 0,
  `impressions` INTEGER NOT NULL DEFAULT 0,
  `ctr` REAL NOT NULL DEFAULT 0,
  `position` REAL NOT NULL DEFAULT 0
);
CREATE INDEX `gsc_query_idx` ON `gsc_query_daily`(`query`, `date`);
CREATE INDEX `gsc_date_idx` ON `gsc_query_daily`(`date`);

CREATE TABLE `serp_snapshots` (
  `id` TEXT PRIMARY KEY NOT NULL,
  `brand_term_id` TEXT REFERENCES `brand_terms`(`id`) ON DELETE SET NULL,
  `query` TEXT NOT NULL,
  `country` TEXT NOT NULL,
  `language` TEXT NOT NULL,
  `device` TEXT NOT NULL,
  `fetched_at` INTEGER NOT NULL,
  `cost_usd` REAL NOT NULL DEFAULT 0,
  `source` TEXT NOT NULL DEFAULT 'dataforseo'
);
CREATE INDEX `serp_snapshots_term_idx` ON `serp_snapshots`(`brand_term_id`, `fetched_at`);
CREATE INDEX `serp_snapshots_query_idx` ON `serp_snapshots`(`query`, `country`, `fetched_at`);

CREATE TABLE `serp_ads` (
  `id` TEXT PRIMARY KEY NOT NULL,
  `snapshot_id` TEXT NOT NULL REFERENCES `serp_snapshots`(`id`) ON DELETE CASCADE,
  `position` INTEGER NOT NULL,
  `advertiser_domain` TEXT NOT NULL,
  `title` TEXT,
  `description` TEXT,
  `display_url` TEXT,
  `url` TEXT
);
CREATE INDEX `serp_ads_snapshot_idx` ON `serp_ads`(`snapshot_id`);
CREATE INDEX `serp_ads_domain_idx` ON `serp_ads`(`advertiser_domain`);

CREATE TABLE `serp_organic` (
  `id` TEXT PRIMARY KEY NOT NULL,
  `snapshot_id` TEXT NOT NULL REFERENCES `serp_snapshots`(`id`) ON DELETE CASCADE,
  `position` INTEGER NOT NULL,
  `domain` TEXT NOT NULL,
  `url` TEXT,
  `title` TEXT
);
CREATE INDEX `serp_organic_snapshot_idx` ON `serp_organic`(`snapshot_id`);

CREATE TABLE `brand_monitor_daily` (
  `id` TEXT PRIMARY KEY NOT NULL,
  `brand_id` TEXT NOT NULL REFERENCES `brands`(`id`) ON DELETE CASCADE,
  `brand_term_id` TEXT REFERENCES `brand_terms`(`id`) ON DELETE SET NULL,
  `term` TEXT NOT NULL,
  `date` TEXT NOT NULL,
  `country` TEXT NOT NULL,
  `our_top_ad_pos` INTEGER,
  `competitor_count` INTEGER NOT NULL DEFAULT 0,
  `top_competitor_domain` TEXT,
  `our_organic_top3` INTEGER NOT NULL DEFAULT 0,
  `sov_paid` REAL NOT NULL DEFAULT 0,
  `sov_organic` REAL NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX `brand_monitor_daily_unique_idx` ON `brand_monitor_daily`(`brand_id`, `term`, `date`, `country`);
CREATE INDEX `brand_monitor_daily_date_idx` ON `brand_monitor_daily`(`date`);

CREATE TABLE `cannibalization_daily` (
  `id` TEXT PRIMARY KEY NOT NULL,
  `brand_id` TEXT NOT NULL REFERENCES `brands`(`id`) ON DELETE CASCADE,
  `query` TEXT NOT NULL,
  `page` TEXT,
  `date` TEXT NOT NULL,
  `country` TEXT NOT NULL,
  `paid_clicks` INTEGER NOT NULL DEFAULT 0,
  `paid_impressions` INTEGER NOT NULL DEFAULT 0,
  `paid_cost_micros` INTEGER NOT NULL DEFAULT 0,
  `organic_clicks` INTEGER NOT NULL DEFAULT 0,
  `organic_impressions` INTEGER NOT NULL DEFAULT 0,
  `organic_ctr` REAL NOT NULL DEFAULT 0,
  `organic_position` REAL NOT NULL DEFAULT 0,
  `combined_clicks` INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX `cann_daily_query_idx` ON `cannibalization_daily`(`query`, `date`);
CREATE UNIQUE INDEX `cann_daily_unique_idx` ON `cannibalization_daily`(`brand_id`, `query`, `date`, `country`);

CREATE TABLE `incrementality_metrics` (
  `id` TEXT PRIMARY KEY NOT NULL,
  `brand_id` TEXT NOT NULL REFERENCES `brands`(`id`) ON DELETE CASCADE,
  `query` TEXT NOT NULL,
  `country` TEXT NOT NULL,
  `window_start` TEXT NOT NULL,
  `window_end` TEXT NOT NULL,
  `days_paid_on` INTEGER NOT NULL DEFAULT 0,
  `days_paid_off` INTEGER NOT NULL DEFAULT 0,
  `ctr_with_sem` REAL NOT NULL DEFAULT 0,
  `ctr_without_sem` REAL NOT NULL DEFAULT 0,
  `incremental_ctr` REAL NOT NULL DEFAULT 0,
  `paid_clicks` INTEGER NOT NULL DEFAULT 0,
  `paid_impressions` INTEGER NOT NULL DEFAULT 0,
  `paid_cost_micros` INTEGER NOT NULL DEFAULT 0,
  `incremental_clicks` REAL NOT NULL DEFAULT 0,
  `cost_per_incremental_click` REAL NOT NULL DEFAULT 0,
  `sample_confidence` REAL NOT NULL DEFAULT 0
);
CREATE INDEX `incr_brand_idx` ON `incrementality_metrics`(`brand_id`, `window_end`);
CREATE UNIQUE INDEX `incr_unique_idx` ON `incrementality_metrics`(`brand_id`, `query`, `country`, `window_start`, `window_end`);

CREATE TABLE `nklg_recommendations` (
  `id` TEXT PRIMARY KEY NOT NULL,
  `brand_id` TEXT NOT NULL REFERENCES `brands`(`id`) ON DELETE CASCADE,
  `keyword` TEXT NOT NULL,
  `match_type` TEXT NOT NULL DEFAULT 'exact',
  `country` TEXT NOT NULL,
  `decision` TEXT NOT NULL,
  `reason` TEXT NOT NULL,
  `organic_position` REAL NOT NULL DEFAULT 0,
  `organic_ctr` REAL NOT NULL DEFAULT 0,
  `paid_competitor_density` REAL NOT NULL DEFAULT 0,
  `paid_cost_micros` INTEGER NOT NULL DEFAULT 0,
  `paid_clicks` INTEGER NOT NULL DEFAULT 0,
  `savings_opportunity_micros` INTEGER NOT NULL DEFAULT 0,
  `confidence` REAL NOT NULL DEFAULT 0,
  `evaluated_at` INTEGER NOT NULL,
  `status` TEXT NOT NULL DEFAULT 'open'
);
CREATE INDEX `nklg_brand_idx` ON `nklg_recommendations`(`brand_id`, `evaluated_at`);
CREATE UNIQUE INDEX `nklg_unique_idx` ON `nklg_recommendations`(`brand_id`, `keyword`, `country`);

CREATE TABLE `alert_rules` (
  `id` TEXT PRIMARY KEY NOT NULL,
  `brand_id` TEXT NOT NULL REFERENCES `brands`(`id`) ON DELETE CASCADE,
  `type` TEXT NOT NULL,
  `params_json` TEXT NOT NULL DEFAULT '{}',
  `channel` TEXT NOT NULL DEFAULT 'email',
  `channel_target` TEXT,
  `enabled` INTEGER NOT NULL DEFAULT 1,
  `created_at` INTEGER NOT NULL DEFAULT (unixepoch('subsec') * 1000)
);

CREATE TABLE `alert_events` (
  `id` TEXT PRIMARY KEY NOT NULL,
  `rule_id` TEXT NOT NULL REFERENCES `alert_rules`(`id`) ON DELETE CASCADE,
  `fired_at` INTEGER NOT NULL,
  `payload_json` TEXT NOT NULL DEFAULT '{}',
  `delivered_at` INTEGER,
  `delivery_status` TEXT NOT NULL DEFAULT 'pending',
  `delivery_error` TEXT
);
CREATE INDEX `alert_events_rule_idx` ON `alert_events`(`rule_id`, `fired_at`);
CREATE INDEX `alert_events_fired_idx` ON `alert_events`(`fired_at`);

CREATE TABLE `schedules` (
  `id` TEXT PRIMARY KEY NOT NULL,
  `connector_type` TEXT NOT NULL,
  `cron_expr` TEXT NOT NULL,
  `enabled` INTEGER NOT NULL DEFAULT 1,
  `last_run_at` INTEGER
);

CREATE TABLE `job_runs` (
  `id` TEXT PRIMARY KEY NOT NULL,
  `schedule_id` TEXT REFERENCES `schedules`(`id`) ON DELETE SET NULL,
  `kind` TEXT NOT NULL,
  `started_at` INTEGER NOT NULL,
  `ended_at` INTEGER,
  `status` TEXT NOT NULL DEFAULT 'running',
  `error` TEXT,
  `rows_ingested` INTEGER NOT NULL DEFAULT 0,
  `cost_usd` REAL NOT NULL DEFAULT 0
);
CREATE INDEX `job_runs_kind_idx` ON `job_runs`(`kind`, `started_at`);
