import { describe, expect, it } from "vitest";
import { SERVICE_ID, reservedSlots, travelToSite, updateNetwork } from "../../../backend/api/network";
import { simulateRange } from "../../../backend/estimator/estimator";
import { DEFAULT_SLOTS, getFamilyReferral, listQueue, newReferralEstimate } from "./api";
import type { DemoState, SlotPlan } from "./types";

const maple = "maple-grove";
const cedar = "cedar-park";
const initial: DemoState = { slotsPerWeek: DEFAULT_SLOTS, intakeCompleted: [] };
const plan: SlotPlan = {
  providerId: cedar, receiverId: maple, serviceId: SERVICE_ID,
  siteId: "cedar-site", startWeek: 1, weeks: 3, slots: 2,
};
const invited = updateNetwork(initial, maple, { type: "invite", partnerId: cedar });
const linked = updateNetwork(invited, cedar, { type: "accept", partnerId: maple });
const proposed = updateNetwork(linked, maple, { type: "propose", id: "shared-1", plan });
const confirmed = updateNetwork(proposed, cedar, { type: "confirm", id: "shared-1" });
const familyRange = (state: DemoState) => getFamilyReferral("demo-001", state)?.estimate.range_weeks;

describe("clinic connections and shared capacity", () => {
  it("requires the other clinic to accept a connection and only shows its own referrals in each queue", () => {
    expect(() => updateNetwork(invited, maple, { type: "accept", partnerId: cedar })).toThrow();
    expect(listQueue(linked, cedar).some(({ id }) => id === "demo-001")).toBe(false);
    expect(getFamilyReferral("cedar-001", linked)?.clinic.name).toContain("Cedar Park");
  });

  it("keeps current estimates when connected or proposed and applies the preview when confirmed", () => {
    const base = familyRange(initial);
    const scenario = listQueue(linked, maple, plan).find(({ id }) => id === "demo-001")?.estimate.range_weeks;
    expect(familyRange(linked)).toEqual(base);
    expect(familyRange(proposed)).toEqual(base);
    expect(familyRange(confirmed)).toEqual(scenario);
    expect(scenario!.upper).toBeLessThan(base!.upper);
    expect(() => updateNetwork(proposed, maple, { type: "confirm", id: "shared-1" })).toThrow();
  });

  it("reserves provider slots only in the agreed weeks and rechecks capacity on confirmation", () => {
    expect([1, 2, 3, 4].map((week) => reservedSlots(confirmed, cedar, week))).toEqual([2, 2, 2, 0]);
    expect(newReferralEstimate(confirmed, cedar)!.lower).toBeGreaterThan(newReferralEstimate(linked, cedar)!.lower);
    const competing = updateNetwork(proposed, maple, { type: "propose", id: "shared-2", plan: { ...plan, slots: 5 } });
    const firstWins = updateNetwork(competing, cedar, { type: "confirm", id: "shared-1" });
    expect(() => updateNetwork(firstWins, cedar, { type: "confirm", id: "shared-2" })).toThrow(/uncommitted slots/);
  });

  it("keeps confirmed slots after disconnect and restores both estimates when slots are cancelled", () => {
    const disconnected = updateNetwork(confirmed, maple, { type: "disconnect", partnerId: cedar });
    expect(familyRange(disconnected)).toEqual(familyRange(confirmed));
    const cancelled = updateNetwork(disconnected, cedar, { type: "cancel", id: "shared-1" });
    expect(reservedSlots(cancelled, cedar, 1)).toBe(0);
    expect(familyRange(cancelled)).toEqual(familyRange(initial));
    expect(newReferralEstimate(cancelled, cedar)).toEqual(newReferralEstimate(initial, cedar));
  });

  it("uses each shared slot for at most one eligible referral per simulation", () => {
    expect(travelToSite("demo-001", "cedar-site")).toMatchObject({ minutes: 24, eligible: true });
    expect(travelToSite("demo-002", "cedar-site")).toMatchObject({ minutes: 47, eligible: false });
    const estimate = (eligible: boolean[]) => simulateRange(3, 0, "shared", {
      week: (week) => ({ reserved: 0, shared: week <= 3 ? [{ slots: 1, eligible }] : [] }),
    });
    expect(estimate([true, true, false])).toBeNull();
    expect(estimate([true, true, true])).toBeNull();
    const usable = simulateRange(3, 0, "shared", {
      week: () => ({ reserved: 0, shared: [{ slots: 1, eligible: [true, false, true] }] }),
    });
    // A non-traveling person ahead can be passed for a shared site, and the
    // target can only be served after the earlier eligible person uses a slot.
    expect(usable!.lower).toBeGreaterThanOrEqual(2);
  });

  it("shows the confirmed site for the booked partner-site case", () => {
    const response = getFamilyReferral("cedar-002", initial);
    expect(response?.referral.appointment_site?.name).toBe("Maple Grove assessment site");
    expect(response?.estimate.range_weeks).toBeNull();
  });
});
