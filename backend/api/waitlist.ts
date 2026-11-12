import { availableEstimate, simulateRange, unavailableEstimate } from "../estimator/estimator";
import type { CapacitySchedule } from "../estimator/estimator";
import type { DemoState, FamilyReferralResponse, QueueReferral, SlotPlan, StaffRow } from "./types";
import { daysBetween } from "./dates";
import {
  AS_OF, ASSESSMENT_SITES, CLINICS, DEFAULT_CLINIC_ID, appliesInWeek, confirmedPlans, localSlots, travelToSite,
} from "./network";

export { AS_OF };
export const CLINIC = CLINICS[DEFAULT_CLINIC_ID].clinic;
export const DEFAULT_SLOTS = CLINICS[DEFAULT_CLINIC_ID].capacity.assessment_slots_per_week;

function intakeComplete(r: QueueReferral, state: DemoState) {
  return r.intake_complete || state.intakeCompleted.includes(r.id);
}

export function readyLine(state: DemoState, clinicId: string) {
  return CLINICS[clinicId].referrals
    .filter((r) => r.status === "waiting_for_assessment" && intakeComplete(r, state))
    .sort((a, b) => a.received_on.localeCompare(b.received_on) || a.id.localeCompare(b.id));
}

function capacitySchedule(clinicId: string, state: DemoState, line: { id: string }[], proposal?: SlotPlan): CapacitySchedule | undefined {
  const plans: SlotPlan[] = confirmedPlans(state);
  if (proposal) plans.push(proposal);
  const incoming = plans.filter((plan) => plan.receiverId === clinicId);
  const outgoing = plans.filter((plan) => plan.providerId === clinicId);
  if (!incoming.length && !outgoing.length) return undefined;
  const shared = incoming.map((plan) => {
    const site = ASSESSMENT_SITES.find((entry) => entry.id === plan.siteId);
    const eligible = line.map(({ id }) => site?.clinic_id === clinicId || travelToSite(id, plan.siteId)?.eligible === true);
    return { plan, eligible };
  });
  return {
    week: (week) => ({
      reserved: outgoing.filter((plan) => appliesInWeek(plan, week)).reduce((sum, plan) => sum + plan.slots, 0),
      shared: shared.filter(({ plan }) => appliesInWeek(plan, week)).map(({ plan, eligible }) => ({
        slots: plan.slots, eligible,
      })),
    }),
  };
}

function estimateFor(r: QueueReferral, position: number | null, slots: number, schedule?: CapacitySchedule) {
  if (r.status === "assessment_booked") return unavailableEstimate(AS_OF, "booked");
  if (r.status === "on_hold") return unavailableEstimate(AS_OF, "on_hold");
  if (position === null) return unavailableEstimate(AS_OF, "intake_incomplete");
  const range = simulateRange(position, slots, `${r.id}:${slots}`, schedule);
  return range ? availableEstimate(AS_OF, range) : unavailableEstimate(AS_OF, "beyond_horizon");
}

export function listQueue(state: DemoState, clinicId = DEFAULT_CLINIC_ID, proposal?: SlotPlan): StaffRow[] {
  const line = readyLine(state, clinicId);
  const positions = new Map(line.map((r, i) => [r.id, i + 1]));
  const schedule = capacitySchedule(clinicId, state, line, proposal);
  const slots = localSlots(state, clinicId);

  return CLINICS[clinicId].referrals.map((r) => {
    const position = positions.get(r.id) ?? null;
    return {
      ...r,
      intake_complete: intakeComplete(r, state),
      position,
      days_waiting: daysBetween(r.received_on, AS_OF),
      estimate: estimateFor(r, position, slots, schedule),
    };
  });
}

/** What a ready-to-book referral logged today would be told. */
export function newReferralEstimate(state: DemoState, clinicId = DEFAULT_CLINIC_ID, proposal?: SlotPlan) {
  const line = [...readyLine(state, clinicId), { id: "" }];
  const schedule = capacitySchedule(clinicId, state, line, proposal);
  const slots = localSlots(state, clinicId);
  return simulateRange(line.length, slots, `new:${slots}`, schedule);
}

export function getFamilyReferral(id: string, state: DemoState): FamilyReferralResponse | null {
  const clinicId = Object.keys(CLINICS).find((key) => CLINICS[key].referrals.some((r) => r.id === id));
  if (!clinicId) return null;
  const row = listQueue(state, clinicId).find((r) => r.id === id);
  if (!row) return null;
  const { clinic } = CLINICS[clinicId];
  const site = ASSESSMENT_SITES.find((entry) => entry.id === row.appointment_site_id);
  return {
    referral: {
      id: row.id,
      service: clinic.service,
      status: row.status,
      received_on: row.received_on,
      ...(row.appointment_on ? { appointment_on: row.appointment_on } : {}),
      ...(row.status === "assessment_booked" && site ? { appointment_site: { name: site.name, location: site.location } } : {}),
    },
    estimate: row.estimate,
    clinic: { contact: clinic.contact, name: clinic.name, phone: clinic.phone, hours: clinic.hours },
  };
}
