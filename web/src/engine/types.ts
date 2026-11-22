// The canonical referral record every clinic export is converted into.
//
// A clinic's own system (whatever its vendor or column names) is mapped onto
// this shape once, by the import's mapping recipe. Everything after the import
// (the estimator, the reports, both apps) only ever sees these records.
//
// One record per referral. Dates are plain YYYY-MM-DD strings (UTC days).

export const PRIORITIES = ["urgent", "high", "standard"] as const;
export type Priority = (typeof PRIORITIES)[number];

export type CloseReason = "assessed" | "withdrawn";

export interface ReferralRecord {
  referral_id: string;
  service: string;
  priority: Priority;
  /** the receiving clinic logged the referral */
  received_on: string;
  /** intake information complete: the referral joins the line for a first assessment */
  intake_completed_on: string | null;
  hold_start: string | null;
  /** null while the hold is still open */
  hold_end: string | null;
  hold_reason: string | null;
  /** first-assessment date the clinic booked, when it has booked one */
  booked_for: string | null;
  /** local clinic time HH:MM, when the export has it */
  booked_time: string | null;
  clinician: string | null;
  /** the referral left the waitlist: first assessment done, or withdrawn */
  closed_on: string | null;
  close_reason: CloseReason | null;
  withdrawn_reason: string | null;
  age_group: string | null;
  referral_source: string | null;
  /** only used to let the family sign in and to send updates; never shown to the estimator */
  family_email: string | null;
  family_phone: string | null;
  /** set by the import when the referral vanished from the latest export without being closed */
  needs_review?: boolean;
}

export const RECORD_FIELDS = [
  "referral_id",
  "service",
  "priority",
  "received_on",
  "intake_completed_on",
  "hold_start",
  "hold_end",
  "hold_reason",
  "booked_for",
  "booked_time",
  "clinician",
  "closed_on",
  "close_reason",
  "withdrawn_reason",
  "age_group",
  "referral_source",
  "family_email",
  "family_phone",
] as const satisfies readonly (keyof ReferralRecord)[];

export type RecordField = (typeof RECORD_FIELDS)[number];

export const REQUIRED_FIELDS: RecordField[] = ["referral_id", "received_on"];
