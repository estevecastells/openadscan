/**
 * GAQL query templates. We intentionally keep them as plain strings here so
 * they're easy to copy/paste into the Google Ads Query Builder for debugging.
 */

export function keywordPerformanceGAQL(dateFrom: string, dateTo: string): string {
  return `
    SELECT
      segments.date,
      campaign.id,
      campaign.name,
      ad_group.id,
      ad_group.name,
      ad_group_criterion.keyword.text,
      ad_group_criterion.keyword.match_type,
      metrics.clicks,
      metrics.impressions,
      metrics.cost_micros,
      metrics.conversions,
      metrics.conversions_value
    FROM keyword_view
    WHERE segments.date BETWEEN '${dateFrom}' AND '${dateTo}'
      AND ad_group_criterion.status = 'ENABLED'
      AND campaign.status = 'ENABLED'
  `.trim();
}

export function searchTermGAQL(dateFrom: string, dateTo: string): string {
  return `
    SELECT
      segments.date,
      campaign.id,
      ad_group.id,
      search_term_view.search_term,
      segments.keyword.info.text,
      segments.keyword.info.match_type,
      metrics.clicks,
      metrics.impressions,
      metrics.cost_micros,
      metrics.conversions
    FROM search_term_view
    WHERE segments.date BETWEEN '${dateFrom}' AND '${dateTo}'
  `.trim();
}

/** Paid + organic combined view. The gold mine for cannibalization analysis. */
export function paidOrganicGAQL(dateFrom: string, dateTo: string): string {
  return `
    SELECT
      segments.date,
      segments.search_term,
      paid_organic_search_term_view.search_term,
      metrics.clicks,
      metrics.impressions,
      metrics.organic_clicks,
      metrics.organic_impressions,
      metrics.combined_clicks,
      metrics.combined_queries,
      metrics.average_cpc
    FROM paid_organic_search_term_view
    WHERE segments.date BETWEEN '${dateFrom}' AND '${dateTo}'
  `.trim();
}
