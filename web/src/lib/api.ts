// Turns one clinic's imported records, its working state and the engine's
// estimates into the shapes the two apps show (docs/wait-time.md).
//
// Everything is a pure function of a ClinicView, so the same code can later
// run on the server and return the same shapes over HTTP.

import type { EngineModel, LiveEstimate } from "../engine/model";
import type { ReferralRecord } from "../engine/types";
import { quantile as q } from "../engine/util";
import { daysBetween, holdDays } from "./dates";
import type {
  Clinic,
  DemoState,
  Estimate,
  FamilyAppointment,
  FamilyReferralResponse,
  Priority,
  QueueReferral,
  StaffRow,
  UnavailableReason,
} from "./types";

export const MESSAGES: Record<"available" | UnavailableReason, string> = {
  available: "This estimate may change as appointments become available. The clinic will confirm your appointment separately.",
  intake_incomplete: "Your referral is still on the waitlist. We don't have enough information to estimate your wait yet.",
  on_hold: "Your referral is on hold, so we can't estimate your wait right now. It is still on the waitlist.",
  booked: "Your first assessment is booked. The clinic has confirmed the date shown here.",
  beyond_horizon: "Your referral is still on the waitlist. The wait is currently too long for us to estimate reliably.",
  insufficient_data: "Your referral is still on the waitlist. This clinic doesn't have enough history yet for a reliable estimate.",
};

export interface ClinicView {
  id: string;
  info: Clinic;
  /** the day the latest import describes */
  asOf: string;
  /** imported records with staff changes (priority, intake done) applied */
  records: ReferralRecord[];
  model: EngineModel;
  estimates: Map<string, LiveEstimate>;
  newReferral: Record<Priority, { lower: number; upper: number } | null>;
  ops: DemoState;
  /** when the view holds only one family's referrals, the clinic-wide intake timing comes with it */
  intake?: { typical_days: number; most_within_days: number };
}

/** Imported records with this clinic's staff changes applied. */
export function effectiveRecords(records: ReferralRecord[], ops: Pick<DemoState, "priority" | "intakeCompleted">, asOf: string) {
  return records.map((r) => {
    const p = ops.priority[r.referral_id];
    const intake = !r.intake_completed_on && ops.intakeCompleted.includes(r.referral_id) ? asOf : r.intake_completed_on;
    return p || intake !== r.intake_completed_on ? { ...r, ...(p ? { priority: p } : {}), intake_completed_on: intake } : r;
  });
}

function toEstimate(e: LiveEstimate | undefined, asOf: string): Estimate {
  // Not published yet (for example right after an import): say so plainly, never guess.
  if (!e) return { status: "unavailable", milestone: "first_assessment", as_of: asOf, range_weeks: null, message: MESSAGES.insufficient_data, reason: "insufficient_data" };
  if (e.status === "booked") return { status: "unavailable", milestone: "first_assessment", as_of: asOf, range_weeks: null, message: MESSAGES.booked, reason: "booked" };
  if (e.range && e.reason === null) return { status: "available", milestone: "first_assessment", as_of: asOf, range_weeks: e.range, message: MESSAGES.available };
  const reason = (e.reason ?? "intake_incomplete") as UnavailableReason;
  return { status: "unavailable", milestone: "first_assessment", as_of: asOf, range_weeks: null, message: MESSAGES[reason], reason };
}

function toQueue(r: ReferralRecord, e: LiveEstimate | undefined): QueueReferral {
  const status = e?.status === "booked" ? "assessment_booked" : e?.status === "on_hold" ? "on_hold" : "waiting_for_assessment";
  return {
    id: r.referral_id,
    received_on: r.received_on,
    status,
    age_group: r.age_group ?? "–",
    referral_source: r.referral_source ?? "–",
    priority: r.priority,
    intake_complete: r.intake_completed_on !== null,
    hold: r.hold_start ? { start: r.hold_start, end: r.hold_end, reason: r.hold_reason ?? "Not given" } : null,
    ...(status === "assessment_booked" && r.booked_for ? { appointment_on: r.booked_for } : {}),
    ...(status === "assessment_booked" && r.booked_for && r.booked_time
      ? { appointment: { start_time: r.booked_time, duration_minutes: 60, clinician_id: r.clinician ?? "" } }
      : {}),
  };
}

const isOpen = (r: ReferralRecord, asOf: string) => r.closed_on === null || r.closed_on > asOf;

