// Data access for both views. Today it reads the synthetic fixtures in
// data/demo and runs the simulated estimator in the browser. When backend/api
// exists, replace these functions with fetch calls that return the same shapes.

import historyJson from "../../../data/demo/clinic-history.json";
import queueJson from "../../../data/demo/clinic-queue.json";
import { availableEstimate, simulateRange, unavailableEstimate } from "./estimator";
import {
  PRIORITIES,
  type ClinicHistory,
  type ClinicQueue,
  type FamilyAppointment,
  type FamilyReferralResponse,
  type Priority,
  type QueueReferral,
  type QueueState,
  type StaffRow,
} from "./types";
import { daysBetween, holdDays } from "./dates";

const queue = queueJson as unknown as ClinicQueue;
const history = historyJson as unknown as ClinicHistory;

export const AS_OF = queue.as_of;
export const CLINIC = queue.clinic;
export const DEFAULT_SLOTS = queue.capacity.assessment_slots_per_week;

function intakeComplete(r: QueueReferral, state: QueueState) {
  return r.intake_complete || state.intakeCompleted.includes(r.id);
}

export function priorityOf(r: QueueReferral, state: QueueState): Priority {
  return state.priority?.[r.id] ?? r.priority ?? "standard";
}

const rank = (p: Priority) => PRIORITIES.indexOf(p);

/**
 * Referrals that are ready to be offered a first assessment, in the order the
 * clinic would see them: highest priority first, then oldest referral first.
 */
function readyLine(state: QueueState) {
  return queue.referrals
    .filter((r) => r.status === "waiting_for_assessment" && intakeComplete(r, state))
    .sort(
      (a, b) =>
        rank(priorityOf(a, state)) - rank(priorityOf(b, state)) || a.received_on.localeCompare(b.received_on) || a.id.localeCompare(b.id),
    );
}

function estimateFor(r: QueueReferral, position: number | null, state: QueueState) {
  if (r.status === "assessment_booked") return unavailableEstimate(AS_OF, "booked");
  if (r.status === "on_hold") return unavailableEstimate(AS_OF, "on_hold");
  if (!intakeComplete(r, state) || position === null) return unavailableEstimate(AS_OF, "intake_incomplete");
  const range = simulateRange(position, state.slotsPerWeek, `${r.id}:${state.slotsPerWeek}`, priorityOf(r, state));
  return range ? availableEstimate(AS_OF, range) : unavailableEstimate(AS_OF, "beyond_horizon");
}

export function listQueue(state: QueueState): StaffRow[] {
  const positions = new Map(readyLine(state).map((r, i) => [r.id, i + 1]));
  return queue.referrals.map((r) => {
    const position = positions.get(r.id) ?? null;
    return {
      ...r,
      priority: priorityOf(r, state),
      intake_complete: intakeComplete(r, state),
      position,
      days_waiting: daysBetween(r.received_on, AS_OF),
      days_on_hold: holdDays(r.hold, AS_OF),
      estimate: estimateFor(r, position, state),
    };
  });
}

/**
 * What a new referral logged today would be told, for each priority. A new
 * referral joins the line behind everyone of the same or a higher priority.
 */
export function newReferralEstimate(state: QueueState): Record<Priority, { lower: number; upper: number } | null> {
  const line = readyLine(state);
  const out = {} as Record<Priority, { lower: number; upper: number } | null>;
  for (const p of PRIORITIES) {
    const ahead = line.filter((r) => rank(priorityOf(r, state)) <= rank(p)).length;
    // "new:" keeps the seed the standard range has always used.
    const seed = p === "standard" ? `new:${state.slotsPerWeek}` : `new-${p}:${state.slotsPerWeek}`;
    out[p] = simulateRange(ahead + 1, state.slotsPerWeek, seed, p);
  }
  return out;
}

function quantile(sorted: number[], q: number) {
  const i = (sorted.length - 1) * q;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
}

/**
 * How long this clinic has taken to complete intake, which is when an estimate
 * can first be shown. Measured on referrals received in the year before the
 * snapshot: the middle referral, and the time within which 9 in 10 were done.
 */
export const INTAKE_TIMING = (() => {
  const days = history.referrals
    .filter((r) => daysBetween(r.received_on, AS_OF) <= 365)
    .map((r) => daysBetween(r.received_on, r.intake_completed_on))
    .sort((a, b) => a - b);
  return { typical_days: Math.round(quantile(days, 0.5)), most_within_days: Math.ceil(quantile(days, 0.9)) };
})();

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/**
 * Stand-in for the contact details a clinic has on file. Nothing real: the
 * address is on example.com and the number is in the 555-01xx fictional range.
 */
export function contactOnFile(id: string) {
  const h = hash(id);
  const letter = "abcdefghjklmnprstvw"[h % 19];
  return { email: `${letter}•••••@example.com`, phone: `•••-•••-01${String((h >>> 8) % 100).padStart(2, "0")}` };
}

function appointmentFor(r: QueueReferral): FamilyAppointment | undefined {
  if (r.status !== "assessment_booked" || !r.appointment_on || !r.appointment) return undefined;
  const clinician = CLINIC.clinicians.find((c) => c.id === r.appointment!.clinician_id);
  return {
    on: r.appointment_on,
    start_time: r.appointment.start_time,
    duration_minutes: r.appointment.duration_minutes,
    timezone: CLINIC.timezone,
    location: { name: CLINIC.name, address: CLINIC.address, ...(r.appointment.room ? { room: r.appointment.room } : {}) },
    clinician: clinician ? { name: clinician.name, role: clinician.role, registration: clinician.registration, languages: clinician.languages } : null,
  };
}

export function clinicianName(id: string | undefined) {
  return CLINIC.clinicians.find((c) => c.id === id)?.name ?? null;
}

export function getFamilyReferral(id: string, state: QueueState): FamilyReferralResponse | null {
  const row = listQueue(state).find((r) => r.id === id);
  if (!row) return null;
  const appointment = appointmentFor(row);
  return {
    referral: {
      id: row.id,
      service: CLINIC.service,
      status: row.status,
      received_on: row.received_on,
      ...(row.appointment_on ? { appointment_on: row.appointment_on } : {}),
      ...(row.hold ? { hold: row.hold, days_on_hold: row.days_on_hold } : {}),
    },
    estimate: row.estimate,
    clinic: { contact: CLINIC.contact, name: CLINIC.name, phone: CLINIC.phone, hours: CLINIC.hours, portals: CLINIC.portals },
    priority: row.priority,
    ...(appointment ? { appointment } : {}),
    intake: { ...INTAKE_TIMING, days_since_received: row.days_waiting },
    contact_on_file: contactOnFile(row.id),
  };
}
