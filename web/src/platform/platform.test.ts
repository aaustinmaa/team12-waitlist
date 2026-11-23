// The apps' data layer on the sample clinics: what staff and families see.

import { describe, expect, it } from "vitest";
import mapleNov13 from "../../../data/samples/maple-grove/clinicflow-export-2026-11-13.csv?raw";
import mapleNov20 from "../../../data/samples/maple-grove/clinicflow-export-2026-11-20.csv?raw";
import { analyse, convert } from "../ingest/importer";
import { proposeByRules } from "../ingest/rules";
import { getFamilyReferral, listQueue, referralsForContact } from "../lib/api";
import { diffNotices, toldByAll } from "../lib/notifications";
import type { DemoState } from "../lib/types";
import { makeView, type ClinicData } from "./store";

const ops = (o: Partial<DemoState> = {}): DemoState => ({ extraSlots: 0, intakeCompleted: [], priority: {}, notifyPrefs: {}, notices: [], told: {}, toursSeen: [], contacts: {}, priorityLog: [], ...o });

function importFile(name: string, text: string, previous?: ClinicData) {
  const a = analyse(name, text);
  const conv = convert(a, proposeByRules(a.profile), { today: "2026-11-22", previous: previous?.records });
  const data: ClinicData = { records: conv.records, asOf: conv.validation.asOf, importedAt: name, fileName: name, via: "upload" };
  return { data, conv };
}

const nov13 = importFile("nov13.csv", mapleNov13).data;
const base = makeView("maple-grove", nov13, ops());

describe("staff waitlist", () => {
  it("lists only open referrals, with ready ones numbered in order", () => {
    const rows = listQueue(base);
    expect(rows.every((r) => r.days_waiting >= 0)).toBe(true);
    const positions = rows.filter((r) => r.position !== null).map((r) => r.position!).sort((a, b) => a - b);
    expect(positions[0]).toBe(1);
    expect(positions[positions.length - 1]).toBe(positions.length);
  });

  it("a capacity scenario shortens the ranges, and families get told", () => {
    const told = toldByAll(listQueue(base));
    const more = makeView("maple-grove", nov13, ops({ extraSlots: 3 }));
    const pick = (v: typeof base) => listQueue(v).filter((r) => r.estimate.range_weeks).sort((a, b) => b.position! - a.position!)[0];
    expect(pick(more).estimate.range_weeks!.upper).toBeLessThan(pick(base).estimate.range_weeks!.upper);
    const d = diffNotices(told, listQueue(more), {}, new Date("2026-11-22T12:00:00Z"));
    expect(d.notices.some((n) => n.kind === "estimate_changed")).toBe(true);
  });

  it("raising a priority moves a referral ahead", () => {
    const row = listQueue(base).filter((r) => r.position !== null && r.priority === "standard").sort((a, b) => b.position! - a.position!)[0];
    const up = makeView("maple-grove", nov13, ops({ priority: { [row.id]: "urgent" } }));
    expect(listQueue(up).find((r) => r.id === row.id)!.position).toBeLessThan(row.position!);
  });

  it("marking intake done gives an estimate", () => {
    const pending = listQueue(base).find((r) => !r.intake_complete && r.status === "waiting_for_assessment")!;
    const done = makeView("maple-grove", nov13, ops({ intakeCompleted: [pending.id] }));
    expect(listQueue(done).find((r) => r.id === pending.id)!.position).not.toBeNull();
  });
});

describe("family access", () => {
  it("finds the demo family's two children by email or phone, and nobody else's", () => {
    const byEmail = referralsForContact(base, "Demo.Family@example.com").map((r) => r.referral_id);
    const byPhone = referralsForContact(base, "(519) 555-0100").map((r) => r.referral_id);
    expect(byEmail.length).toBe(2);
    expect(byPhone.sort()).toEqual(byEmail.sort());
    expect(referralsForContact(base, "nobody@example.com")).toEqual([]);
  });

  it("shows a range, the masked contact, and never another family's details", () => {
    const [id] = referralsForContact(base, "demo.family@example.com").map((r) => r.referral_id);
    const f = getFamilyReferral(base, id)!;
    expect(f.clinic.name).toBe("Maple Grove Children's Centre");
    expect(f.contact_on_file!.email).toBe("d•••••@example.com");
    expect(JSON.stringify(f)).not.toContain("demo.family@example.com");
  });

  it("after the Nov 20 sync, one of the demo children is booked and a vanished referral is kept for review", () => {
    const { data, conv } = importFile("nov20.csv", mapleNov20, nov13);
    expect(conv.validation.diff!.vanished.length).toBe(1);
    const v = makeView("maple-grove", data, ops());
    const kids = referralsForContact(v, "demo.family@example.com").map((r) => getFamilyReferral(v, r.referral_id)!);
    expect(kids.some((k) => k.referral.status === "assessment_booked")).toBe(true);
    expect(listQueue(v).filter((r) => r.needs_review).length).toBe(1);
  });
});
