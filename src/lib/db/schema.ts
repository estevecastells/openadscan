import { sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

/* ------------------------------------------------------------------ */
/*  identity                                                          */
/* ------------------------------------------------------------------ */

export const adminUser = sqliteTable("admin_user", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch('subsec') * 1000)`),
});

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => adminUser.id, { onDelete: "cascade" }),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
});

/* ------------------------------------------------------------------ */
/*  configuration                                                     */
/* ------------------------------------------------------------------ */

export const brands = sqliteTable("brands", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  domain: text("domain").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch('subsec') * 1000)`),
});

export const brandTerms = sqliteTable(
  "brand_terms",
  {
    id: text("id").primaryKey(),
    brandId: text("brand_id")
      .notNull()
      .references(() => brands.id, { onDelete: "cascade" }),
    term: text("term").notNull(),
    matchType: text("match_type", { enum: ["exact", "phrase", "broad"] }).notNull().default("exact"),
    country: text("country").notNull(), // ISO 3166-1 alpha-2
    language: text("language").notNull().default("en"),
    monitorPaid: integer("monitor_paid", { mode: "boolean" }).notNull().default(true),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch('subsec') * 1000)`),
  },
  (t) => ({
    byBrand: index("brand_terms_brand_idx").on(t.brandId),
    uniq: uniqueIndex("brand_terms_unique_idx").on(t.brandId, t.term, t.country, t.language),
  }),
);

export const competitors = sqliteTable(
  "competitors",
  {
    id: text("id").primaryKey(),
    brandId: text("brand_id")
      .notNull()
      .references(() => brands.id, { onDelete: "cascade" }),
    name: text("name"),
    domain: text("domain").notNull(),
    isKnown: integer("is_known", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch('subsec') * 1000)`),
  },
  (t) => ({
    uniq: uniqueIndex("competitors_unique_idx").on(t.brandId, t.domain),
  }),
);

/* ------------------------------------------------------------------ */
/*  connections                                                       */
/* ------------------------------------------------------------------ */

