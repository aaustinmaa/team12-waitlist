// Tests for the changes that came out of the Week 8 peer evaluation:
// priority in the estimate, updates to families, and add-to-calendar.

import { describe, expect, it } from "vitest";
import { DEFAULT_SLOTS, INTAKE_TIMING, getFamilyReferral, listQueue, newReferralEstimate } from "./api";
import { eventTimes, googleCalendarUrl, toIcs, zonedToUtc, type CalEvent } from "./calendar";
import { simulateRange } from "./estimator";
import { DEFAULT_PREFS, diffNotices, told, toldByAll } from "./notifications";
import type { QueueState } from "./types";

const base: QueueState = { slotsPerWeek: DEFAULT_SLOTS, intakeCompleted: [] };
const now = new Date("2026-11-16T15:00:00Z");

describe("priority", () => {
  it("puts higher priorities first in line, then the oldest referral", () => {
    const line = listQueue(base)
      .filter((r) => r.position !== null)
      .sort((a, b) => a.position! - b.position!);
    const order = ["urgent", "high", "standard"];
    for (let i = 1; i < line.length; i++) {
      const a = line[i - 1];
      const b = line[i];
      expect(order.indexOf(a.priority)).toBeLessThanOrEqual(order.indexOf(b.priority));
      if (a.priority === b.priority) expect(a.received_on <= b.received_on).toBe(true);
    }
    expect(line[0].priority).toBe("urgent");
  });

  it("moves a referral up and shortens its estimate when staff raise its priority", () => {
    const before = listQueue(base).find((r) => r.id === "demo-001")!;
    const after = listQueue({ ...base, priority: { "demo-001": "urgent" } }).find((r) => r.id === "demo-001")!;
    expect(after.position!).toBeLessThan(before.position!);
    expect(after.estimate.range_weeks!.upper).toBeLessThan(before.estimate.range_weeks!.upper);
  });

  it("pushes standard referrals back when someone else is placed ahead of them", () => {
    const before = listQueue(base).find((r) => r.id === "demo-001")!;
    const after = listQueue({ ...base, priority: { "r-0135": "urgent" } }).find((r) => r.id === "demo-001")!;
    expect(after.position).toBe(before.position! + 1);
  });

  it("lets fewer future referrals pass a higher priority at the same place in line", () => {
    const standard = simulateRange(20, DEFAULT_SLOTS, "same-seed", "standard")!;
    const urgent = simulateRange(20, DEFAULT_SLOTS, "same-seed", "urgent")!;
    expect(urgent.upper).toBeLessThanOrEqual(standard.upper);
    expect(urgent.lower).toBeLessThanOrEqual(standard.lower);
  });

  it("tells a new referral a shorter wait the higher its priority", () => {
    const r = newReferralEstimate(base);
    expect(r.urgent!.upper).toBeLessThan(r.high!.upper);
    expect(r.high!.upper).toBeLessThan(r.standard!.upper);
  });
});

describe("updates to families", () => {
  const start = toldByAll(listQueue(base));

  it("sends nothing when nothing changed", () => {
    expect(diffNotices(start, listQueue(base), {}, now).notices).toEqual([]);
  });

  it("tells a family when their estimate becomes available", () => {
    const rows = listQueue({ ...base, intakeCompleted: ["demo-002"] });
    const d = diffNotices(start, rows, {}, now);
    const mine = d.notices.filter((n) => n.referral_id === "demo-002");
    expect(mine).toHaveLength(1);
    expect(mine[0].kind).toBe("estimate_ready");
    expect(mine[0].range).toEqual(rows.find((r) => r.id === "demo-002")!.estimate.range_weeks);
    expect(mine[0].channels).toEqual(["email"]);
    // Sending again from the updated record must not repeat it.
    expect(diffNotices(d.told, rows, {}, now).notices).toEqual([]);
  });

  it("uses the channels the family switched on", () => {
    const rows = listQueue({ ...base, intakeCompleted: ["demo-002"] });
    const prefs = { "demo-002": { ...DEFAULT_PREFS, email: false, sms: true, browser: true } };
    const n = diffNotices(start, rows, prefs, now).notices.find((x) => x.referral_id === "demo-002")!;
    expect(n.channels).toEqual(["sms", "browser"]);
  });

  it("only announces a changed range when it moved two weeks or more", () => {
    const rows = listQueue({ ...base, slotsPerWeek: DEFAULT_SLOTS + 2 });
    const d = diffNotices(start, rows, {}, now);
    for (const n of d.notices) {
      expect(n.kind).toBe("estimate_changed");
      const moved = Math.max(Math.abs(n.range!.lower - n.previous!.lower), Math.abs(n.range!.upper - n.previous!.upper));
      expect(moved).toBeGreaterThanOrEqual(2);
    }
    expect(d.notices.length).toBeGreaterThan(0);
    // A family that wasn't told keeps its old record, so later shifts add up.
    const quiet = rows.find((r) => r.estimate.range_weeks && told(r.estimate) !== start[r.id] && !d.notices.some((n) => n.referral_id === r.id));
    if (quiet) expect(d.told[quiet.id]).toBe(start[quiet.id]);
  });

  it("tells families when their estimate can no longer be shown", () => {
    const d = diffNotices(start, listQueue({ ...base, slotsPerWeek: 1 }), {}, now);
    const n = d.notices.find((x) => x.referral_id === "demo-001")!;
    expect(n.kind).toBe("estimate_paused");
    expect(n.reason).toBe("beyond_horizon");
  });

  it("never sends estimate updates for booked referrals", () => {
    const d = diffNotices(start, listQueue({ ...base, slotsPerWeek: 9 }), {}, now);
    expect(d.notices.some((n) => n.referral_id === "demo-003")).toBe(false);
  });
});

