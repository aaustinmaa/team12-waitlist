// What a referrer (family doctor, paediatrician) sees about each clinic when
// choosing where to send a child: the wait a referral made today would face,
// and the facts behind it. Only clinic-wide totals; nothing about any child.
//
// Pure functions of a ClinicView, like the rest of lib/api.ts, so the same
// code can later run on the server over each clinic's published summary.

import type { ReferrerProfile } from "../platform/clinics";
import { intakeTiming, listQueue, type ClinicView } from "./api";
import type { ClinicianLanguage, Priority } from "./types";

export type WaitAnswer =
  /** weeks from referral to first assessment, for a referral made today */
  | { kind: "range"; lower: number; upper: number }
  /** the clinic's history is too short to check an estimate against (the same gate families get) */
  | { kind: "not_enough_history" }
  /** the line is longer than the engine can estimate reliably */
  | { kind: "too_long" };

export interface DirectoryEntry {
  clinicId: string;
  name: string;
  service: string;
  city: string;
  serves: string;
  languages: ClinicianLanguage[];
  howToRefer: string;
  phone: string;
  /** the day the clinic's latest data describes */
  asOf: string;
  wait: WaitAnswer;
  /** referrals still waiting for a first assessment that isn't booked yet */
  waitingNow: number;
  /** first assessments a week, recently */
  perWeek: number;
  /** typical days from referral to intake complete */
  intakeDays: number;
  /** share of past families whose real wait fell inside their range; null when not shown */
  coverage: number | null;
}

export function directoryEntry(v: ClinicView, profile: ReferrerProfile, priority: Priority): DirectoryEntry {
  const range = v.newReferral[priority];
  const wait: WaitAnswer = !v.model.gate.familyVisible
    ? { kind: "not_enough_history" }
    : range
      ? { kind: "range", lower: range.lower, upper: range.upper }
      : { kind: "too_long" };
  return {
    clinicId: v.id,
    name: v.info.name,
    service: v.info.service,
    city: profile.city,
    serves: profile.serves,
    languages: profile.languages,
    howToRefer: profile.howToRefer,
    phone: v.info.phone,
    asOf: v.asOf,
    wait,
    waitingNow: listQueue(v).filter((r) => r.status !== "assessment_booked").length,
    perWeek: Math.round(v.model.params.meanThroughput * 10) / 10,
    intakeDays: intakeTiming(v).typical_days,
    coverage: v.model.gate.familyVisible ? v.model.backtest.coverage : null,
  };
}

const RANK: Record<WaitAnswer["kind"], number> = { range: 0, too_long: 1, not_enough_history: 2 };

/**
 * Shortest expected wait first. Clinics without an estimate come last, in name
 * order: "no estimate yet" says nothing about how long the wait really is.
 */
export function sortByWait(entries: DirectoryEntry[]) {
  return [...entries].sort((a, b) => {
    const k = RANK[a.wait.kind] - RANK[b.wait.kind];
    if (k) return k;
    if (a.wait.kind === "range" && b.wait.kind === "range") {
      const mid = (w: { lower: number; upper: number }) => w.lower + w.upper;
      const d = mid(a.wait) - mid(b.wait) || a.wait.upper - b.wait.upper;
      if (d) return d;
    }
    return a.name.localeCompare(b.name);
  });
}

/** Clinics that can see a family in this language ("any" keeps them all). */
export function speaks(entries: DirectoryEntry[], lang: ClinicianLanguage | "any") {
  return lang === "any" ? entries : entries.filter((e) => e.languages.includes(lang));
}