export const connections = sqliteTable("connections", {
  id: text("id").primaryKey(),
  type: text("type", { enum: ["google_ads", "search_console", "dataforseo"] }).notNull(),
  displayName: text("display_name").notNull(),
  configJson: text("config_json").notNull().default("{}"),
  oauthAccessTokenEnc: text("oauth_access_token_enc"),
  oauthRefreshTokenEnc: text("oauth_refresh_token_enc"),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }),
  status: text("status", { enum: ["active", "error", "disabled"] }).notNull().default("active"),
  lastSyncedAt: integer("last_synced_at", { mode: "timestamp_ms" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch('subsec') * 1000)`),
});

/* ------------------------------------------------------------------ */
/*  Google Ads                                                        */
/* ------------------------------------------------------------------ */

export const adsAccounts = sqliteTable(
  "ads_accounts",
  {
    id: text("id").primaryKey(),
    connectionId: text("connection_id")
      .notNull()
      .references(() => connections.id, { onDelete: "cascade" }),
    customerId: text("customer_id").notNull(),
    descriptiveName: text("descriptive_name"),
    currency: text("currency"),
    timeZone: text("time_zone"),
  },
  (t) => ({
    uniq: uniqueIndex("ads_accounts_unique_idx").on(t.connectionId, t.customerId),
  }),
);

export const adsKeywordDaily = sqliteTable(
  "ads_keyword_daily",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id")
      .notNull()
      .references(() => adsAccounts.id, { onDelete: "cascade" }),
    campaignId: text("campaign_id"),
    campaignName: text("campaign_name"),
    adGroupId: text("ad_group_id"),
    adGroupName: text("ad_group_name"),
    keyword: text("keyword").notNull(),
    matchType: text("match_type", { enum: ["exact", "phrase", "broad"] }).notNull(),
    date: text("date").notNull(), // YYYY-MM-DD
    country: text("country"),
    clicks: integer("clicks").notNull().default(0),
    impressions: integer("impressions").notNull().default(0),
    costMicros: integer("cost_micros").notNull().default(0),
    conversions: real("conversions").notNull().default(0),
    conversionsValue: real("conversions_value").notNull().default(0),
  },
  (t) => ({
    byKw: index("ads_kw_keyword_idx").on(t.keyword, t.date),
    byDate: index("ads_kw_date_idx").on(t.date),
  }),
);

export const adsSearchTermDaily = sqliteTable(
  "ads_search_term_daily",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id")
      .notNull()
      .references(() => adsAccounts.id, { onDelete: "cascade" }),
    keyword: text("keyword").notNull(),
    searchTerm: text("search_term").notNull(),
    matchType: text("match_type", { enum: ["exact", "phrase", "broad"] }).notNull(),
    date: text("date").notNull(),
    country: text("country"),
    clicks: integer("clicks").notNull().default(0),
    impressions: integer("impressions").notNull().default(0),
    costMicros: integer("cost_micros").notNull().default(0),
    conversions: real("conversions").notNull().default(0),
  },
  (t) => ({
    bySearchTerm: index("ads_st_term_idx").on(t.searchTerm, t.date),
  }),
);

/* ------------------------------------------------------------------ */
/*  GSC                                                               */
/* ------------------------------------------------------------------ */

export const gscProperties = sqliteTable(
  "gsc_properties",
  {
    id: text("id").primaryKey(),
    connectionId: text("connection_id")
      .notNull()
      .references(() => connections.id, { onDelete: "cascade" }),
    siteUrl: text("site_url").notNull(),
  },
  (t) => ({
    uniq: uniqueIndex("gsc_properties_unique_idx").on(t.connectionId, t.siteUrl),
  }),
);

export const gscQueryDaily = sqliteTable(
  "gsc_query_daily",
  {
    id: text("id").primaryKey(),
    propertyId: text("property_id")
      .notNull()
      .references(() => gscProperties.id, { onDelete: "cascade" }),
    date: text("date").notNull(),
    query: text("query").notNull(),
    page: text("page").notNull(),
    country: text("country").notNull(),
    device: text("device", { enum: ["desktop", "mobile", "tablet"] }).notNull(),
    clicks: integer("clicks").notNull().default(0),
    impressions: integer("impressions").notNull().default(0),
    ctr: real("ctr").notNull().default(0),
    position: real("position").notNull().default(0),
  },
  (t) => ({
    byQuery: index("gsc_query_idx").on(t.query, t.date),
    byDate: index("gsc_date_idx").on(t.date),
  }),
);

/* ------------------------------------------------------------------ */
/*  SERP snapshots                                                    */
/* ------------------------------------------------------------------ */

export const serpSnapshots = sqliteTable(
  "serp_snapshots",
  {
    id: text("id").primaryKey(),
    brandTermId: text("brand_term_id").references(() => brandTerms.id, { onDelete: "set null" }),
    query: text("query").notNull(),
    country: text("country").notNull(),
    language: text("language").notNull(),
    device: text("device", { enum: ["desktop", "mobile"] }).notNull(),
    fetchedAt: integer("fetched_at", { mode: "timestamp_ms" }).notNull(),
    costUsd: real("cost_usd").notNull().default(0),
    source: text("source", { enum: ["dataforseo"] }).notNull().default("dataforseo"),
  },
  (t) => ({
    byTerm: index("serp_snapshots_term_idx").on(t.brandTermId, t.fetchedAt),
    byQuery: index("serp_snapshots_query_idx").on(t.query, t.country, t.fetchedAt),
  }),
);

export const serpAds = sqliteTable(
  "serp_ads",
  {
    id: text("id").primaryKey(),
    snapshotId: text("snapshot_id")
      .notNull()
      .references(() => serpSnapshots.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    advertiserDomain: text("advertiser_domain").notNull(),
    title: text("title"),
    description: text("description"),
    displayUrl: text("display_url"),
    url: text("url"),
  },
  (t) => ({
    bySnap: index("serp_ads_snapshot_idx").on(t.snapshotId),
    byDomain: index("serp_ads_domain_idx").on(t.advertiserDomain),
  }),
);

export const serpOrganic = sqliteTable(
  "serp_organic",
  {
    id: text("id").primaryKey(),
    snapshotId: text("snapshot_id")
      .notNull()
      .references(() => serpSnapshots.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    domain: text("domain").notNull(),
    url: text("url"),
    title: text("title"),
  },
  (t) => ({
    bySnap: index("serp_organic_snapshot_idx").on(t.snapshotId),
  }),
);

/* ------------------------------------------------------------------ */
/*  derived / merged                                                  */
/* ------------------------------------------------------------------ */

export const brandMonitorDaily = sqliteTable(
  "brand_monitor_daily",
  {
    id: text("id").primaryKey(),
    brandId: text("brand_id")
      .notNull()
      .references(() => brands.id, { onDelete: "cascade" }),
    brandTermId: text("brand_term_id").references(() => brandTerms.id, { onDelete: "set null" }),
    term: text("term").notNull(),
    date: text("date").notNull(),
    country: text("country").notNull(),
    ourTopAdPos: integer("our_top_ad_pos"),
    competitorCount: integer("competitor_count").notNull().default(0),
    topCompetitorDomain: text("top_competitor_domain"),
    ourOrganicTop3: integer("our_organic_top3", { mode: "boolean" }).notNull().default(false),
    sovPaid: real("sov_paid").notNull().default(0),
    sovOrganic: real("sov_organic").notNull().default(0),
  },
  (t) => ({
    byTermDate: uniqueIndex("brand_monitor_daily_unique_idx").on(t.brandId, t.term, t.date, t.country),
    byDate: index("brand_monitor_daily_date_idx").on(t.date),
  }),
);

export const cannibalizationDaily = sqliteTable(
  "cannibalization_daily",
  {
    id: text("id").primaryKey(),
    brandId: text("brand_id")
      .notNull()
      .references(() => brands.id, { onDelete: "cascade" }),
    query: text("query").notNull(),
    page: text("page"),
    date: text("date").notNull(),
    country: text("country").notNull(),
    paidClicks: integer("paid_clicks").notNull().default(0),
    paidImpressions: integer("paid_impressions").notNull().default(0),
    paidCostMicros: integer("paid_cost_micros").notNull().default(0),
    organicClicks: integer("organic_clicks").notNull().default(0),
    organicImpressions: integer("organic_impressions").notNull().default(0),
    organicCtr: real("organic_ctr").notNull().default(0),
    organicPosition: real("organic_position").notNull().default(0),
    combinedClicks: integer("combined_clicks").notNull().default(0),
  },
  (t) => ({
    byQuery: index("cann_daily_query_idx").on(t.query, t.date),
    uniq: uniqueIndex("cann_daily_unique_idx").on(t.brandId, t.query, t.date, t.country),
  }),
);

export const incrementalityMetrics = sqliteTable(
  "incrementality_metrics",
  {
    id: text("id").primaryKey(),
    brandId: text("brand_id")
      .notNull()
      .references(() => brands.id, { onDelete: "cascade" }),
    query: text("query").notNull(),
    country: text("country").notNull(),
    windowStart: text("window_start").notNull(),
    windowEnd: text("window_end").notNull(),
    daysPaidOn: integer("days_paid_on").notNull().default(0),
    daysPaidOff: integer("days_paid_off").notNull().default(0),
    ctrWithSem: real("ctr_with_sem").notNull().default(0),
    ctrWithoutSem: real("ctr_without_sem").notNull().default(0),
    incrementalCtr: real("incremental_ctr").notNull().default(0),
    paidClicks: integer("paid_clicks").notNull().default(0),
    paidImpressions: integer("paid_impressions").notNull().default(0),
    paidCostMicros: integer("paid_cost_micros").notNull().default(0),
    incrementalClicks: real("incremental_clicks").notNull().default(0),
    costPerIncrementalClick: real("cost_per_incremental_click").notNull().default(0),
    sampleConfidence: real("sample_confidence").notNull().default(0),
  },
  (t) => ({
    byBrand: index("incr_brand_idx").on(t.brandId, t.windowEnd),
    uniq: uniqueIndex("incr_unique_idx").on(t.brandId, t.query, t.country, t.windowStart, t.windowEnd),
  }),
);

export const nklgRecommendations = sqliteTable(
  "nklg_recommendations",
  {
    id: text("id").primaryKey(),
    brandId: text("brand_id")
      .notNull()
      .references(() => brands.id, { onDelete: "cascade" }),
    keyword: text("keyword").notNull(),
    matchType: text("match_type", { enum: ["exact", "phrase", "broad"] }).notNull().default("exact"),
    country: text("country").notNull(),
    decision: text("decision", { enum: ["add_negative", "keep_paying", "re_enable"] }).notNull(),
    reason: text("reason").notNull(),
    organicPosition: real("organic_position").notNull().default(0),
    organicCtr: real("organic_ctr").notNull().default(0),
    paidCompetitorDensity: real("paid_competitor_density").notNull().default(0),
    paidCostMicros: integer("paid_cost_micros").notNull().default(0),
    paidClicks: integer("paid_clicks").notNull().default(0),
    savingsOpportunityMicros: integer("savings_opportunity_micros").notNull().default(0),
    confidence: real("confidence").notNull().default(0),
    evaluatedAt: integer("evaluated_at", { mode: "timestamp_ms" }).notNull(),
    status: text("status", { enum: ["open", "applied", "dismissed"] }).notNull().default("open"),
  },
  (t) => ({
    byBrand: index("nklg_brand_idx").on(t.brandId, t.evaluatedAt),
    uniq: uniqueIndex("nklg_unique_idx").on(t.brandId, t.keyword, t.country),
  }),
);

/* ------------------------------------------------------------------ */
/*  alerts                                                            */
/* ------------------------------------------------------------------ */

export const alertRules = sqliteTable("alert_rules", {
  id: text("id").primaryKey(),
  brandId: text("brand_id")
    .notNull()
    .references(() => brands.id, { onDelete: "cascade" }),
  type: text("type", {
    enum: [
      "competitor_new",
      "competitor_returning",
      "hijack_detected",
      "ranking_drop",
      "nklg_re_enable",
      "ingestion_failed",
    ],
  }).notNull(),
  paramsJson: text("params_json").notNull().default("{}"),
  channel: text("channel", { enum: ["email", "webhook", "slack"] }).notNull().default("email"),
  channelTarget: text("channel_target"),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch('subsec') * 1000)`),
});

