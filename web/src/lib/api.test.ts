import { describe, expect, it } from "vitest";
import available from "../../../data/demo/estimate-available.json";
import unavailable from "../../../data/demo/estimate-unavailable.json";
import { DEFAULT_SLOTS, getFamilyReferral, listQueue } from "./api";
import type { DemoState } from "./types";

const base: DemoState = { slotsPerWeek: DEFAULT_SLOTS, intakeCompleted: [] };

// The family view must stay compatible with the contract fixtures.
function core(r: ReturnType<typeof getFamilyReferral>) {
  if (!r) throw new Error("missing referral");
  const { reason: _reason, ...estimate } = r.estimate;
  return { referral: r.referral, estimate, clinic: { contact: r.clinic.contact } };
}

describe("family referral response", () => {
  it("matches the available fixture at baseline capacity", () => {
    expect(core(getFamilyReferral("demo-001", base))).toEqual(available);
  });

  it("matches the unavailable fixture at baseline capacity", () => {
    expect(core(getFamilyReferral("demo-002", base))).toEqual(unavailable);
  });

  it("gives demo-002 a range once staff mark intake complete", () => {
    const r = getFamilyReferral("demo-002", { ...base, intakeCompleted: ["demo-002"] });
    expect(r?.estimate.status).toBe("available");
  });

  it("shortens the wait when weekly capacity goes up", () => {
    const more = getFamilyReferral("demo-001", { ...base, slotsPerWeek: DEFAULT_SLOTS + 2 });
    const r = more?.estimate.range_weeks;
    expect(r && r.upper).toBeLessThan(10);
  });

  it("keeps status and contact when the wait is too long to estimate", () => {
    const r = getFamilyReferral("demo-001", { ...base, slotsPerWeek: 1 });
    expect(r?.referral.status).toBe("waiting_for_assessment");
    expect(r?.clinic.contact).toBe("waitlist@example.org");
  });

  it("never shows a range for booked or held referrals", () => {
    for (const row of listQueue(base)) {
      if (row.status !== "waiting_for_assessment") expect(row.estimate.range_weeks).toBeNull();
    }
  });
});
