// A second, independent view of the wait: Kaplan–Meier on the clinic's history.
//
// Time runs from intake complete to first assessment. Referrals still waiting
// are right-censored at the data date instead of being dropped, so the long
// waits of the people still in line are not lost (dropping them is what makes
// a plain average of finished waits too optimistic). Withdrawn referrals are
// censored when they leave, so the curve answers "how long if you stay on the
// list". The Model page compares it with the simulation for a referral that
// becomes ready today; a large gap is a warning that the line has recently
// changed speed.

import type { Priority, ReferralRecord } from "./types";
import { addDays, daysBetween } from "./util";

export interface SurvivalSummary {
  subjects: number;
  events: number;
  /** weeks by which 10 / 50 / 90 % had their first assessment, or null if not reached */
  p10: number | null;
  p50: number | null;
  p90: number | null;
}

export function kaplanMeier(records: ReferralRecord[], asOf: string, opts: { weeks?: number; priority?: Priority } = {}): SurvivalSummary {
  const start = addDays(asOf, -7 * (opts.weeks ?? 104));
  const obs: { t: number; event: boolean }[] = [];
  for (const r of records) {
    const d = r.intake_completed_on;
    if (!d || d < start || d > asOf) continue;
    if (opts.priority && r.priority !== opts.priority) continue;
    const closedBy = r.closed_on && r.closed_on <= asOf ? r.closed_on : null;
    const event = closedBy !== null && r.close_reason === "assessed";
    const end = closedBy ?? asOf;
    obs.push({ t: Math.max(0, daysBetween(d, end)) / 7, event });
  }
  obs.sort((a, b) => a.t - b.t);

  let atRisk = obs.length;
  let surv = 1;
  const cuts: Record<"p10" | "p50" | "p90", number | null> = { p10: null, p50: null, p90: null };
  const targets: [keyof typeof cuts, number][] = [
    ["p10", 0.9],
    ["p50", 0.5],
    ["p90", 0.1],
  ];
  let i = 0;
  while (i < obs.length) {
    const t = obs[i].t;
    let events = 0;
    let total = 0;
    while (i < obs.length && obs[i].t === t) {
      if (obs[i].event) events++;
      total++;
      i++;
    }
    if (events > 0 && atRisk > 0) {
      surv *= 1 - events / atRisk;
      for (const [key, level] of targets) if (cuts[key] === null && surv <= level) cuts[key] = Math.round(t * 10) / 10;
    }
    atRisk -= total;
  }
  return { subjects: obs.length, events: obs.filter((o) => o.event).length, ...cuts };
}
