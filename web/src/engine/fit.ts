// Learn how this clinic's waitlist actually moves, from its own records.
//
// Nothing here is hand-set per clinic. Every number comes from what the clinic
// did in the weeks before `asOf`, and only from what was known on `asOf`, so the
// back-test can call the same function for any past day.

import type { Priority, ReferralRecord } from "./types";
import { addDays, daysBetween, median } from "./util";

export interface FittedParams {
  asOf: string;
  /** weeks of history the numbers below come from */
  windowWeeks: number;
  /** first assessments done in each week of the window, oldest first */
  weeklyThroughput: number[];
  meanThroughput: number;
  /** new ready referrals a week that join the line ahead of a referral of this priority */
  aheadRate: Record<Priority, number>;
  /** chance a week that any one referral in the line withdraws */
  withdrawWeekly: number;
  /** chance a week that a referral still in intake, or on hold, becomes ready (and joins the line in its place) */
  joinWeekly: number;
  /** first assessments seen in the window */
  assessed: number;
  /** referrals that became ready in the window */
  arrivals: number;
  withdrawals: number;
  /** median days from referral received to intake complete, over the window */
  intakeMedianDays: number | null;
}

/** Fewer first assessments than this in 26 weeks and the window widens to a year. */
const MIN_ASSESSED = 12;

export function fitParams(records: ReferralRecord[], asOf: string, preferredWeeks = 26): FittedParams {
  let p = fitWindow(records, asOf, preferredWeeks);
  if (p.assessed < MIN_ASSESSED && preferredWeeks < 52) p = fitWindow(records, asOf, 52);
  return p;
}

function fitWindow(records: ReferralRecord[], asOf: string, weeks: number): FittedParams {
  const start = addDays(asOf, -7 * weeks);
  const inWindow = (d: string | null): d is string => d !== null && d > start && d <= asOf;

  const weeklyThroughput = new Array<number>(weeks).fill(0);
  let assessed = 0;
  let withdrawals = 0;
  const arrivalsBy: Record<Priority, number> = { urgent: 0, high: 0, standard: 0 };
  let personDays = 0;
  let waitingDays = 0;
  let joins = 0;
  const intakeDays: number[] = [];
  const overlap = (from: string, to: string) => {
    const a = from > start ? from : start;
    const b = to < asOf ? to : asOf;
    return b > a ? daysBetween(a, b) : 0;
  };

  for (const r of records) {
    if (r.received_on > asOf) continue;
    if (r.close_reason === "assessed" && inWindow(r.closed_on)) {
      const w = weeks - 1 - Math.floor((daysBetween(r.closed_on, asOf) - 0) / 7);
      if (w >= 0 && w < weeks) weeklyThroughput[w]++;
      assessed++;
    }
    if (inWindow(r.intake_completed_on)) {
      arrivalsBy[r.priority]++;
      intakeDays.push(daysBetween(r.received_on, r.intake_completed_on));
    }
    // Time spent in intake or on hold, and how often that ends, for the join rate.
    const leftAt = r.closed_on && r.closed_on <= asOf ? r.closed_on : asOf;
    const intakeEnd = r.intake_completed_on && r.intake_completed_on <= asOf ? r.intake_completed_on : leftAt;
    waitingDays += overlap(r.received_on, intakeEnd < leftAt ? intakeEnd : leftAt);
    if (inWindow(r.intake_completed_on)) joins++;
    if (r.hold_start && r.hold_start <= asOf) {
      const holdEnd = r.hold_end && r.hold_end <= asOf ? r.hold_end : leftAt;
      waitingDays += overlap(r.hold_start, holdEnd < leftAt ? holdEnd : leftAt);
      if (inWindow(r.hold_end)) joins++;
    }
    // Time spent ready in the line inside the window, for the withdrawal rate.
    if (r.intake_completed_on && r.intake_completed_on <= asOf) {
      const from = r.intake_completed_on > start ? r.intake_completed_on : start;
      const leftOn = r.closed_on && r.closed_on <= asOf ? r.closed_on : asOf;
      if (leftOn > from) personDays += daysBetween(from, leftOn);
      if (r.close_reason === "withdrawn" && inWindow(r.closed_on)) withdrawals++;
    }
  }

  const arrivals = arrivalsBy.urgent + arrivalsBy.high + arrivalsBy.standard;
  return {
    asOf,
    windowWeeks: weeks,
    weeklyThroughput,
    meanThroughput: assessed / weeks,
    aheadRate: {
      urgent: 0,
      high: arrivalsBy.urgent / weeks,
      standard: (arrivalsBy.urgent + arrivalsBy.high) / weeks,
    },
    withdrawWeekly: personDays > 0 ? Math.min(0.2, withdrawals / (personDays / 7)) : 0,
    joinWeekly: waitingDays > 0 ? Math.min(1, joins / (waitingDays / 7)) : 0.25,
    assessed,
    arrivals,
    withdrawals,
    intakeMedianDays: intakeDays.length ? Math.round(median(intakeDays)) : null,
  };
}