/** Every referral still on the waitlist, for the staff dashboard. */
export function listQueue(v: ClinicView): StaffRow[] {
  return v.records
    .filter((r) => isOpen(r, v.asOf))
    .map((r) => {
      const e = v.estimates.get(r.referral_id);
      return {
        ...toQueue(r, e),
        priority: r.priority,
        position: e?.status === "ready" ? e.position : null,
        days_waiting: daysBetween(r.received_on, v.asOf),
        days_on_hold: holdDays(r.hold_start ? { start: r.hold_start, end: r.hold_end } : null, v.asOf),
        estimate: toEstimate(e, v.asOf),
        staff_range: e?.range ?? null,
        ...(r.needs_review ? { needs_review: true } : {}),
      };
    });
}

export function clinicianName(v: ClinicView, id: string | undefined) {
  if (!id) return null;
  return v.info.clinicians.find((c) => c.id === id)?.name ?? id;
}

/**
 * How long this clinic has taken to complete intake (when an estimate can
 * first be shown), over referrals received in the year before the data date.
 */
export function intakeTiming(v: Pick<ClinicView, "records" | "asOf">) {
  const days = v.records
    .filter((r) => r.intake_completed_on && daysBetween(r.received_on, v.asOf) <= 365)
    .map((r) => daysBetween(r.received_on, r.intake_completed_on!))
    .sort((a, b) => a - b);
  if (days.length === 0) return { typical_days: 21, most_within_days: 42 };
  return { typical_days: Math.round(q(days, 0.5)), most_within_days: Math.ceil(q(days, 0.9)) };
}

function appointmentFor(v: ClinicView, r: ReferralRecord, status: string): FamilyAppointment | undefined {
  if (status !== "assessment_booked" || !r.booked_for || !r.booked_time) return undefined;
  const clinician = v.info.clinicians.find((c) => c.id === r.clinician);
  return {
    on: r.booked_for,
    start_time: r.booked_time,
    duration_minutes: 60,
    timezone: v.info.timezone,
    location: { name: v.info.name, address: v.info.address },
    clinician: clinician ? { name: clinician.name, role: clinician.role, registration: clinician.registration, languages: clinician.languages } : null,
  };
}

/** The contact details on file, masked the way a family sees them. */
export function maskedContact(r: ReferralRecord) {
  const email = r.family_email ? r.family_email.replace(/^(.)[^@]*(@.*)$/, "$1•••••$2") : "";
  const digits = (r.family_phone ?? "").replace(/\D/g, "");
  const phone = digits.length >= 4 ? `•••-•••-${digits.slice(-4)}` : "";
  return { email, phone };
}

export function getFamilyReferral(v: ClinicView, id: string): FamilyReferralResponse | null {
  const record = v.records.find((r) => r.referral_id === id);
  if (!record || !isOpen(record, v.asOf)) return null;
  const row = listQueue(v).find((r) => r.id === id)!;
  const appointment = appointmentFor(v, record, row.status);
  return {
    referral: {
      id: row.id,
      service: v.info.service,
      status: row.status,
      received_on: row.received_on,
      ...(row.appointment_on ? { appointment_on: row.appointment_on } : {}),
      ...(row.hold ? { hold: row.hold, days_on_hold: row.days_on_hold } : {}),
    },
    estimate: row.estimate,
    clinic: { contact: v.info.contact, name: v.info.name, phone: v.info.phone, hours: v.info.hours, portals: v.info.portals },
    priority: row.priority,
    ...(appointment ? { appointment } : {}),
    intake: { ...(v.intake ?? intakeTiming(v)), days_since_received: row.days_waiting },
    contact_on_file: maskedContact(record),
  };
}

/** Normalise an email or phone the way sign-in compares them. */
export function contactKey(s: string) {
  const t = s.trim().toLowerCase();
  if (t.includes("@")) return t;
  const digits = t.replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : digits;
}

/** The open referrals at this clinic whose family contact matches. */
export function referralsForContact(v: Pick<ClinicView, "records" | "asOf">, contact: string) {
  const key = contactKey(contact);
  if (!key) return [];
  return v.records.filter(
    (r) => isOpen(r, v.asOf) && ((r.family_email && contactKey(r.family_email) === key) || (r.family_phone && contactKey(r.family_phone) === key)),
  );
}
