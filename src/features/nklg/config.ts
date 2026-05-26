/**
 * NKLG thresholds. These are the levers exposed in the UI simulator and on
 * the Settings page. Defaults reflect the Adevinta team's experience.
 */
export type NKLGThresholds = {
  /** Max organic position to still recommend pausing paid bidding (inclusive). */
  maxOrganicPos: number;
  /** Min organic CTR. Brand terms tend to land ≥ 0.20; non-brand ≥ 0.05. */
  minOrganicCtr: number;
  /** Max mean competitor density across the window (0 = nobody bidding). */
  maxCompetitorDensity: number;
  /** Min days of observation to trust the recommendation. */
  minDaysObserved: number;
  /** Min Wilson-floor confidence to surface in the "ready to apply" view. */
  minConfidence: number;
};

export const DEFAULT_THRESHOLDS: NKLGThresholds = {
  maxOrganicPos: 2,
  minOrganicCtr: 0.2,
  maxCompetitorDensity: 0,
  minDaysObserved: 14,
  minConfidence: 0.4,
};
