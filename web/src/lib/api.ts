// Data access for both views. Today it reads the synthetic fixtures in
// data/demo and runs the simulated estimator in the browser. When backend/api
// exists, replace these functions with fetch calls that return the same shapes.

import queueJson from "../../../data/demo/clinic-queue.json";
import { availableEstimate, simulateRange, unavailableEstimate } from "./estimator";
import type { ClinicQueue, DemoState, FamilyReferralResponse, QueueReferral, StaffRow } from "./types";
import { daysBetween } from "./dates";

const queue = queueJson as unknown as ClinicQueue;

export const AS_OF = queue.as_of;
export const CLINIC = queue.clinic;
export const DEFAULT_SLOTS = queue.capacity.assessment_slots_per_week;

function intakeComplete(r: QueueReferral, state: DemoState) {
  return r.intake_complete || state.intakeCompleted.includes(r.id);
}

/** Referrals that are ready to be offered a first assessment, oldest first. */
function readyLine(state: DemoState) {
  return queue.referrals
    .filter((r) => r.status === "waiting_for_assessment" && intakeComplete(r, state))
    .sort((a, b) => a.received_on.localeCompare(b.received_on) || a.id.localeCompare(b.id));
}

function estimateFor(r: QueueReferral, position: number | null, state: DemoState) {
  if (r.status === "assessment_booked") return unavailableEstimate(AS_OF, "booked");
  if (r.status === "on_hold") return unavailableEstimate(AS_OF, "on_hold");
  if (!intakeComplete(r, state) || position === null) return unavailableEstimate(AS_OF, "intake_incomplete");
  const range = simulateRange(position, state.slotsPerWeek, `${r.id}:${state.slotsPerWeek}`);
  return range ? availableEstimate(AS_OF, range) : unavailableEstimate(AS_OF, "beyond_horizon");
}

export function listQueue(state: DemoState): StaffRow[] {
  const positions = new Map(readyLine(state).map((r, i) => [r.id, i + 1]));
  return queue.referrals.map((r) => {
    const position = positions.get(r.id) ?? null;
    return {
      ...r,
      intake_complete: intakeComplete(r, state),
      position,
      days_waiting: daysBetween(r.received_on, AS_OF),
      estimate: estimateFor(r, position, state),
    };
  });
}

/** What a new referral logged today would be told. */
export function newReferralEstimate(state: DemoState) {
  const position = readyLine(state).length + 1;
  return simulateRange(position, state.slotsPerWeek, `new:${state.slotsPerWeek}`);
}

export function getFamilyReferral(id: string, state: DemoState): FamilyReferralResponse | null {
  const row = listQueue(state).find((r) => r.id === id);
  if (!row) return null;
  return {
    referral: {
      id: row.id,
      service: CLINIC.service,
      status: row.status,
      received_on: row.received_on,
      ...(row.appointment_on ? { appointment_on: row.appointment_on } : {}),
    },
    estimate: row.estimate,
    clinic: { contact: CLINIC.contact, name: CLINIC.name, phone: CLINIC.phone, hours: CLINIC.hours },
  };
}
