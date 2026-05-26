import { and, eq } from "drizzle-orm";
import type { Bindings } from "@/env";
import { db, schema } from "@/lib/db/client";
import { toCsv } from "@/lib/csv";

/**
 * Export all `add_negative` decisions for a brand as a Google Ads-compatible
 * negative keyword list CSV.
 *
 * Format:
 *   Keyword,Match Type,Country
 *   shoes,Exact,US
 *   blue shoes,Phrase,US
 */
export async function exportNegativeKeywordList(env: Bindings, brandId: string): Promise<string> {
  const rows = await db(env)
    .select()
    .from(schema.nklgRecommendations)
    .where(
      and(
        eq(schema.nklgRecommendations.brandId, brandId),
        eq(schema.nklgRecommendations.decision, "add_negative"),
      ),
    );
  const flat = rows.map((r) => ({
    Keyword: r.keyword,
    "Match Type": r.matchType.charAt(0).toUpperCase() + r.matchType.slice(1),
    Country: r.country,
    Confidence: r.confidence.toFixed(3),
    "Savings (USD)": (r.savingsOpportunityMicros / 1_000_000).toFixed(2),
  }));
  return toCsv(flat, ["Keyword", "Match Type", "Country", "Confidence", "Savings (USD)"]);
}
