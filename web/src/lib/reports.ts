// Numbers for the staff Reports page and its CSV downloads.
//
// It joins two synthetic files: clinic-history.json (referrals that already
// had a first assessment or were withdrawn) and clinic-queue.json (referrals
// still on the waitlist on the snapshot date). When backend/api exists, the
// same summaries can come from the clinic's referral records.
//
// Definitions used everywhere on the page:
// - Wait to first assessment: referral received -> first assessment, in
//   calendar weeks, holds included (docs/wait-time.md).
// - On the waitlist on a day: received on or before that day and not yet
//   assessed or withdrawn. A booked referral stays on the list until its
//   appointment.
// - Estimate held: the actual wait from the estimate date fell inside the
//   range the estimator would have shown when intake was complete.

import historyJson from "../../../data/demo/clinic-history.json";
import queueJson from "../../../data/demo/clinic-queue.json";
import type { ClinicHistory, ClinicQueue, Hold } from "./types";
import { daysBetween, parseDay } from "./dates";

const history = historyJson as unknown as ClinicHistory;
const queue = queueJson as unknown as ClinicQueue;

export const REPORT_AS_OF = queue.as_of;
/** First day the history is complete enough to report on. */
export const REPORT_START = "2025-04-01";

const DAY = 86_400_000;
const toStr = (d: Date) => d.toISOString().slice(0, 10);
export const addDays = (s: string, n: number) => toStr(new Date(parseDay(s).getTime() + n * DAY));
const weeks = (from: string, to: string) => daysBetween(from, to) / 7;

export type Outcome = "assessed" | "withdrawn";
export type EstimateResult = "inside" | "earlier" | "later";

/** A referral from either file, in one shape. */
export interface Case {
  id: string;
  received_on: string;
  intake_completed_on: string | null;
  age_group: string;
  referral_source: string;
  /** null while the referral is still on the waitlist */
  outcome: Outcome | null;
  closed_on: string | null;
  appointment_on: string | null;
  withdrawn_reason: string | null;
  hold: Hold | null;
  estimate: { as_of: string; lower: number; upper: number } | null;
}

export const CASES: Case[] = [
  ...history.referrals.map((r) => ({
    id: r.id,
    received_on: r.received_on,
    intake_completed_on: r.intake_completed_on,
    age_group: r.age_group,
    referral_source: r.referral_source,
    outcome: r.outcome,
    closed_on: r.closed_on,
    appointment_on: null,
    withdrawn_reason: r.withdrawn_reason ?? null,
    hold: r.hold,
    estimate: r.estimate_at_intake
      ? { as_of: r.estimate_at_intake.as_of, lower: r.estimate_at_intake.lower_weeks, upper: r.estimate_at_intake.upper_weeks }
      : null,
  })),
  ...queue.referrals.map((r) => ({
    id: r.id,
    received_on: r.received_on,
    intake_completed_on: null,
    age_group: r.age_group,
    referral_source: r.referral_source,
    outcome: null,
    closed_on: null,
    appointment_on: r.appointment_on ?? null,
    withdrawn_reason: null,
    hold: r.hold,
    estimate: null,
  })),
];

export function isOpenOn(c: Case, day: string) {
  return c.received_on <= day && (c.closed_on === null || c.closed_on > day);
}

export function isOnHoldOn(c: Case, day: string) {
  return !!c.hold && isOpenOn(c, day) && c.hold.start <= day && (c.hold.end === null || c.hold.end > day);
}

export function waitWeeks(c: Case) {
  return c.outcome === "assessed" && c.closed_on ? weeks(c.received_on, c.closed_on) : null;
}

export function estimateResult(c: Case): { actual: number; result: EstimateResult } | null {
  if (c.outcome !== "assessed" || !c.closed_on || !c.estimate) return null;
  const actual = weeks(c.estimate.as_of, c.closed_on);
  const result = actual < c.estimate.lower ? "earlier" : actual > c.estimate.upper ? "later" : "inside";
  return { actual, result };
}

export function quantile(values: number[], q: number) {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const i = (s.length - 1) * q;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  return s[lo] + (s[hi] - s[lo]) * (i - lo);
}

// ---------------------------------------------------------------- quarters

export interface Quarter {
  key: string; // e.g. 2026-Q3
  label: string; // e.g. Jul–Sep 2026
  short: string; // e.g. Jul–Sep
  start: string; // first day
  end: string; // first day of the next quarter
  /** last day counted: the day before `end`, or the snapshot date */
  last: string;
  partial: boolean;
}

const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function quarterOf(year: number, q: number): Quarter {
  const m = (q - 1) * 3;
  const start = `${year}-${String(m + 1).padStart(2, "0")}-01`;
  const end = q === 4 ? `${year + 1}-01-01` : `${year}-${String(m + 4).padStart(2, "0")}-01`;
  const partial = end > addDays(REPORT_AS_OF, 1);
  const short = `${MONTH[m]}–${MONTH[m + 2]}`;
  return {
    key: `${year}-Q${q}`,
    label: `${short} ${year}`,
    short,
    start,
    end,
    last: partial ? REPORT_AS_OF : addDays(end, -1),
    partial,
  };
}

