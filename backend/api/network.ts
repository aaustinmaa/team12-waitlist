import mapleQueue from "../../data/demo/clinic-queue.json";
import network from "../../data/demo/clinic-network.json";
import type { ClinicQueue, Connection, DemoState, SharedSlots, SlotPlan } from "./types";

export const DEFAULT_CLINIC_ID = "maple-grove";
export const CLINICS: Record<string, ClinicQueue> = {
  [DEFAULT_CLINIC_ID]: mapleQueue as ClinicQueue,
  "cedar-park": network.partner_queue as ClinicQueue,
};
export const ASSESSMENT_SITES = network.sites;
export const SERVICE_ID = network.service_id;
export const AS_OF = mapleQueue.as_of;
export const MAX_WEEK = 52;
export const MAX_SLOTS = 10;

export function localSlots(state: DemoState, clinicId: string) {
  return (clinicId === DEFAULT_CLINIC_ID ? state.slotsPerWeek : state.clinicSlots?.[clinicId])
    ?? CLINICS[clinicId].capacity.assessment_slots_per_week;
}

const preferences = network.travel_preferences as Record<string, { home_area: string; mode: string; max_minutes: number }>;
const travelMinutes = network.travel_minutes as Record<string, Record<string, Record<string, number>>>;

export function travelToSite(referralId: string, siteId: string) {
  const preference = preferences[referralId];
  if (!preference) return null;
  const minutes = travelMinutes[preference.home_area]?.[siteId]?.[preference.mode];
  return minutes === undefined ? null : {
    minutes, mode: preference.mode, maxMinutes: preference.max_minutes,
    eligible: minutes <= preference.max_minutes,
  };
}

export function connectionBetween(state: DemoState, a: string, b: string) {
  return state.connections?.find((link) => (
    (link.from === a && link.to === b) || (link.from === b && link.to === a)
  ));
}

export function confirmedPlans(state: DemoState) {
  return (state.sharedSlots ?? []).filter((plan) => plan.status === "confirmed");
}

export function appliesInWeek(plan: SlotPlan, week: number) {
  return week >= plan.startWeek && week < plan.startWeek + plan.weeks;
}

export function reservedSlots(state: DemoState, clinicId: string, week: number) {
  return confirmedPlans(state)
    .filter((plan) => plan.providerId === clinicId && appliesInWeek(plan, week))
    .reduce((total, plan) => total + plan.slots, 0);
}

export function minimumLocalSlots(state: DemoState, clinicId: string) {
  return Math.max(1, ...Array.from({ length: MAX_WEEK }, (_, i) => reservedSlots(state, clinicId, i + 1)));
}

export function validateSlotPlan(state: DemoState, plan: SlotPlan) {
  if (connectionBetween(state, plan.providerId, plan.receiverId)?.status !== "active") {
    return "An active clinic connection is required.";
  }
  if (plan.serviceId !== SERVICE_ID || !ASSESSMENT_SITES.some(
    (site) => site.id === plan.siteId && [plan.providerId, plan.receiverId].includes(site.clinic_id),
  )) {
    return "Choose an assessment site at one of the two clinics.";
  }
  if (![plan.startWeek, plan.weeks, plan.slots].every(Number.isInteger)
    || plan.startWeek < 1 || plan.weeks < 1 || plan.startWeek + plan.weeks - 1 > MAX_WEEK
    || plan.slots < 1 || plan.slots > MAX_SLOTS) {
    return "Choose a valid start week, duration, and number of slots.";
  }
  for (let week = plan.startWeek; week < plan.startWeek + plan.weeks; week++) {
    if (plan.slots + reservedSlots(state, plan.providerId, week) > localSlots(state, plan.providerId)) {
      return `The providing clinic has fewer than ${plan.slots} uncommitted slots in week ${week}.`;
    }
  }
  return null;
}

export type NetworkAction =
  | { type: "invite" | "accept" | "disconnect"; partnerId: string }
  | { type: "propose"; id: string; plan: SlotPlan }
  | { type: "confirm" | "cancel"; id: string };

export function updateNetwork(state: DemoState, clinicId: string, action: NetworkAction): DemoState {
  if (!Object.hasOwn(CLINICS, clinicId)) throw new Error("Unknown clinic.");
  const plans = state.sharedSlots ?? [];
  if ("partnerId" in action) {
    const { partnerId, type } = action;
    if (clinicId === partnerId || !Object.hasOwn(CLINICS, partnerId)) throw new Error("Choose a partner clinic.");
    const existing = connectionBetween(state, clinicId, partnerId);
    let connection: Connection;
    if (type === "invite" && (!existing || existing.status === "disconnected")) {
      connection = { from: clinicId, to: partnerId, status: "pending" };
    } else if (type === "accept" && existing?.status === "pending" && existing.to === clinicId) {
      connection = { ...existing, status: "active" };
    } else if (type === "disconnect" && existing && existing.status !== "disconnected") {
      connection = { ...existing, status: "disconnected" };
    } else {
      throw new Error("The connection has changed. Check its current status.");
    }
    const connections = (state.connections ?? []).filter((link) => link !== existing);
    return {
      ...state,
      connections: [...connections, connection],
      sharedSlots: type === "disconnect" ? plans.map((plan) =>
        plan.status === "proposed" && [plan.providerId, plan.receiverId].includes(clinicId)
          && [plan.providerId, plan.receiverId].includes(partnerId) ? { ...plan, status: "cancelled" } : plan,
      ) : plans,
    };
  }

  if (action.type === "propose") {
    if (action.plan.receiverId !== clinicId) throw new Error("Propose capacity for your own clinic.");
    if (plans.some((plan) => plan.id === action.id)) return state;
    const error = validateSlotPlan(state, action.plan);
    if (error) throw new Error(error);
    return { ...state, sharedSlots: [...plans, { ...action.plan, id: action.id, status: "proposed" }] };
  }

  const plan = plans.find((entry) => entry.id === action.id);
  if (!plan || ![plan.providerId, plan.receiverId].includes(clinicId) || plan.status === "cancelled") {
    throw new Error("This capacity agreement is no longer available.");
  }
  let status: SharedSlots["status"] = "cancelled";
  if (action.type === "confirm") {
    if (plan.providerId !== clinicId || plan.status !== "proposed") {
      throw new Error("The providing clinic can confirm a pending proposal.");
    }
    const error = validateSlotPlan(state, plan);
    if (error) throw new Error(error);
    status = "confirmed";
  }
  return { ...state, sharedSlots: plans.map((entry) => entry.id === plan.id ? { ...entry, status } : entry) };
}
