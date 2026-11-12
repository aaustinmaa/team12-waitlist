// Shapes follow docs/wait-time.md. Fields marked "prototype addition" are optional
// extras the UI uses; the core family response contract is unchanged.

export type ReferralStatus = "waiting_for_assessment" | "on_hold" | "assessment_booked";

export interface Hold {
  start: string;
  end: string | null;
  reason: string;
}

/** One row of the synthetic clinic queue (data/demo/clinic-queue.json). */
export interface QueueReferral {
  id: string;
  received_on: string;
  status: ReferralStatus;
  age_group: string;
  referral_source: string;
  intake_complete: boolean;
  hold: Hold | null;
  appointment_on?: string;
}

export interface Clinic {
  name: string;
  service: string;
  contact: string;
  phone: string;
  hours: string;
}

export interface ClinicQueue {
  as_of: string;
  clinic: Clinic;
  capacity: { assessment_slots_per_week: number };
  referrals: QueueReferral[];
}

export type UnavailableReason = "intake_incomplete" | "on_hold" | "booked" | "beyond_horizon";

/** Family referral response, as defined in docs/wait-time.md. */
export interface FamilyReferralResponse {
  referral: {
    id: string;
    service: string;
    status: ReferralStatus;
    received_on: string;
    /** prototype addition: confirmed first-assessment date when booked */
    appointment_on?: string;
  };
  estimate: {
    status: "available" | "unavailable";
    milestone: "first_assessment";
    as_of: string;
    range_weeks: { lower: number; upper: number } | null;
    message: string;
    /** prototype addition: why no range is shown */
    reason?: UnavailableReason;
  };
  clinic: {
    contact: string;
    /** prototype additions for the contact card */
    name?: string;
    phone?: string;
    hours?: string;
  };
}

/** What the staff dashboard sees per referral. */
export interface StaffRow extends QueueReferral {
  /** 1-based place among referrals ready to be booked, null if not in that line */
  position: number | null;
  days_waiting: number;
  estimate: FamilyReferralResponse["estimate"];
}

/** Adjustable demo state shared by both views. */
export interface DemoState {
  slotsPerWeek: number;
  /** staff can mark intake complete for a referral during the demo */
  intakeCompleted: string[];
}

/** One referral that has left the waitlist (data/demo/clinic-history.json). */
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
