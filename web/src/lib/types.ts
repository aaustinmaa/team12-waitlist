// Shapes follow docs/wait-time.md. Fields marked "prototype addition" are optional
// extras the UI uses; the core family response contract is unchanged.

export type ReferralStatus = "waiting_for_assessment" | "on_hold" | "assessment_booked";

/** Clinical priority set by the clinic, highest first. Decides the order of the line. */
export const PRIORITIES = ["urgent", "high", "standard"] as const;
export type Priority = (typeof PRIORITIES)[number];

export interface Hold {
  start: string;
  end: string | null;
  reason: string;
}

/** Booking details the clinic records with a confirmed first-assessment date. */
export interface QueueAppointment {
  /** local clinic time, HH:MM (24 hour) */
  start_time: string;
  duration_minutes: number;
  clinician_id: string;
  room?: string;
}

/** One open referral as the staff and family views show it. */
export interface QueueReferral {
  id: string;
  received_on: string;
  status: ReferralStatus;
  age_group: string;
  referral_source: string;
  /** missing means "standard" */
  priority?: Priority;
  intake_complete: boolean;
  hold: Hold | null;
  appointment_on?: string;
  appointment?: QueueAppointment;
}

/** Languages a clinician works in. */
export type ClinicianLanguage = "en" | "fr" | "es" | "cmn" | "yue";

export interface Clinician {
  id: string;
  name: string;
  role: "slp";
  registration: string;
  languages: ClinicianLanguage[];
}

export interface Portal {
  id: string;
  name: string;
  url: string;
}

export interface Clinic {
  name: string;
  service: string;
  contact: string;
  phone: string;
  hours: string;
  address: string;
  /** IANA time zone the appointment times are in */
  timezone: string;
  clinicians: Clinician[];
  /** other patient portals this clinic's families commonly use */
  portals: Portal[];
}

export interface ClinicQueue {
  as_of: string;
  clinic: Clinic;
  capacity: { assessment_slots_per_week: number };
  referrals: QueueReferral[];
}

export type UnavailableReason = "intake_incomplete" | "on_hold" | "booked" | "beyond_horizon" | "insufficient_data";

export interface Estimate {
  status: "available" | "unavailable";
  milestone: "first_assessment";
  as_of: string;
  range_weeks: { lower: number; upper: number } | null;
  message: string;
  /** prototype addition: why no range is shown */
  reason?: UnavailableReason;
}

/** prototype addition: everything a family needs to get to a booked first assessment */
export interface FamilyAppointment {
  on: string;
  start_time: string;
  duration_minutes: number;
  timezone: string;
  location: { name: string; address: string; room?: string };
  clinician: Omit<Clinician, "id"> | null;
}

/** Family referral response, as defined in docs/wait-time.md. */
export interface FamilyReferralResponse {
  referral: {
    id: string;
    service: string;
    status: ReferralStatus;
    received_on: string;
    /** prototype addition: confirmed first-assessment date when booked */
    appointment_on?: string;
    /** prototype addition: the referral's hold, current or past, when it has one */
    hold?: Hold;
    /** prototype addition: days on hold up to estimate.as_of, when it has a hold */
    days_on_hold?: number;
  };
  estimate: Estimate;
  clinic: {
    contact: string;
    /** prototype additions for the contact card */
    name?: string;
    phone?: string;
    hours?: string;
    portals?: Portal[];
  };
  /** prototype addition: the priority the clinic gave this referral */
  priority?: Priority;
  /** prototype addition: time, place and clinician, when the first assessment is booked */
  appointment?: FamilyAppointment;
  /**
   * prototype addition: how long it usually takes before an estimate can be shown,
   * measured on the clinic's past referrals (referral received -> intake complete)
   */
  intake?: { typical_days: number; most_within_days: number; days_since_received: number };
  /** prototype addition: masked contact details the clinic has on file for updates */
  contact_on_file?: { email: string; phone: string };
}

/** What the staff dashboard sees per referral. */
export interface StaffRow extends QueueReferral {
  /** vanished from the latest export without being closed; staff should check it */
  needs_review?: boolean;
  /** the range the engine computed, shown to staff even when families can't see it yet */
  staff_range?: { lower: number; upper: number } | null;
  priority: Priority;
  /** 1-based place among referrals ready to be booked, null if not in that line */
  position: number | null;
  /** calendar days since the referral was received, holds included */
  days_waiting: number;
  /** the part of days_waiting the referral spent on hold */
  days_on_hold: number;
  estimate: Estimate;
}

/** The part of the clinic's working state that changes the line and the estimates. */
export interface QueueState {
  /** planning scenario: first assessments a week added (or removed) on top of the clinic's own recent history */
  extraSlots: number;
  /** staff can mark intake complete for a referral during the demo */
  intakeCompleted: string[];
  /** staff can change a referral's priority during the demo */
  priority?: Record<string, Priority>;
}

export type Channel = "email" | "sms" | "browser";
export type NotifyPrefs = Record<Channel, boolean>;

export type NoticeKind = "estimate_ready" | "estimate_changed" | "estimate_paused";

/** One update sent to a family because what they see on their page changed. */
export interface Notice {
  id: string;
  referral_id: string;
  kind: NoticeKind;
  /** ISO timestamp */
  at: string;
  range: { lower: number; upper: number } | null;
  previous: { lower: number; upper: number } | null;
  reason?: UnavailableReason;
  /** channels the family had switched on when it was sent */
  channels: Channel[];
}

/** One staff change to a referral's priority, with the reason given. */
export interface PriorityChange {
  referral_id: string;
  from: Priority;
  to: Priority;
  reason: string;
  by: string;
  /** ISO timestamp */
  at: string;
}

/** A clinic's working state on top of its imported records. */
export interface DemoState extends QueueState {
  priority: Record<string, Priority>;
  /** per referral; a referral with no entry uses the default (email on) */
  notifyPrefs: Record<string, NotifyPrefs>;
  /** newest first */
  notices: Notice[];
  /** per referral, the estimate the family was last told about */
  told: Record<string, string>;
  /** guided tours this browser has already shown */
  toursSeen: string[];
  /** per referral, the email and mobile number the family entered for updates */
  contacts: Record<string, { email?: string; phone?: string }>;
  priorityLog: PriorityChange[];
}

/** One referral that has left the waitlist (legacy shape, kept for reference). */
export interface HistoryReferral {
  id: string;
  received_on: string;
  intake_completed_on: string;
  age_group: string;
  referral_source: string;
  outcome: "assessed" | "withdrawn";
  /** first-assessment date, or the date the referral was withdrawn */
  closed_on: string;
  withdrawn_reason?: string;
  hold: Hold | null;
  /** back-test: the range the estimator would have shown once intake was complete */
  estimate_at_intake: { as_of: string; lower_weeks: number; upper_weeks: number } | null;
}

export interface ClinicHistory {
  as_of: string;
  referrals: HistoryReferral[];
}
