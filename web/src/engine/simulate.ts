// Monte Carlo of one referral's remaining wait, driven by the fitted numbers.
//
// Each run replays the clinic's own recent weeks in a random order (in short
// blocks, so a run of slow weeks stays together) instead of assuming a fixed
// number of slots. Every week: the slots left after already-booked
// appointments go to the line in order, new higher-priority referrals may join
// ahead, and some referrals ahead withdraw. The 10th–90th percentile of the
// runs is the raw range.

import type { FittedParams } from "./fit";
import type { Priority } from "./types";
import { hash, mulberry32, poisson, quantile } from "./util";

export const HORIZON_WEEKS = 78;
const BLOCK = 4;

export interface Scenario {
  /** first assessments a week added (or removed, if negative) on top of the clinic's own history */
  extraSlots: number;
  /** from this week on (0 = this week) */
  fromWeek: number;
}

export const NO_SCENARIO: Scenario = { extraSlots: 0, fromWeek: 0 };

export interface SimInput {
  /** 1 = next in line */
  position: number;
  priority: Priority;
  params: FittedParams;
  /** booked first assessments per week ahead, index 0 = next 7 days */
  booked: number[];
  /**
   * referrals that would be ahead in line but are still in intake or on hold
   * (received earlier, or higher priority). Each week some become ready and join ahead.
   */
  pendingAhead?: number;
  scenario?: Scenario;
  runs?: number;
  seed: string;
}

/** Sorted simulated waits in weeks (1 = during the coming week); Infinity past the horizon. */
export function simulateWaits({ position, priority, params, booked, pendingAhead = 0, scenario = NO_SCENARIO, runs = 300, seed }: SimInput) {
  const rand = mulberry32(hash(seed));
  const hist = params.weeklyThroughput;
  const n = hist.length;
  const jump = params.aheadRate[priority];
  const leave = params.withdrawWeekly;
  const join = params.joinWeekly;
  const waits: number[] = [];
  if (n === 0 || params.assessed === 0) return new Array<number>(runs).fill(Infinity);

  for (let run = 0; run < runs; run++) {
    let ahead = position - 1;
    let pending = pendingAhead;
    let cursor = Math.floor(rand() * n);
    let wait = Infinity;
    for (let week = 1; week <= HORIZON_WEEKS; week++) {
      if ((week - 1) % BLOCK === 0) cursor = Math.floor(rand() * n);
      let slots = hist[cursor % n];
      cursor++;
      if (week - 1 >= scenario.fromWeek) slots += scenario.extraSlots;
      slots -= booked[week - 1] ?? 0;
      if (slots < 0) slots = 0;
      ahead += poisson(rand, jump);
      if (pending > 0) {
        let joined = 0;
        for (let i = 0; i < pending; i++) if (rand() < join) joined++;
        pending -= joined;
        ahead += joined;
      }
      if (ahead > 0 && leave > 0) ahead -= Math.min(ahead, poisson(rand, ahead * leave));
      if (slots > ahead) {
        wait = week;
        break;
      }
      ahead -= slots;
    }
    waits.push(wait);
  }
  return waits.sort((a, b) => a - b);
}

export interface RawRange {
  /** 10th and 90th percentile in weeks; upper may be Infinity */
  q10: number;
  q50: number;
  q90: number;
}

export function rawRange(waits: number[]): RawRange {
  return { q10: quantile(waits, 0.1), q50: quantile(waits, 0.5), q90: quantile(waits, 0.9) };
}

export interface Calibration {
  /** how much slower (>1) or faster (<1) than simulated the past waits really were, at the median */
  speed: number;
  /** widening of the range so enough past waits fall inside it */
  k: number;
}

/** Apply the back-test calibration to a raw range (speed = 1, k = 1 leaves it as it is). */
export function calibrated(r: RawRange, c: Calibration): { lower: number; upper: number } | null {
  if (!Number.isFinite(r.q90)) return null;
  const lower = Math.max(1, Math.floor((r.q10 * c.speed) / c.k));
  const upper = Math.max(lower + 1, Math.ceil(r.q90 * c.speed * c.k));
  return upper > HORIZON_WEEKS ? null : { lower, upper };
}
