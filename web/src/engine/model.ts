// Put the engine together for one clinic: fit, back-test, survival check, and
// the gate that decides whether families may see a range at all.

import { runBacktest, type Backtest } from "./backtest";
import { fitParams, type FittedParams } from "./fit";
import { calibrated, rawRange, simulateWaits, NO_SCENARIO, type RawRange, type Scenario } from "./simulate";
import { kaplanMeier, type SurvivalSummary } from "./survival";
import { bookedByWeek, lineOn, pendingAheadOf } from "./timeline";
import { PRIORITIES, type Priority, type ReferralRecord } from "./types";

/** Below these, families are told there isn't enough data yet; staff still see the range, marked. */
export const GATE = { minAssessed: 12, minResolved: 20, minCoverage: 0.7, maxK: 2.5 };

export interface EngineModel {
  asOf: string;
  params: FittedParams;
  backtest: Backtest;
  survival: Record<Priority | "all", SurvivalSummary>;
  gate: { familyVisible: boolean; failed: string[] };
}

export function buildModel(records: ReferralRecord[], asOf: string): EngineModel {
  const params = fitParams(records, asOf);
  const backtest = runBacktest(records, { asOf });
  const survival = {
    all: kaplanMeier(records, asOf),
    ...Object.fromEntries(PRIORITIES.map((p) => [p, kaplanMeier(records, asOf, { priority: p })])),
  } as EngineModel["survival"];
  const failed: string[] = [];
  if (params.assessed < GATE.minAssessed) failed.push(`only ${params.assessed} first assessments in the last ${params.windowWeeks} weeks (need ${GATE.minAssessed})`);
  if (backtest.resolved < GATE.minResolved) failed.push(`only ${backtest.resolved} past referrals to check the ranges against (need ${GATE.minResolved})`);
  if (backtest.coverage !== null && backtest.coverage < GATE.minCoverage)
    failed.push(`past ranges held for ${Math.round(backtest.coverage * 100)}% of families (need ${GATE.minCoverage * 100}%)`);
  if (backtest.calibration.k > GATE.maxK) failed.push(`ranges had to be widened ${backtest.calibration.k}× to hold (limit ${GATE.maxK}×)`);
  return { asOf, params, backtest, survival, gate: { familyVisible: failed.length === 0, failed } };
}

export type LineStatus = "ready" | "booked" | "on_hold" | "intake_pending" | "closed";

export interface LiveEstimate {
  status: LineStatus;
  /** 1-based place among ready referrals */
  position: number | null;
  raw: RawRange | null;
  /** calibrated range, null when there is none */
  range: { lower: number; upper: number } | null;
  /** why there is no range, when there isn't */
  reason: "intake_incomplete" | "on_hold" | "booked" | "beyond_horizon" | "insufficient_data" | null;
}

export function estimateAll(
  records: ReferralRecord[],
  model: EngineModel,
  scenario: Scenario = NO_SCENARIO,
  runs = 300,
): Map<string, LiveEstimate> {
  const state = lineOn(records, model.asOf);
  const booked = bookedByWeek(state, 78);
  const out = new Map<string, LiveEstimate>();
  const none = (status: LineStatus, reason: LiveEstimate["reason"]): LiveEstimate => ({ status, position: null, raw: null, range: null, reason });
  for (const b of state.booked) out.set(b.record.referral_id, none("booked", "booked"));
  for (const r of state.onHold) out.set(r.referral_id, none("on_hold", "on_hold"));
  for (const r of state.intakePending) out.set(r.referral_id, none("intake_pending", "intake_incomplete"));
  const key = `${scenario.extraSlots}@${scenario.fromWeek}`;
  state.ready.forEach((r, i) => {
    const raw = rawRange(
      simulateWaits({ position: i + 1, priority: r.priority, params: model.params, booked, pendingAhead: pendingAheadOf(state, r), scenario, runs, seed: `${r.referral_id}:${model.asOf}:${key}` }),
    );
    const range = calibrated(raw, model.backtest.calibration);
    out.set(r.referral_id, {
      status: "ready",
      position: i + 1,
      raw,
      range,
      reason: range ? (model.gate.familyVisible ? null : "insufficient_data") : "beyond_horizon",
    });
  });
  for (const r of records) if (!out.has(r.referral_id)) out.set(r.referral_id, none("closed", null));
  return out;
}

/** The range a referral that became ready today would get, at each priority. */
export function newReferralRanges(records: ReferralRecord[], model: EngineModel, scenario: Scenario = NO_SCENARIO) {
  const state = lineOn(records, model.asOf);
  const booked = bookedByWeek(state, 78);
  const rank = (p: Priority) => PRIORITIES.indexOf(p);
  const out = {} as Record<Priority, { lower: number; upper: number } | null>;
  for (const p of PRIORITIES) {
    const ahead = state.ready.filter((r) => rank(r.priority) <= rank(p)).length;
    const pendingAhead = [...state.intakePending, ...state.onHold].filter((r) => rank(r.priority) <= rank(p)).length;
    const raw = rawRange(simulateWaits({ position: ahead + 1, priority: p, params: model.params, booked, pendingAhead, scenario, seed: `new-${p}:${model.asOf}:${scenario.extraSlots}@${scenario.fromWeek}` }));
    out[p] = calibrated(raw, model.backtest.calibration);
  }
  return out;
}
