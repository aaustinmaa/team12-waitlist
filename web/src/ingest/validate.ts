// Check converted records before they replace the clinic's data, and compare
// them with the previous import.
//
// Errors drop the row (it is listed so staff can fix it in their system).
// Warnings keep it. A referral that was open last time and is simply missing
// now is kept and marked "needs review" rather than silently dropped: it may
// have been withdrawn, merged, or left out of the export by mistake.

import type { ReferralRecord } from "../engine/types";
import type { RowIssue } from "./recipe";

export interface ImportDiff {
  added: number;
  closed: number;
  booked: number;
  changed: number;
  /** open last time, not in this file */
  vanished: string[];
}

export interface Validation {
  records: ReferralRecord[];
  issues: RowIssue[];
  /** the day the export describes */
  asOf: string;
  diff: ImportDiff | null;
}

const DATE_KEYS = ["received_on", "intake_completed_on", "hold_start", "hold_end", "closed_on"] as const;

/** The export's date: the latest past-tense date in it (future dates are bookings). */
export function inferAsOf(records: ReferralRecord[], today: string) {
  let max = "";
  for (const r of records) for (const k of DATE_KEYS) if (r[k] && r[k]! > max && r[k]! <= today) max = r[k]!;
  return max || today;
}

export function validateRecords(input: ReferralRecord[], opts: { today: string; asOf?: string; previous?: ReferralRecord[]; previousAsOf?: string }): Validation {
  const issues: RowIssue[] = [];
  const asOf = opts.asOf ?? inferAsOf(input, opts.today);
  const seen = new Set<string>();
  const records: ReferralRecord[] = [];
  for (const r of input) {
    const id = r.referral_id;
    const err = (message: string) => issues.push({ level: "error", referral_id: id, message });
    const warn = (message: string) => issues.push({ level: "warning", referral_id: id, message });
    if (!id) {
      err("A row has no referral ID.");
      continue;
    }
    if (seen.has(id)) {
      err(`Referral ${id} appears more than once; the first row was kept.`);
      continue;
    }
    if (!r.received_on) {
      err(`Referral ${id} has no received date.`);
      continue;
    }
    if (r.received_on > asOf) {
      err(`Referral ${id} was received after the export date (${r.received_on}).`);
      continue;
    }
    if (r.intake_completed_on && r.intake_completed_on < r.received_on) {
      err(`Referral ${id}: intake completed before the referral was received.`);
      continue;
    }
    if (r.closed_on && r.closed_on < r.received_on) {
      err(`Referral ${id}: closed before it was received.`);
      continue;
    }
    if (r.hold_start && r.hold_end && r.hold_end < r.hold_start) {
      err(`Referral ${id}: hold ends before it starts.`);
      continue;
    }
    if (r.closed_on && !r.close_reason) warn(`Referral ${id} is closed without a reason we recognise; it is not counted as an assessment.`);
    if (!r.closed_on && r.booked_for && r.booked_for < asOf) warn(`Referral ${id}: appointment date ${r.booked_for} has passed but the referral is still open.`);
    if (r.close_reason === "assessed" && r.intake_completed_on === null) warn(`Referral ${id} was assessed without an intake-complete date.`);
    seen.add(id);
    records.push(r);
  }

  let diff: ImportDiff | null = null;
  if (opts.previous) {
    const prev = new Map(opts.previous.map((r) => [r.referral_id, r]));
    const now = new Map(records.map((r) => [r.referral_id, r]));
    diff = { added: 0, closed: 0, booked: 0, changed: 0, vanished: [] };
    for (const r of records) {
      const p = prev.get(r.referral_id);
      if (!p) diff.added++;
      else {
        if (!p.closed_on && r.closed_on) diff.closed++;
        else if (!p.booked_for && r.booked_for) diff.booked++;
        else if (JSON.stringify({ ...p, needs_review: undefined }) !== JSON.stringify({ ...r, needs_review: undefined })) diff.changed++;
      }
    }
    for (const p of opts.previous) {
      if (now.has(p.referral_id) || p.closed_on) continue;
      diff.vanished.push(p.referral_id);
      warn(p.referral_id, `Referral ${p.referral_id} was on the waitlist in the last import and is missing from this one. It is kept and marked for review.`);
      records.push({ ...p, needs_review: true });
    }
  }
  return { records, issues, asOf, diff };

  function warn(id: string, message: string) {
    issues.push({ level: "warning", referral_id: id, message });
  }
}
