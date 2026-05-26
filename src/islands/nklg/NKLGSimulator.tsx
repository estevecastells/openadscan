import { useMemo, useState } from "hono/jsx";
import { evaluateNKLG, type NKLGObservation } from "@/features/nklg/evaluator";
import { DEFAULT_THRESHOLDS } from "@/features/nklg/config";

/**
 * Client-side simulator: drag the thresholds, see how many of the supplied
 * observations would flip to add_negative / keep_paying / re_enable.
 */
export default function NKLGSimulator(props: { observations: NKLGObservation[] }) {
  const [maxPos, setMaxPos] = useState(DEFAULT_THRESHOLDS.maxOrganicPos);
  const [minCtr, setMinCtr] = useState(DEFAULT_THRESHOLDS.minOrganicCtr);
  const [maxCompetitors, setMaxCompetitors] = useState(DEFAULT_THRESHOLDS.maxCompetitorDensity);
  const [minDays, setMinDays] = useState(DEFAULT_THRESHOLDS.minDaysObserved);

  const counts = useMemo(() => {
    let pause = 0;
    let keep = 0;
    let re = 0;
    let savings = 0;
    for (const obs of props.observations) {
      const r = evaluateNKLG(obs, {
        maxOrganicPos: maxPos,
        minOrganicCtr: minCtr,
        maxCompetitorDensity: maxCompetitors,
        minDaysObserved: minDays,
        minConfidence: DEFAULT_THRESHOLDS.minConfidence,
      });
      if (r.decision === "add_negative") {
        pause += 1;
        savings += r.savingsOpportunityMicros;
      } else if (r.decision === "re_enable") {
        re += 1;
      } else {
        keep += 1;
      }
    }
    return { pause, keep, re, savings };
  }, [maxPos, minCtr, maxCompetitors, minDays, props.observations]);

  return (
    <div class="space-y-4">
      <div class="grid grid-cols-2 gap-4">
        <label class="block">
          <div class="text-xs text-muted mb-1">Max organic position: <strong>{maxPos.toFixed(0)}</strong></div>
          <input type="range" min="1" max="10" step="1" value={maxPos} onInput={(e) => setMaxPos(Number((e.target as HTMLInputElement).value))} class="w-full" />
        </label>
        <label class="block">
          <div class="text-xs text-muted mb-1">Min organic CTR: <strong>{(minCtr * 100).toFixed(0)}%</strong></div>
          <input type="range" min="0" max="0.6" step="0.01" value={minCtr} onInput={(e) => setMinCtr(Number((e.target as HTMLInputElement).value))} class="w-full" />
        </label>
        <label class="block">
          <div class="text-xs text-muted mb-1">Max competitor density: <strong>{maxCompetitors.toFixed(1)}</strong></div>
          <input type="range" min="0" max="5" step="0.1" value={maxCompetitors} onInput={(e) => setMaxCompetitors(Number((e.target as HTMLInputElement).value))} class="w-full" />
        </label>
        <label class="block">
          <div class="text-xs text-muted mb-1">Min days observed: <strong>{minDays}</strong></div>
          <input type="range" min="1" max="56" step="1" value={minDays} onInput={(e) => setMinDays(Number((e.target as HTMLInputElement).value))} class="w-full" />
        </label>
      </div>
      <div class="grid grid-cols-4 gap-3 text-center">
        <div class="card p-3"><div class="text-xs text-muted">Pause</div><div class="text-2xl font-semibold text-positive">{counts.pause}</div></div>
        <div class="card p-3"><div class="text-xs text-muted">Keep paying</div><div class="text-2xl font-semibold">{counts.keep}</div></div>
        <div class="card p-3"><div class="text-xs text-muted">Re-enable</div><div class="text-2xl font-semibold text-danger">{counts.re}</div></div>
        <div class="card p-3"><div class="text-xs text-muted">Savings opp.</div><div class="text-2xl font-semibold text-positive">${(counts.savings / 1_000_000).toFixed(0)}</div></div>
      </div>
    </div>
  );
}
