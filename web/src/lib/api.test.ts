import { describe, expect, it } from "vitest";
import available from "../../../data/demo/estimate-available.json";
import unavailable from "../../../data/demo/estimate-unavailable.json";
import { DEFAULT_SLOTS, getFamilyReferral, listQueue } from "./api";
import { holdDays } from "./dates";
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

describe("time on hold", () => {
  it("counts a hold from its start day up to, not including, its end day", () => {
    expect(holdDays({ start: "2026-09-08", end: "2026-09-29" }, "2026-11-05")).toBe(21);
  });

  it("runs an open hold up to the snapshot date", () => {
    expect(holdDays({ start: "2026-10-20", end: null }, "2026-11-05")).toBe(16);
  });

  it("counts nothing for no hold or a hold that hasn't started", () => {
    expect(holdDays(null, "2026-11-05")).toBe(0);
    expect(holdDays({ start: "2026-12-01", end: null }, "2026-11-05")).toBe(0);
  });

  it("keeps time on hold inside the calendar wait", () => {
    const rows = listQueue(base);
    expect(rows.some((r) => r.days_on_hold > 0)).toBe(true);
    for (const r of rows) {
      expect(r.days_on_hold).toBeGreaterThanOrEqual(0);
      expect(r.days_on_hold).toBeLessThanOrEqual(r.days_waiting);
      expect(r.days_on_hold > 0).toBe(!!r.hold);
    }
  });

  it("gives the family their hold and its length, and nothing when there is none", () => {
    for (const r of listQueue(base)) {
      const fam = getFamilyReferral(r.id, base)!;
      expect(fam.referral.days_on_hold).toBe(r.hold ? r.days_on_hold : undefined);
      expect(fam.referral.hold).toEqual(r.hold ?? undefined);
    }
  });
});
