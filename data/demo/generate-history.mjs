// Generates data/demo/clinic-history.json: synthetic referrals that already
// left the waitlist (first assessment done, or withdrawn) before the queue
// snapshot in clinic-queue.json. The staff Reports page combines the two files.
//
// Run from the repo root:  node data/demo/generate-history.mjs
// The seed is fixed, so the output is the same every time.
//
// The story the numbers tell: referrals slowly rise (with a summer dip and a
// September jump), assessments stay at about two a week, so the wait to a
// first assessment grows from about 10 weeks to about 19 weeks. That matches
// the current queue, whose oldest referral (June 30, 2026) is booked for
// November 10, 2026.

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const AS_OF = "2026-11-05";
const FIRST_RECEIVED = "2024-09-02";
const LAST_RECEIVED = "2026-06-29"; // the queue snapshot starts on 2026-06-30
const LAST_CLOSED = "2026-11-04";

const DAY = 86_400_000;
const toDate = (s) => new Date(`${s}T00:00:00Z`);
const toStr = (d) => d.toISOString().slice(0, 10);
const addDays = (s, n) => toStr(new Date(toDate(s).getTime() + n * DAY));
const weeksBetween = (a, b) => (toDate(b) - toDate(a)) / (7 * DAY);
const isWeekday = (s) => {
  const d = toDate(s).getUTCDay();
  return d !== 0 && d !== 6;
};
const nextWeekday = (s) => {
  let d = s;
  while (!isWeekday(d)) d = addDays(d, 1);
  return d;
};

function mulberry32(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const SEED = Number(process.env.SEED ?? 10);
const rand = mulberry32(SEED);
const normal = () => {
  const u = 1 - rand();
  const v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};
const pick = (weighted) => {
  const total = weighted.reduce((s, [, w]) => s + w, 0);
  let r = rand() * total;
  for (const [value, w] of weighted) if ((r -= w) < 0) return value;
  return weighted[weighted.length - 1][0];
};
const intBetween = (lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));

const AGE_GROUPS = [
  ["18–24 months", 2],
  ["2–3 years", 4],
  ["3–4 years", 3],
  ["4–5 years", 2],
];
const SOURCES = [
  ["Pediatrician", 3],
  ["Family doctor", 2],
  ["Child care centre", 3],
  ["EarlyON centre", 1.5],
  ["Self-referral", 2.5],
];
const HOLD_REASONS = ["Family requested a pause", "Family travelling", "Awaiting hearing test results", "Child unwell"];
const WITHDRAW_REASONS = ["Family moved away", "Started private therapy", "Family declined service", "No response to contact attempts"];

// Referrals per week, before the seasonal factor.
const span = weeksBetween(FIRST_RECEIVED, LAST_RECEIVED);
const baseRate = (s) => 1.7 + 0.6 * (weeksBetween(FIRST_RECEIVED, s) / span);
const SEASON = { 1: 1.05, 7: 0.75, 8: 0.8, 9: 1.3, 10: 1.1, 12: 0.7 };
const season = (s) => SEASON[toDate(s).getUTCMonth() + 1] ?? 1;

// Usual wait from referral to first assessment, in weeks, for a referral
// received on date s. Grows faster in the second year.
const usualWait = (s) => {
  const f = weeksBetween(FIRST_RECEIVED, s) / span;
  return 10 + 8.8 * f * f;
};

const referrals = [];
for (let d = FIRST_RECEIVED; d <= LAST_RECEIVED; d = addDays(d, 1)) {
  if (!isWeekday(d)) continue;
  if (rand() < (baseRate(d) * season(d)) / 5) referrals.push({ received_on: d });
}

