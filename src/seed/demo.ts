/**
 * Demo seeder. Populates a local D1 database with a believable brand, terms,
 * Ads + GSC daily history, SERP snapshots, NKLG recommendations, and alerts.
 *
 * Run via:
 *   wrangler d1 execute DB --local --command "DELETE FROM admin_user;"  # optional reset
 *   pnpm dlx tsx src/seed/demo.ts          # writes JSON fixtures
 *   wrangler d1 execute DB --local --file=./seed/demo.sql
 *
 * The file emits a SQL script you can re-run anytime.
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";

function uid(): string {
  return Math.random().toString(36).slice(2, 14) + Math.random().toString(36).slice(2, 14);
}

function isoMinus(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

function quote(v: unknown): string {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return v ? "1" : "0";
  return `'${String(v).replace(/'/g, "''")}'`;
}

function insertRow(table: string, row: Record<string, unknown>): string {
  const cols = Object.keys(row).join(", ");
  const vals = Object.values(row).map(quote).join(", ");
  return `INSERT INTO ${table} (${cols}) VALUES (${vals});`;
}

const out: string[] = [];

// Brand
const brandId = uid();
out.push(insertRow("brands", { id: brandId, name: "Acme", domain: "acme.com", created_at: Date.now() }));

const terms = [
  { id: uid(), term: "acme", country: "US", language: "en" },
  { id: uid(), term: "acme shoes", country: "US", language: "en" },
  { id: uid(), term: "acme support", country: "US", language: "en" },
  { id: uid(), term: "buy acme", country: "GB", language: "en" },
];
for (const t of terms) {
  out.push(
    insertRow("brand_terms", {
      id: t.id,
      brand_id: brandId,
      term: t.term,
      match_type: "exact",
      country: t.country,
      language: t.language,
      monitor_paid: 1,
      created_at: Date.now(),
    }),
  );
}

// Connection placeholder
out.push(
  insertRow("connections", {
    id: uid(),
    type: "google_ads",
    display_name: "Demo Google Ads",
    config_json: JSON.stringify({ customerId: "1234567890" }),
    status: "active",
    created_at: Date.now(),
  }),
);
const adsAccountId = uid();
out.push(
  insertRow("ads_accounts", {
    id: adsAccountId,
    connection_id: uid(),
    customer_id: "1234567890",
    descriptive_name: "Acme USA",
    currency: "USD",
    time_zone: "America/Los_Angeles",
  }),
);

// 30 days of Ads + GSC data
const keywords = [
  { kw: "acme", country: "US", organicCtr: 0.42, organicPos: 1.2, paidCpc: 0.5, competitors: 0 },
  { kw: "acme shoes", country: "US", organicCtr: 0.31, organicPos: 1.8, paidCpc: 0.9, competitors: 0 },
  { kw: "acme support", country: "US", organicCtr: 0.55, organicPos: 1.0, paidCpc: 0.2, competitors: 0 },
  { kw: "buy acme", country: "GB", organicCtr: 0.08, organicPos: 4.5, paidCpc: 1.4, competitors: 2 },
  { kw: "cheap acme", country: "US", organicCtr: 0.04, organicPos: 7.2, paidCpc: 0.8, competitors: 3 },
  { kw: "best acme alternative", country: "US", organicCtr: 0.12, organicPos: 3.1, paidCpc: 1.1, competitors: 4 },
];

const propertyId = uid();
out.push(insertRow("gsc_properties", { id: propertyId, connection_id: uid(), site_url: "sc-domain:acme.com" }));

for (let i = 0; i < 30; i++) {
  const date = isoMinus(i);
  for (const k of keywords) {
    const imp = 200 + Math.floor(Math.random() * 1500);
    const organicClicks = Math.max(0, Math.round(imp * k.organicCtr * (0.8 + Math.random() * 0.4)));
    out.push(
      insertRow("gsc_query_daily", {
        id: uid(),
        property_id: propertyId,
        date,
        query: k.kw,
        page: `https://acme.com/${k.kw.replace(/\s+/g, "-")}`,
        country: k.country.toLowerCase(),
        device: "desktop",
        clicks: organicClicks,
        impressions: imp,
        ctr: imp > 0 ? organicClicks / imp : 0,
        position: k.organicPos + (Math.random() - 0.5) * 0.4,
      }),
    );

    const paidImp = 80 + Math.floor(Math.random() * 600);
    const paidClicks = Math.max(0, Math.round(paidImp * (0.06 + Math.random() * 0.04)));
    const costMicros = paidClicks * Math.round(k.paidCpc * 1_000_000);
    out.push(
      insertRow("ads_keyword_daily", {
        id: uid(),
        account_id: adsAccountId,
        campaign_id: "c1",
        campaign_name: "Brand",
        ad_group_id: "ag1",
        ad_group_name: "Core",
        keyword: k.kw,
        match_type: "exact",
        date,
        country: k.country,
        clicks: paidClicks,
        impressions: paidImp,
        cost_micros: costMicros,
        conversions: paidClicks * 0.04,
        conversions_value: paidClicks * 0.04 * 50,
      }),
    );
  }
}

// SERP snapshots + ads/organic for each term (last 7 days, one per day)
for (let i = 0; i < 7; i++) {
  const ts = Date.now() - i * 24 * 60 * 60 * 1000;
  for (const t of terms) {
    const snapId = uid();
    out.push(
      insertRow("serp_snapshots", {
        id: snapId,
        brand_term_id: t.id,
        query: t.term,
        country: t.country,
        language: t.language,
        device: "desktop",
        fetched_at: ts,
        cost_usd: 0.0025,
        source: "dataforseo",
      }),
    );
    // Our organic in top 3 for most terms
    out.push(insertRow("serp_organic", { id: uid(), snapshot_id: snapId, position: 1, domain: "acme.com", url: "https://acme.com/" }));
    out.push(insertRow("serp_organic", { id: uid(), snapshot_id: snapId, position: 2, domain: "wikipedia.org" }));
    // Competitor ads only on the 'buy acme' / 'cheap acme'-style terms
    if (t.term === "buy acme") {
      out.push(insertRow("serp_ads", { id: uid(), snapshot_id: snapId, position: 1, advertiser_domain: "competitor-a.com", title: "Buy Acme — better deals" }));
      out.push(insertRow("serp_ads", { id: uid(), snapshot_id: snapId, position: 2, advertiser_domain: "competitor-b.com", title: "Acme alternatives" }));
    }
  }
}

// A precomputed NKLG recommendation (so the dashboard renders without running the evaluator)
out.push(
  insertRow("nklg_recommendations", {
    id: uid(),
    brand_id: brandId,
    keyword: "acme support",
    match_type: "exact",
    country: "US",
    decision: "add_negative",
    reason: "Organic ranks at ~1.0 with CTR 55.0%, and no paid competitors observed. Negative this keyword to save paid spend.",
    organic_position: 1.0,
    organic_ctr: 0.55,
    paid_competitor_density: 0,
    paid_cost_micros: 9_500_000,
    paid_clicks: 47,
    savings_opportunity_micros: 9_500_000,
    confidence: 0.82,
    evaluated_at: Date.now(),
    status: "open",
  }),
);

const outPath = join(process.cwd(), "seed", "demo.sql");
writeFileSync(outPath, out.join("\n"));
console.log(`Wrote ${out.length} statements to ${outPath}`);
