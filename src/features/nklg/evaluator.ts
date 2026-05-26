/**
 * NKLG evaluator — pure logic, no IO. Given aggregated observations for a
 * single (keyword, market) over a window, decide whether to:
 *
 *   - add the term to the negative keyword list   (organic strong, no competitors)
 *   - keep paying for it                          (organic weak, or competitors active)
 *   - re-enable a previously paused term          (competitor returned)
 *
 * Originally built at Adevinta with Marcin, Filippo, and the SAI team.
 * See docs/features/nklg.md for the full origin story.
 */
import { nklgConfidence } from "@/lib/stats";
import type { NKLGThresholds } from "./config";
import { DEFAULT_THRESHOLDS } from "./config";

export type NKLGObservation = {
  keyword: string;
  country: string;
  /** Number of days in the observation window. */
  daysObserved: number;
  /** Mean organic ranking across the window (lower is better). */
  avgOrganicPosition: number;
  /** Total clicks on organic for the same window. */
  organicClicks: number;
  organicImpressions: number;
  /** Mean # of competitor advertisers per SERP across the window. */
  paidCompetitorDensity: number;
  /** Spend captured by the matched paid keyword(s) in the same window, in micros. */
  paidCostMicros: number;
  paidClicks: number;
  paidImpressions: number;
  /** Whether a prior recommendation has already been applied (i.e. negative is live). */
  previouslyApplied?: boolean;
};

export type NKLGDecision = "add_negative" | "keep_paying" | "re_enable";

export type NKLGResult = {
  decision: NKLGDecision;
  reason: string;
  organicCtr: number;
  organicPosition: number;
  paidCompetitorDensity: number;
  paidCostMicros: number;
  paidClicks: number;
  savingsOpportunityMicros: number;
  confidence: number;
};

export function evaluateNKLG(
  obs: NKLGObservation,
  thresholds: NKLGThresholds = DEFAULT_THRESHOLDS,
): NKLGResult {
  const organicCtr =
    obs.organicImpressions > 0 ? obs.organicClicks / obs.organicImpressions : 0;

  const confidence = nklgConfidence({
    organicCtr,
    organicImpressions: obs.organicImpressions,
    organicPosition: obs.avgOrganicPosition,
    paidCompetitorDensity: obs.paidCompetitorDensity,
    daysObserved: obs.daysObserved,
  });

  // Re-enable branch: a previously-applied recommendation but a competitor is now bidding.
  if (obs.previouslyApplied && obs.paidCompetitorDensity > thresholds.maxCompetitorDensity) {
    return {
      decision: "re_enable",
      reason: `Competitor activity returned (mean density ${obs.paidCompetitorDensity.toFixed(2)} > ${thresholds.maxCompetitorDensity}). Reactivate paid bidding to defend the brand term.`,
      organicCtr,
      organicPosition: obs.avgOrganicPosition,
      paidCompetitorDensity: obs.paidCompetitorDensity,
      paidCostMicros: obs.paidCostMicros,
      paidClicks: obs.paidClicks,
      savingsOpportunityMicros: 0,
      confidence,
    };
  }

  // Sufficient evidence guard.
  if (obs.daysObserved < thresholds.minDaysObserved) {
    return {
      decision: "keep_paying",
      reason: `Not enough observation history (${obs.daysObserved} < ${thresholds.minDaysObserved} days).`,
      organicCtr,
      organicPosition: obs.avgOrganicPosition,
      paidCompetitorDensity: obs.paidCompetitorDensity,
      paidCostMicros: obs.paidCostMicros,
      paidClicks: obs.paidClicks,
      savingsOpportunityMicros: 0,
      confidence,
    };
  }

  // Core "pause it" rule
  const organicStrong =
    obs.avgOrganicPosition > 0 &&
    obs.avgOrganicPosition <= thresholds.maxOrganicPos &&
    organicCtr >= thresholds.minOrganicCtr;
  const competitorsAbsent = obs.paidCompetitorDensity <= thresholds.maxCompetitorDensity;

  if (organicStrong && competitorsAbsent) {
    // Savings opportunity is the paid cost over the window — that's what we'd save
    // by switching this term off without (predicted) traffic loss.
    return {
      decision: "add_negative",
      reason: `Organic ranks at ~${obs.avgOrganicPosition.toFixed(1)} with CTR ${(organicCtr * 100).toFixed(1)}%, and no paid competitors observed. Negative this keyword to save paid spend.`,
      organicCtr,
      organicPosition: obs.avgOrganicPosition,
      paidCompetitorDensity: obs.paidCompetitorDensity,
      paidCostMicros: obs.paidCostMicros,
      paidClicks: obs.paidClicks,
      savingsOpportunityMicros: obs.paidCostMicros,
      confidence,
    };
  }

  // Otherwise: keep paying, with a reason that helps the user diagnose.
  let reason: string;
  if (!organicStrong && competitorsAbsent) {
    reason = `Organic not strong enough (pos ${obs.avgOrganicPosition.toFixed(1)} / CTR ${(organicCtr * 100).toFixed(1)}%). Paid bidding still earning incremental traffic.`;
  } else if (organicStrong && !competitorsAbsent) {
    reason = `Organic strong but competitors are bidding (density ${obs.paidCompetitorDensity.toFixed(2)}). Keep paid bidding to defend the SERP.`;
  } else {
    reason = `Both organic ranking and competitive landscape suggest keeping paid bidding active.`;
  }
  return {
    decision: "keep_paying",
    reason,
    organicCtr,
    organicPosition: obs.avgOrganicPosition,
    paidCompetitorDensity: obs.paidCompetitorDensity,
    paidCostMicros: obs.paidCostMicros,
    paidClicks: obs.paidClicks,
    savingsOpportunityMicros: 0,
    confidence,
  };
}