export const QUARTERS: Quarter[] = (() => {
  const out: Quarter[] = [];
  let y = Number(REPORT_START.slice(0, 4));
  let q = Math.floor(Number(REPORT_START.slice(5, 7)) / 3) + 1;
  for (;;) {
    const qq = quarterOf(y, q);
    if (qq.start > REPORT_AS_OF) break;
    out.push(qq);
    q = q === 4 ? 1 : q + 1;
    if (q === 1) y++;
  }
  return out;
})();

/** The most recent quarter that has fully ended. */
export const DEFAULT_QUARTER = [...QUARTERS].reverse().find((q) => !q.partial) ?? QUARTERS[QUARTERS.length - 1];

const inRange = (day: string | null, from: string, last: string) => !!day && day >= from && day <= last;

export interface QuarterSummary {
  quarter: Quarter;
  referrals: number;
  assessed: number;
  withdrawn: number;
  waitlistEnd: number;
  onHoldEnd: number;
  medianWait: number | null;
  p90Wait: number | null;
  estimatesChecked: number;
  estimatesInside: number;
  estimatesEarlier: number;
  estimatesLater: number;
}

export function summarize(q: Quarter): QuarterSummary {
  const received = CASES.filter((c) => inRange(c.received_on, q.start, q.last));
  const closed = CASES.filter((c) => inRange(c.closed_on, q.start, q.last));
  const assessed = closed.filter((c) => c.outcome === "assessed");
  const waits = assessed.map((c) => waitWeeks(c)!);
  const checks = assessed.map(estimateResult).filter((x) => x !== null);
  return {
    quarter: q,
    referrals: received.length,
    assessed: assessed.length,
    withdrawn: closed.length - assessed.length,
    waitlistEnd: CASES.filter((c) => isOpenOn(c, q.last)).length,
    onHoldEnd: CASES.filter((c) => isOnHoldOn(c, q.last)).length,
    medianWait: quantile(waits, 0.5),
    p90Wait: quantile(waits, 0.9),
    estimatesChecked: checks.length,
    estimatesInside: checks.filter((x) => x.result === "inside").length,
    estimatesEarlier: checks.filter((x) => x.result === "earlier").length,
    estimatesLater: checks.filter((x) => x.result === "later").length,
  };
}

export function previousQuarter(q: Quarter) {
  const i = QUARTERS.findIndex((x) => x.key === q.key);
  return i > 0 ? QUARTERS[i - 1] : null;
}

// ---------------------------------------------------------------- series

export interface WeekPoint {
  date: string;
  waiting: number;
  onHold: number;
}

/** Waitlist size every Monday from the first reporting week to the snapshot. */
export function weeklyWaitlist(): WeekPoint[] {
  const out: WeekPoint[] = [];
  let d = REPORT_START;
  while (parseDay(d).getUTCDay() !== 1) d = addDays(d, -1);
  for (; d <= REPORT_AS_OF; d = addDays(d, 7)) {
    const open = CASES.filter((c) => isOpenOn(c, d));
    const held = open.filter((c) => isOnHoldOn(c, d)).length;
    out.push({ date: d, waiting: open.length - held, onHold: held });
  }
  const last = out[out.length - 1];
  if (last.date !== REPORT_AS_OF) {
    const open = CASES.filter((c) => isOpenOn(c, REPORT_AS_OF));
    const held = open.filter((c) => isOnHoldOn(c, REPORT_AS_OF)).length;
    out.push({ date: REPORT_AS_OF, waiting: open.length - held, onHold: held });
  }
  return out;
}

export interface MonthPoint {
  /** first of the month */
  month: string;
  /** mid-month, where the point is drawn */
  date: string;
  referrals: number;
  assessed: number;
  medianWait: number | null;
  p90Wait: number | null;
}

/** Complete months only, so a half-finished month never looks like a drop. */
export function monthlyFlow(): MonthPoint[] {
  const out: MonthPoint[] = [];
  let m = REPORT_START.slice(0, 8) + "01";
  for (;;) {
    const [y, mo] = m.split("-").map(Number);
    const next = mo === 12 ? `${y + 1}-01-01` : `${y}-${String(mo + 1).padStart(2, "0")}-01`;
    if (next > addDays(REPORT_AS_OF, 1)) break;
    const last = addDays(next, -1);
    const assessed = CASES.filter((c) => c.outcome === "assessed" && inRange(c.closed_on, m, last));
    const waits = assessed.map((c) => waitWeeks(c)!);
    out.push({
      month: m,
      date: addDays(m, 14),
      referrals: CASES.filter((c) => inRange(c.received_on, m, last)).length,
      assessed: assessed.length,
      medianWait: quantile(waits, 0.5),
      p90Wait: quantile(waits, 0.9),
    });
    m = next;
  }
  return out;
}

