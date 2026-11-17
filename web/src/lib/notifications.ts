// Updates for families. When something staff do changes what a family sees
// (intake completed, capacity or priority changed), this works out who should
// be told and what. It is pure: the demo state decides when to run it and
// stores the result. Nothing is really emailed or texted in the prototype; the
// notices show on the family's page, in the staff outbox, and as a browser
// notification when the family switched that on.

import type { Channel, Estimate, Notice, NotifyPrefs, StaffRow } from "./types";

export const DEFAULT_PREFS: NotifyPrefs = { email: true, sms: false, browser: false };
export const CHANNELS: Channel[] = ["email", "sms", "browser"];

/** A range has to move this many weeks, at either end, before families are told again. */
export const MATERIAL_WEEKS = 2;

/** Keep the outbox from growing without limit during a long demo. */
export const MAX_NOTICES = 300;

/** Compact record of what a family was last told: "6-10", or "none:<reason>". */
export function told(e: Estimate) {
  return e.range_weeks ? `${e.range_weeks.lower}-${e.range_weeks.upper}` : `none:${e.reason ?? "unknown"}`;
}

function parseRange(s: string | undefined) {
  if (!s || s.startsWith("none")) return null;
  const [lower, upper] = s.split("-").map(Number);
  return { lower, upper };
}

/** What every family has been told at this point (used for the starting state). */
export function toldByAll(rows: StaffRow[]) {
  return Object.fromEntries(rows.map((r) => [r.id, told(r.estimate)]));
}

/**
 * Compare what each family was last told with what their page shows now.
 * Returns the notices to send and the updated record. A small shift in the
 * range sends nothing and keeps the old record, so several small shifts in a
 * row still add up to a notice.
 */
export function diffNotices(
  before: Record<string, string>,
  rows: StaffRow[],
  prefs: Record<string, NotifyPrefs>,
  now: Date,
): { notices: Notice[]; told: Record<string, string> } {
  const next = { ...before };
  const notices: Notice[] = [];
  for (const r of rows) {
    const cur = told(r.estimate);
    const prevSig = before[r.id];
    if (prevSig === undefined) {
      next[r.id] = cur;
      continue;
    }
    if (prevSig === cur) continue;
    // A booked referral has a confirmed date; the estimate no longer applies.
    if (r.status === "assessment_booked") {
      next[r.id] = cur;
      continue;
    }
    const previous = parseRange(prevSig);
    const range = r.estimate.range_weeks;
    let kind: Notice["kind"];
    if (!previous && range) kind = "estimate_ready";
    else if (previous && !range) kind = "estimate_paused";
    else if (previous && range) {
      if (Math.abs(previous.lower - range.lower) < MATERIAL_WEEKS && Math.abs(previous.upper - range.upper) < MATERIAL_WEEKS) continue;
      kind = "estimate_changed";
    } else {
      // No range before or after, only the reason changed. Nothing to announce.
      next[r.id] = cur;
      continue;
    }
    next[r.id] = cur;
    const p = prefs[r.id] ?? DEFAULT_PREFS;
    notices.push({
      id: `${now.getTime()}-${r.id}`,
      referral_id: r.id,
      kind,
      at: now.toISOString(),
      range,
      previous,
      ...(range ? {} : { reason: r.estimate.reason }),
      channels: CHANNELS.filter((c) => p[c]),
    });
  }
  return { notices, told: next };
}
