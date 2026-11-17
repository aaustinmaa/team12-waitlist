// Simulated wait-time estimator for the prototype.
//
// This is a stand-in for backend/estimator. It does not learn from real data.
// It asks: "if the clinic keeps offering about N first-assessment slots a week,
// when does this referral's turn come?" and repeats that many times with random
// week-to-week variation (cancellations, staff leave, higher-priority referrals
// placed ahead). The 10th–90th percentile of those runs becomes the range a
// family sees.
//
// Priority: the line is ordered by clinical priority first and referral date
// second (see api.ts), so a referral's `position` already counts everyone the
// clinic would see before it today. What the position can't know is who will
// be referred later and placed ahead. `jumpsPerWeek` covers that: a standard
// referral can be passed by new urgent and high-priority referrals, a
// high-priority one only by new urgent referrals, and an urgent one by nobody.

import type { Estimate, Priority, UnavailableReason } from "./types";

export const SIM = {
  runs: 400,
  horizonWeeks: 52,
  /** chance a planned slot actually goes to the waitlist in a given week */
  slotKeptMin: 0.6,
  slotKeptMax: 1,
  /**
   * average new referrals per week that are placed ahead of a waiting referral
   * of each priority (about 0.1 urgent and 0.15 high-priority referrals a week)
   */
  jumpsPerWeek: { urgent: 0, high: 0.1, standard: 0.25 } satisfies Record<Priority, number>,
  /** weeks between being offered a slot and the appointment itself (0 to this, uniform) */
  bookingLeadMaxWeeks: 2,
};

export const MESSAGES: Record<"available" | UnavailableReason, string> = {
  available:
    "This estimate may change as appointments become available. The clinic will confirm your appointment separately.",
  intake_incomplete:
    "Your referral is still on the waitlist. We don't have enough information to estimate your wait yet.",
  on_hold:
    "Your referral is on hold, so we can't estimate your wait right now. It is still on the waitlist.",
  booked: "Your first assessment is booked. The clinic has confirmed the date shown here.",
  beyond_horizon:
    "Your referral is still on the waitlist. The wait is currently too long for us to estimate reliably.",
};

/** Small seeded PRNG so the same inputs always give the same range. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function poisson(rand: () => number, mean: number) {
  const limit = Math.exp(-mean);
  let k = 0;
  let p = rand();
  while (p > limit) {
    k++;
    p *= rand();
  }
  return k;
}

function quantile(sorted: number[], q: number) {
  const i = (sorted.length - 1) * q;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
}

/**
 * Simulate weeks until the referral at `position` (1 = next in line) gets its
 * first assessment. Returns the 10th–90th percentile range, or null when the
 * upper bound runs past the horizon.
 */
export function simulateRange(position: number, slotsPerWeek: number, seedKey: string, priority: Priority = "standard") {
  const jumps = SIM.jumpsPerWeek[priority];
  const rand = mulberry32(hash(seedKey));
  const waits: number[] = [];
  for (let run = 0; run < SIM.runs; run++) {
    // How reliably slots are kept is itself uncertain, so draw it once per run.
    const kept = SIM.slotKeptMin + rand() * (SIM.slotKeptMax - SIM.slotKeptMin);
    let served = 0;
    let week = 0;
    while (served < position && week < SIM.horizonWeeks) {
      week++;
      let slots = 0;
      for (let s = 0; s < slotsPerWeek; s++) if (rand() < kept) slots++;
      slots = Math.max(0, slots - poisson(rand, jumps));
      served += slots;
    }
    waits.push(served >= position ? week + Math.floor(rand() * (SIM.bookingLeadMaxWeeks + 1)) : Infinity);
  }
  waits.sort((a, b) => a - b);
  const lower = Math.max(1, Math.floor(quantile(waits, 0.1)));
  const upperRaw = quantile(waits, 0.9);
  if (!Number.isFinite(upperRaw) || upperRaw > SIM.horizonWeeks) return null;
  return { lower, upper: Math.max(lower + 1, Math.ceil(upperRaw)) };
}

export function availableEstimate(asOf: string, range: { lower: number; upper: number }): Estimate {
  return { status: "available", milestone: "first_assessment", as_of: asOf, range_weeks: range, message: MESSAGES.available };
}

export function unavailableEstimate(asOf: string, reason: UnavailableReason): Estimate {
  return { status: "unavailable", milestone: "first_assessment", as_of: asOf, range_weeks: null, message: MESSAGES[reason], reason };
}
