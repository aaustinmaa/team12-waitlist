// Back-test: replay the past and check the ranges against what really happened.
//
// For every referral that became ready for a first assessment in the past
// year, rebuild the line as it stood that day, fit the numbers from what was
// known that day, and estimate its wait. Then compare with the day it was
// actually assessed. Referrals that were withdrawn tell us nothing about the
// wait and are left out. Referrals still waiting count as "later" once they
// have waited past the top of their range, and are left out until then.
//
// The calibration factor k is the smallest widening of every raw range that
// makes at least 8 in 10 past families' real wait fall inside it. It is chosen
// on the same past referrals it is reported on, so the coverage shown is
// in-sample; the Model page says so.

import { fitParams, type FittedParams } from "./fit";
import { calibrated, rawRange, simulateWaits, type Calibration, type RawRange } from "./simulate";
import { bookedByWeek, isOnHoldOn, lineOn, pendingAheadOf } from "./timeline";
import type { Priority, ReferralRecord } from "./types";
import { addDays, daysBetween, median } from "./util";

export const TARGET_COVERAGE = 0.8;
const K_STEPS = Array.from({ length: 41 }, (_, i) => 1 + i * 0.05); // 1.00 … 3.00

export type BacktestResult = "inside" | "earlier" | "later";

export interface BacktestCase {
  referral_id: string;
  /** the day the range would have been shown (intake complete) */
  as_of: string;
  priority: Priority;
  position: number;
  raw: RawRange;
  /** weeks from as_of to the first assessment, or null if not assessed yet */
  actual: number | null;
  /** weeks waited so far for a referral still waiting at the end of the data */
  waitedSoFar: number | null;
}

export interface Backtest {
  cases: BacktestCase[];
  /** chosen calibration: speed correction and widening */
  calibration: Calibration;
  /** share inside the raw (uncalibrated) range, over resolved cases */
  coverageRaw: number | null;
  /** share inside the calibrated range */
  coverage: number | null;
  /** cases with a known outcome at the chosen k */
  resolved: number;
  /** median width of the calibrated range, in weeks */
  medianWidth: number | null;
}

export function weeksToEvent(from: string, to: string) {
  return Math.floor(daysBetween(from, to) / 7) + 1;
}

export function judge(c: BacktestCase, cal: Calibration): BacktestResult | null {
  const range = calibrated(c.raw, cal);
  if (c.actual !== null) {
    if (!range) return "earlier";
    return c.actual < range.lower ? "earlier" : c.actual > range.upper ? "later" : "inside";
  }
  if (c.waitedSoFar !== null && range && c.waitedSoFar > range.upper) return "later";
  return null;
}

function coverageAt(cases: BacktestCase[], cal: Calibration) {
  let inside = 0;
  let n = 0;
  for (const c of cases) {
    const j = judge(c, cal);
    if (j === null) continue;
    n++;
    if (j === "inside") inside++;
  }
  return { coverage: n ? inside / n : null, n };
}

export interface BacktestOptions {
  asOf: string;
  /** how far back to replay */
  weeks?: number;
  runs?: number;
}

export function runBacktest(records: ReferralRecord[], { asOf, weeks = 52, runs = 150 }: BacktestOptions): Backtest {
  const first = records.reduce((m, r) => (r.received_on < m ? r.received_on : m), asOf);
  // Need half a year of history before a replayed day for the fit to mean anything.
  const from = [addDays(asOf, -7 * weeks), addDays(first, 182)].sort().at(-1)!;
  const fits = new Map<string, FittedParams>();
  const cases: BacktestCase[] = [];

  for (const r of records) {
    const d = r.intake_completed_on;
    if (!d || d < from || d >= asOf) continue;
    if (r.close_reason === "withdrawn") continue;
    if (isOnHoldOn(r, d)) continue;
    const state = lineOn(records, d);
    const position = state.ready.findIndex((x) => x.referral_id === r.referral_id) + 1;
    if (position === 0) continue; // booked the same day: nothing to estimate
    let params = fits.get(d);
    if (!params) fits.set(d, (params = fitParams(records, d)));
    const waits = simulateWaits({
      position,
      priority: r.priority,
      params,
      booked: bookedByWeek(state, 78),
      pendingAhead: pendingAheadOf(state, r),
      runs,
      seed: `bt:${r.referral_id}:${d}`,
    });
    const assessed = r.close_reason === "assessed" && r.closed_on !== null && r.closed_on <= asOf;
    cases.push({
      referral_id: r.referral_id,
      as_of: d,
      priority: r.priority,
      position,
      raw: rawRange(waits),
      actual: assessed ? weeksToEvent(d, r.closed_on!) : null,
      waitedSoFar: assessed ? null : weeksToEvent(d, asOf) - 1,
    });
  }

  const raw = coverageAt(cases, { speed: 1, k: 1 });
  // Speed: the median ratio of real to simulated wait. Referrals still waiting are
  // left out, which leans it slightly fast; the widening below makes up for that.
  const ratios = cases.filter((c) => c.actual !== null && Number.isFinite(c.raw.q50) && c.raw.q50 > 0).map((c) => c.actual! / c.raw.q50);
  const speed = ratios.length >= 10 ? Math.round(Math.min(1.6, Math.max(0.6, median(ratios))) * 100) / 100 : 1;
  let k = K_STEPS[K_STEPS.length - 1];
  for (const step of K_STEPS) {
    const c = coverageAt(cases, { speed, k: step }).coverage;
    if (c !== null && c >= TARGET_COVERAGE) {
      k = step;
      break;
    }
  }
  const calibration = { speed, k: Math.round(k * 100) / 100 };
  const at = coverageAt(cases, calibration);
  const widths = cases
    .map((c) => calibrated(c.raw, calibration))
    .filter((x): x is { lower: number; upper: number } => x !== null)
    .map((x) => x.upper - x.lower)
    .sort((a, b) => a - b);
  return {
    cases,
    calibration,
    coverageRaw: raw.coverage,
    coverage: at.coverage,
    resolved: at.n,
    medianWidth: widths.length ? widths[Math.floor(widths.length / 2)] : null,
  };
}