export interface EstimatePoint {
  id: string;
  lower: number;
  upper: number;
  actual: number;
  result: EstimateResult;
  closed_on: string;
}

/** Every first assessment in the quarter with its back-tested range, shortest wait first. */
export function estimatePoints(q: Quarter): EstimatePoint[] {
  return CASES.filter((c) => c.outcome === "assessed" && inRange(c.closed_on, q.start, q.last))
    .flatMap((c) => {
      const r = estimateResult(c);
      return r && c.estimate ? [{ id: c.id, lower: c.estimate.lower, upper: c.estimate.upper, ...r, closed_on: c.closed_on! }] : [];
    })
    .sort((a, b) => a.actual - b.actual || a.id.localeCompare(b.id));
}

export interface BreakdownRow {
  group: string;
  referrals: number;
  assessed: number;
  medianWait: number | null;
}

export function breakdown(q: Quarter, key: "referral_source" | "age_group"): BreakdownRow[] {
  const groups = [...new Set(CASES.map((c) => c[key]))].sort();
  return groups
    .map((group) => {
      const mine = CASES.filter((c) => c[key] === group);
      const assessed = mine.filter((c) => c.outcome === "assessed" && inRange(c.closed_on, q.start, q.last));
      return {
        group,
        referrals: mine.filter((c) => inRange(c.received_on, q.start, q.last)).length,
        assessed: assessed.length,
        medianWait: quantile(assessed.map((c) => waitWeeks(c)!), 0.5),
      };
    })
    .filter((r) => r.referrals + r.assessed > 0);
}

// ---------------------------------------------------------------- exports

const round1 = (n: number | null) => (n === null ? null : Math.round(n * 10) / 10);
const pct = (a: number, b: number) => (b === 0 ? null : Math.round((100 * a) / b));

/** One row per quarter, for a manager's own spreadsheet or slides. */
export function summaryTable() {
  const header = [
    "quarter",
    "first_day",
    "last_day",
    "complete_quarter",
    "referrals_received",
    "first_assessments",
    "withdrawn",
    "waitlist_at_end",
    "on_hold_at_end",
    "median_wait_weeks",
    "p90_wait_weeks",
    "estimates_checked",
    "estimates_inside_range",
    "estimates_inside_range_pct",
    "assessed_earlier_than_range",
    "assessed_later_than_range",
  ];
  const rows = QUARTERS.map((q) => {
    const s = summarize(q);
    return [
      q.label,
      q.start,
      q.last,
      q.partial ? "no" : "yes",
      s.referrals,
      s.assessed,
      s.withdrawn,
      s.waitlistEnd,
      s.onHoldEnd,
      round1(s.medianWait),
      round1(s.p90Wait),
      s.estimatesChecked,
      s.estimatesInside,
      pct(s.estimatesInside, s.estimatesChecked),
      s.estimatesEarlier,
      s.estimatesLater,
    ];
  });
  return { header, rows };
}

/** De-identified referral rows for every referral on the waitlist at any point in the quarter. */
export function quarterTable(q: Quarter) {
  const header = [
    "referral_id",
    "received_on",
    "intake_completed_on",
    "age_group",
    "referral_source",
    "status_at_quarter_end",
    "outcome",
    "closed_on",
    "wait_to_first_assessment_weeks",
    "hold_start",
    "hold_end",
    "hold_reason",
    "withdrawn_reason",
    "estimate_on",
    "estimate_lower_weeks",
    "estimate_upper_weeks",
    "estimate_result",
  ];
  const rows = CASES.filter((c) => c.received_on <= q.last && (c.closed_on === null || c.closed_on >= q.start))
    .sort((a, b) => a.received_on.localeCompare(b.received_on) || a.id.localeCompare(b.id))
    .map((c) => {
      const closedInQuarter = c.closed_on !== null && c.closed_on <= q.last;
      const status = closedInQuarter
        ? c.outcome === "assessed"
          ? "first assessment done"
          : "withdrawn"
        : isOnHoldOn(c, q.last)
          ? "on hold"
          : // booking dates aren't recorded, so "booked" is only known for the snapshot
            c.appointment_on && q.partial
            ? "assessment booked"
            : "waiting";
      const est = closedInQuarter ? estimateResult(c) : null;
      return [
        c.id,
        c.received_on,
        c.intake_completed_on,
        c.age_group,
        c.referral_source,
        status,
        closedInQuarter ? c.outcome : null,
        closedInQuarter ? c.closed_on : null,
        closedInQuarter ? round1(waitWeeks(c)) : null,
        c.hold && c.hold.start <= q.last ? c.hold.start : null,
        c.hold && c.hold.start <= q.last && c.hold.end && c.hold.end <= q.last ? c.hold.end : null,
        c.hold && c.hold.start <= q.last ? c.hold.reason : null,
        closedInQuarter ? c.withdrawn_reason : null,
        est ? c.estimate!.as_of : null,
        est ? c.estimate!.lower : null,
        est ? c.estimate!.upper : null,
        est ? est.result : null,
      ];
    });
  return { header, rows };
}
