import { describe, expect, it } from "vitest";
import { toCsv } from "./csv";
import {
  CASES,
  DEFAULT_QUARTER,
  QUARTERS,
  REPORT_AS_OF,
  estimatePoints,
  isOpenOn,
  monthlyFlow,
  quarterTable,
  summarize,
  summaryTable,
  waitWeeks,
  waitWeeksExcludingHolds,
  weeklyWaitlist,
} from "./reports";
import { listQueue, DEFAULT_SLOTS } from "./api";

describe("report data", () => {
  it("has no referral in both the history and the queue", () => {
    const ids = CASES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("closes every history referral before the snapshot, and after it was received", () => {
    for (const c of CASES) {
      if (c.closed_on === null) continue;
      expect(c.closed_on <= REPORT_AS_OF).toBe(true);
      expect(c.closed_on > c.received_on).toBe(true);
    }
  });

  it("ends the waitlist line on the same count the staff dashboard shows", () => {
    const last = weeklyWaitlist().at(-1)!;
    expect(last.date).toBe(REPORT_AS_OF);
    expect(last.waiting + last.onHold).toBe(listQueue({ slotsPerWeek: DEFAULT_SLOTS, intakeCompleted: [] }).length);
    expect(last.onHold).toBe(2);
  });

  it("defaults to the last complete quarter", () => {
    expect(DEFAULT_QUARTER.label).toBe("Jul–Sep 2026");
    expect(QUARTERS.at(-1)!.partial).toBe(true);
  });

  it("keeps quarter counts consistent with the monthly series", () => {
    const q = DEFAULT_QUARTER;
    const months = monthlyFlow().filter((m) => m.month >= q.start && m.month < q.end);
    const s = summarize(q);
    expect(months.reduce((n, m) => n + m.referrals, 0)).toBe(s.referrals);
    expect(months.reduce((n, m) => n + m.assessed, 0)).toBe(s.assessed);
    expect(s.waitlistEnd).toBe(CASES.filter((c) => isOpenOn(c, q.last)).length);
  });

  it("back-tests each first assessment once", () => {
    const s = summarize(DEFAULT_QUARTER);
    const pts = estimatePoints(DEFAULT_QUARTER);
    expect(pts.length).toBe(s.estimatesChecked);
    expect(s.estimatesInside + s.estimatesEarlier + s.estimatesLater).toBe(s.estimatesChecked);
  });

  it("never makes the wait excluding holds longer than the wait, and subtracts the hold exactly", () => {
    for (const c of CASES) {
      const total = waitWeeks(c);
      const ex = waitWeeksExcludingHolds(c);
      if (total === null) {
        expect(ex).toBeNull();
        continue;
      }
      expect(ex!).toBeGreaterThan(0);
      expect(ex!).toBeLessThanOrEqual(total);
      if (!c.hold) expect(ex).toBe(total);
    }
    const s = summarize(DEFAULT_QUARTER);
    expect(s.medianWaitExcludingHolds!).toBeLessThanOrEqual(s.medianWait!);
  });

  it("exports one summary row per quarter and the same columns on every row", () => {
    const t = summaryTable();
    expect(t.rows.length).toBe(QUARTERS.length);
    const q = quarterTable(DEFAULT_QUARTER);
    for (const r of q.rows) expect(r.length).toBe(q.header.length);
  });
});

describe("csv", () => {
  it("quotes commas and quotes, and neutralises formulas", () => {
    const csv = toCsv(["a", "b", "c"], [['Say "hi", then go', "=SUM(A1)", -3]]);
    expect(csv).toBe('a,b,c\r\n"Say ""hi"", then go",\'=SUM(A1),-3\r\n');
  });

  it("leaves empty cells blank", () => {
    expect(toCsv(["a", "b"], [[null, undefined]])).toBe("a,b\r\n,\r\n");
  });
});
