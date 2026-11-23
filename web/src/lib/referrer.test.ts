// The referrer comparison on the three sample clinics.

import { describe, expect, it } from "vitest";
import { directoryViews } from "../platform/directory";
import { directoryEntry, sortByWait, speaks, type DirectoryEntry } from "./referrer";
import type { Priority } from "./types";

const views = directoryViews(() => null);
const entries = (p: Priority) => views.map(({ setup, view }) => directoryEntry(view, setup.referrer, p));
const byId = (list: DirectoryEntry[], id: string) => list.find((e) => e.clinicId === id)!;

describe("referrer comparison", () => {
  it("covers every clinic that takes part, from its latest export", () => {
    expect(views.map((v) => v.setup.id).sort()).toEqual(["lakeshore", "maple-grove", "riviere-est"]);
    expect(byId(entries("standard"), "maple-grove").asOf).toBe("2026-11-20");
  });

  it("gives a range where the clinic's history checks out, and says so plainly where it doesn't", () => {
    const list = entries("standard");
    expect(byId(list, "maple-grove").wait.kind).toBe("range");
    expect(byId(list, "riviere-est").wait.kind).toBe("range");
    const lake = byId(list, "lakeshore");
    expect(lake.wait.kind).toBe("not_enough_history");
    expect(lake.coverage).toBeNull();
  });

  it("an urgent referral waits no longer than a standard one", () => {
    for (const id of ["maple-grove", "riviere-est"]) {
      const s = byId(entries("standard"), id).wait;
      const u = byId(entries("urgent"), id).wait;
      if (s.kind !== "range" || u.kind !== "range") throw new Error("expected ranges");
      expect(u.upper).toBeLessThanOrEqual(s.upper);
    }
  });

  it("lists the shortest expected wait first and clinics without an estimate last", () => {
    const sorted = sortByWait(entries("standard"));
    expect(sorted[sorted.length - 1].clinicId).toBe("lakeshore");
    const [a, b] = sorted;
    if (a.wait.kind !== "range" || b.wait.kind !== "range") throw new Error("expected ranges");
    expect(a.wait.lower + a.wait.upper).toBeLessThanOrEqual(b.wait.lower + b.wait.upper);
  });

  it("filters by the family's language", () => {
    expect(speaks(entries("standard"), "fr").map((e) => e.clinicId).sort()).toEqual(["maple-grove", "riviere-est"]);
    expect(speaks(entries("standard"), "any")).toHaveLength(3);
  });

  it("shares only clinic-wide totals", () => {
    const e = byId(entries("standard"), "maple-grove");
    expect(e.waitingNow).toBeGreaterThan(0);
    expect(e.perWeek).toBeGreaterThan(0);
    const shared = JSON.stringify(e);
    const records = views.find((v) => v.setup.id === "maple-grove")!.view.records;
    for (const r of records) {
      expect(shared).not.toContain(r.referral_id);
      if (r.family_email) expect(shared).not.toContain(r.family_email);
      if (r.family_phone) expect(shared).not.toContain(r.family_phone);
    }
  });
});
