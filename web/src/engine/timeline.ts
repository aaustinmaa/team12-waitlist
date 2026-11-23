// Rebuild the waitlist as it stood on any day from the referral records.
//
// The estimator needs this for today, and the back-test needs it for every past
// day it replays, so it only ever uses what was known on that day.

import { PRIORITIES, type Priority, type ReferralRecord } from "./types";
import { daysBetween } from "./util";

/**
 * For a past day we cannot see when a booking was made, only when the
 * assessment happened. Treat an assessment this close after the day as already
 * booked on that day (clinics usually book a few weeks ahead).
 */
export const BOOKING_LEAD_DAYS = 21;

const rank = (p: Priority) => PRIORITIES.indexOf(p);

export function isOpenOn(r: ReferralRecord, day: string) {
  return r.received_on <= day && (r.closed_on === null || r.closed_on > day);
}

export function isOnHoldOn(r: ReferralRecord, day: string) {
  return r.hold_start !== null && r.hold_start <= day && (r.hold_end === null || r.hold_end > day);
}

/** The appointment date a referral was booked for on `day`, or null if it was not booked yet. */
export function bookedDateOn(r: ReferralRecord, day: string): string | null {
  if (r.closed_on === null) return r.booked_for && r.booked_for >= day ? r.booked_for : null;
  if (r.close_reason !== "assessed" || r.closed_on <= day) return null;
  // Closed later: the export has the live booking only while the referral is open.
  return daysBetween(day, r.closed_on) <= BOOKING_LEAD_DAYS ? r.closed_on : null;
}

export interface LineState {
  day: string;
  /** ready to be offered a first assessment, in the order the clinic sees them */
  ready: ReferralRecord[];
  /** first assessment booked for a later day */
  booked: { record: ReferralRecord; on: string }[];
  onHold: ReferralRecord[];
  intakePending: ReferralRecord[];
}

export function lineOn(records: ReferralRecord[], day: string, priorityOf: (r: ReferralRecord) => Priority = (r) => r.priority): LineState {
  const state: LineState = { day, ready: [], booked: [], onHold: [], intakePending: [] };
  for (const r of records) {
    if (!isOpenOn(r, day)) continue;
    const booked = bookedDateOn(r, day);
    if (booked) state.booked.push({ record: r, on: booked });
    else if (isOnHoldOn(r, day)) state.onHold.push(r);
    else if (r.intake_completed_on === null || r.intake_completed_on > day) state.intakePending.push(r);
    else state.ready.push(r);
  }
  state.ready.sort(
    (a, b) =>
      rank(priorityOf(a)) - rank(priorityOf(b)) ||
      a.received_on.localeCompare(b.received_on) ||
      a.referral_id.localeCompare(b.referral_id),
  );
  return state;
}

/** Booked first assessments per week after `day` (index 0 = the next 7 days). */
export function bookedByWeek(state: LineState, weeks: number) {
  const out = new Array<number>(weeks).fill(0);
  for (const b of state.booked) {
    const w = Math.floor(daysBetween(state.day, b.on) / 7);
    if (w >= 0 && w < weeks) out[w]++;
  }
  return out;
}

/**
 * Referrals still in intake or on hold that will rejoin the line ahead of `r`
 * when they become ready: higher priority, or same priority and received earlier.
 */
export function pendingAheadOf(state: LineState, r: ReferralRecord, priorityOf: (x: ReferralRecord) => Priority = (x) => x.priority) {
  const mine = rank(priorityOf(r));
  let n = 0;
  for (const x of [...state.intakePending, ...state.onHold]) {
    const theirs = rank(priorityOf(x));
    if (theirs < mine || (theirs === mine && x.received_on < r.received_on)) n++;
  }
  return n;
}