describe("family response additions", () => {
  it("gives a booked referral its time, place and clinician", () => {
    const a = getFamilyReferral("demo-003", base)!.appointment!;
    expect(a.on).toBe("2026-11-26");
    expect(a.start_time).toBe("10:30");
    expect(a.clinician?.name).toBe("Amara Okafor");
    expect(a.location.address).toContain("Waterloo");
    expect(getFamilyReferral("demo-001", base)!.appointment).toBeUndefined();
  });

  it("says how long an estimate usually takes to appear, from the clinic's history", () => {
    expect(INTAKE_TIMING.typical_days).toBeGreaterThan(0);
    expect(INTAKE_TIMING.most_within_days).toBeGreaterThan(INTAKE_TIMING.typical_days);
    expect(getFamilyReferral("demo-002", base)!.intake!.days_since_received).toBe(7);
  });

  it("only ever shows masked, fictional contact details", () => {
    for (const r of listQueue(base)) {
      const c = getFamilyReferral(r.id, base)!.contact_on_file!;
      expect(c.email).toMatch(/^[a-z]•+@example\.com$/);
      expect(c.phone).toMatch(/^•••-•••-01\d\d$/);
    }
  });
});

describe("add to calendar", () => {
  const ev: CalEvent = {
    uid: "demo-003@team12-waitlist",
    title: "First speech-language assessment",
    description: "With Amara Okafor; bring your health card.\nReferral ID: demo-003",
    location: "Maple Grove Children's Centre, 120 Maple Grove Road, Unit 3, Waterloo, ON",
    date: "2026-11-26",
    start: "10:30",
    durationMinutes: 60,
    timeZone: "America/Toronto",
    reminderMinutes: 1440,
  };

  it("converts clinic time to UTC in winter and in summer", () => {
    expect(zonedToUtc("2026-11-26", "10:30", "America/Toronto").toISOString()).toBe("2026-11-26T15:30:00.000Z");
    expect(zonedToUtc("2026-07-14", "09:00", "America/Toronto").toISOString()).toBe("2026-07-14T13:00:00.000Z");
  });

  it("writes a valid event with escaped text and folded lines", () => {
    const ics = toIcs(ev, now);
    expect(ics).toContain("DTSTART:20261126T153000Z\r\n");
    expect(ics).toContain("DTEND:20261126T163000Z\r\n");
    expect(ics).toContain("DTSTAMP:20261116T150000Z\r\n");
    const unfolded = ics.replace(/\r\n /g, "");
    expect(unfolded).toContain("DESCRIPTION:With Amara Okafor\\; bring your health card.\\nReferral ID: demo-003");
    expect(ics).toContain("TRIGGER:-PT1440M");
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    for (const line of ics.split("\r\n")) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    // Unfolding gives back the long location line.
    expect(unfolded).toContain("LOCATION:Maple Grove Children's Centre\\, 120 Maple Grove Road\\, Unit 3\\, Waterloo\\, ON");
  });

  it("builds a Google Calendar link for the same hour", () => {
    const url = new URL(googleCalendarUrl(ev));
    expect(url.searchParams.get("dates")).toBe("20261126T153000Z/20261126T163000Z");
    expect(url.searchParams.get("text")).toBe(ev.title);
    expect(eventTimes(ev).end.getTime() - eventTimes(ev).start.getTime()).toBe(3_600_000);
  });
});
