// Simulated wait-time estimator for the prototype.
//
// This is a stand-in for backend/estimator. It does not learn from real data.
// It asks: "if the clinic keeps offering about N first-assessment slots a week,
// when does this referral's turn come?" and repeats that many times with random
// week-to-week variation (cancellations, staff leave, urgent referrals placed
// ahead). The 10th–90th percentile of those runs becomes the range a family sees.

import type { FamilyReferralResponse, UnavailableReason } from "../api/types";

export const SIM = {
  runs: 400,
  horizonWeeks: 52,
  /** chance a planned slot actually goes to the waitlist in a given week */
  slotKeptMin: 0.6,
  slotKeptMax: 1,
  /** average urgent referrals per week that are booked ahead of the line */
  urgentPerWeek: 0.25,
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

export interface CapacitySchedule {
  week: (week: number) => {
    reserved: number;
    shared: { slots: number; eligible: boolean[] }[];
  };
}

/** Simulate weeks until the referral at the given queue position is assessed. */
export function simulateRange(position: number, slotsPerWeek: number, seedKey: string, schedule?: CapacitySchedule) {
  const rand = mulberry32(hash(seedKey));
  const sharedRand = mulberry32(hash(seedKey + ":shared"));
  const extendedRand = mulberry32(hash(seedKey + ":extended"));
  const waits: number[] = [];
  const weeks = schedule && Array.from({ length: SIM.horizonWeeks }, (_, i) => schedule.week(i + 1));

  for (let run = 0; run < SIM.runs; run++) {
    const kept = SIM.slotKeptMin + rand() * (SIM.slotKeptMax - SIM.slotKeptMin);
    const served = new Uint8Array(position);
    let firstWaiting = 0;
    let assessmentWeek = Infinity;
    let baselineServed = 0;
    let bookingLead: number | undefined;

    for (let week = 1; week <= SIM.horizonWeeks; week++) {
      const plan = weeks?.[week - 1];
      const localLimit = slotsPerWeek - (plan?.reserved ?? 0);
      // Follow the baseline random stream until its assessment occurs. This
      // keeps scenario comparisons tied to the same local capacity draws.
      const draw = bookingLead === undefined ? rand : extendedRand;
      let baseSlots = 0;
      let localSlots = 0;
      for (let s = 0; s < slotsPerWeek; s++) {
        if (draw() < kept) {
          baseSlots++;
          if (s < localLimit) localSlots++;
        }
      }
      const urgent = poisson(draw, SIM.urgentPerWeek);
      baselineServed += Math.max(0, baseSlots - urgent);
      localSlots = Math.max(0, localSlots - urgent);

      if (!Number.isFinite(assessmentWeek)) {
        // Use shared slots for the oldest travel-eligible referrals first.
        // Local slots stay available to families who cannot use the shared site.
        for (const group of plan?.shared ?? []) {
          let next = firstWaiting;
          for (let s = 0; s < group.slots; s++) {
            if (sharedRand() >= kept) continue;
            while (next < position && (served[next] || !group.eligible[next])) next++;
            if (next === position) break;
            served[next++] = 1;
          }
        }
        while (firstWaiting < position && localSlots > 0) {
          if (!served[firstWaiting]) {
            served[firstWaiting] = 1;
            localSlots--;
          }
          firstWaiting++;
        }
        if (served[position - 1]) assessmentWeek = week;
      }

      if (bookingLead === undefined && baselineServed >= position) {
        bookingLead = Math.floor(rand() * (SIM.bookingLeadMaxWeeks + 1));
      }
      if (bookingLead !== undefined && Number.isFinite(assessmentWeek)) break;
    }

    if (Number.isFinite(assessmentWeek) && bookingLead === undefined) {
      bookingLead = Math.floor(extendedRand() * (SIM.bookingLeadMaxWeeks + 1));
    }
    waits.push(assessmentWeek + (bookingLead ?? 0));
  }
  waits.sort((a, b) => a - b);
  const lower = Math.max(1, Math.floor(quantile(waits, 0.1)));
  const upperRaw = quantile(waits, 0.9);
  if (!Number.isFinite(upperRaw) || upperRaw > SIM.horizonWeeks) return null;
  return { lower, upper: Math.max(lower + 1, Math.ceil(upperRaw)) };
}

export function availableEstimate(
  asOf: string,
  range: { lower: number; upper: number },
): FamilyReferralResponse["estimate"] {
  return { status: "available", milestone: "first_assessment", as_of: asOf, range_weeks: range, message: MESSAGES.available };
}

export function unavailableEstimate(asOf: string, reason: UnavailableReason): FamilyReferralResponse["estimate"] {
  return { status: "unavailable", milestone: "first_assessment", as_of: asOf, range_weeks: null, message: MESSAGES[reason], reason };
}