export const alertEvents = sqliteTable(
  "alert_events",
  {
    id: text("id").primaryKey(),
    ruleId: text("rule_id")
      .notNull()
      .references(() => alertRules.id, { onDelete: "cascade" }),
    firedAt: integer("fired_at", { mode: "timestamp_ms" }).notNull(),
    payloadJson: text("payload_json").notNull().default("{}"),
    deliveredAt: integer("delivered_at", { mode: "timestamp_ms" }),
    deliveryStatus: text("delivery_status", { enum: ["pending", "delivered", "failed"] })
      .notNull()
      .default("pending"),
    deliveryError: text("delivery_error"),
  },
  (t) => ({
    byRule: index("alert_events_rule_idx").on(t.ruleId, t.firedAt),
    byFired: index("alert_events_fired_idx").on(t.firedAt),
  }),
);

/* ------------------------------------------------------------------ */
/*  jobs                                                              */
/* ------------------------------------------------------------------ */

export const schedules = sqliteTable("schedules", {
  id: text("id").primaryKey(),
  connectorType: text("connector_type", {
    enum: ["google_ads", "search_console", "dataforseo", "evaluator", "alerts"],
  }).notNull(),
  cronExpr: text("cron_expr").notNull(),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  lastRunAt: integer("last_run_at", { mode: "timestamp_ms" }),
});

export const jobRuns = sqliteTable(
  "job_runs",
  {
    id: text("id").primaryKey(),
    scheduleId: text("schedule_id").references(() => schedules.id, { onDelete: "set null" }),
    kind: text("kind").notNull(),
    startedAt: integer("started_at", { mode: "timestamp_ms" }).notNull(),
    endedAt: integer("ended_at", { mode: "timestamp_ms" }),
    status: text("status", { enum: ["running", "ok", "error"] }).notNull().default("running"),
    error: text("error"),
    rowsIngested: integer("rows_ingested").notNull().default(0),
    costUsd: real("cost_usd").notNull().default(0),
  },
  (t) => ({
    byKind: index("job_runs_kind_idx").on(t.kind, t.startedAt),
  }),
);