let n = 0;
for (const r of referrals) {
  r.id = `h-${String(++n).padStart(4, "0")}`;
  r.age_group = pick(AGE_GROUPS);
  r.referral_source = pick(SOURCES);

  const intakeDays = rand() < 0.7 ? intBetween(0, 7) : intBetween(8, 28);
  r.intake_completed_on = nextWeekday(addDays(r.received_on, intakeDays));

  const wait = Math.max(5, usualWait(r.received_on) + normal() * 1.3);

  if (rand() < 0.06) {
    const at = Math.min(weeksBetween(r.received_on, LAST_CLOSED), 3 + rand() * (wait - 3));
    r.outcome = "withdrawn";
    r.closed_on = nextWeekday(addDays(r.received_on, Math.round(at * 7)));
    if (r.closed_on > LAST_CLOSED) r.closed_on = LAST_CLOSED;
    r.withdrawn_reason = pick(WITHDRAW_REASONS.map((x) => [x, 1]));
    r.hold = null;
    r.estimate_at_intake = null;
    continue;
  }

  let holdWeeks = 0;
  r.hold = null;
  if (rand() < 0.1) {
    holdWeeks = intBetween(2, 7);
    const start = nextWeekday(addDays(r.received_on, Math.round((3 + rand() * Math.max(1, wait - 5)) * 7)));
    r.hold = { start, end: addDays(start, holdWeeks * 7), reason: pick(HOLD_REASONS.map((x) => [x, 1])) };
  }

  let closed = nextWeekday(addDays(r.received_on, Math.round((wait + holdWeeks) * 7)));
  if (closed > LAST_CLOSED) closed = LAST_CLOSED;
  r.outcome = "assessed";
  r.closed_on = closed;

  // What the estimator would have shown once intake was complete. It cannot
  // know about a hold that hasn't happened yet, so it aims at the wait without
  // the hold; those referrals tend to come in later than the range.
  const remaining = Math.max(1, weeksBetween(r.intake_completed_on, closed) - holdWeeks);
  const centre = remaining * Math.exp(normal() * 0.17);
  const lower = Math.max(1, Math.floor(centre * 0.82));
  const upper = Math.max(lower + 1, Math.ceil(centre * 1.2));
  r.estimate_at_intake = { as_of: r.intake_completed_on, lower_weeks: lower, upper_weeks: upper };
}

const ordered = referrals.map((r) => ({
  id: r.id,
  received_on: r.received_on,
  intake_completed_on: r.intake_completed_on,
  age_group: r.age_group,
  referral_source: r.referral_source,
  outcome: r.outcome,
  closed_on: r.closed_on,
  ...(r.withdrawn_reason ? { withdrawn_reason: r.withdrawn_reason } : {}),
  hold: r.hold,
  estimate_at_intake: r.estimate_at_intake,
}));

const out = {
  _note:
    "Synthetic history for the Team 12 course prototype, generated by generate-history.mjs. No real children, families, or clinic records. estimate_at_intake is a back-test: the range the estimator would have shown when intake was complete.",
  as_of: AS_OF,
  referrals: ordered,
};

const path = fileURLToPath(new URL("./clinic-history.json", import.meta.url));
writeFileSync(path, JSON.stringify(out, null, 2) + "\n");

const assessed = ordered.filter((r) => r.outcome === "assessed");
const inside = assessed.filter((r) => {
  const w = weeksBetween(r.estimate_at_intake.as_of, r.closed_on);
  return w >= r.estimate_at_intake.lower_weeks && w <= r.estimate_at_intake.upper_weeks;
});
console.log(`${ordered.length} referrals, ${assessed.length} assessed, ${ordered.length - assessed.length} withdrawn`);
console.log(`estimate inside range: ${((100 * inside.length) / assessed.length).toFixed(0)}%`);
for (const [from, to] of [["2026-01-01", "2026-03-31"], ["2026-04-01", "2026-06-30"], ["2026-07-01", "2026-09-30"]]) {
  const q = assessed.filter((r) => r.closed_on >= from && r.closed_on <= to);
  const ok = q.filter((r) => inside.includes(r));
  console.log(`  ${from.slice(0, 7)}: ${ok.length}/${q.length} inside`);
}
