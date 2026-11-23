// End to end on the three sample exports: rules-based recipe -> records ->
// validation -> engine. Each clinic's file is in a different format.

import { describe, expect, it } from "vitest";
import mapleNov20 from "../../../data/samples/maple-grove/clinicflow-export-2026-11-20.csv?raw";
import lakeshore from "../../../data/samples/lakeshore/theratrack-events-2026-11-20.csv?raw";
import riviere from "../../../data/samples/riviere-est/dossierplus-2026-11-20.csv?raw";
import { buildModel, estimateAll } from "../engine/model";
import { parseDelimited } from "./parse";
import { profileTable } from "./profile";
import { applyRecipe } from "./recipe";
import { proposeByRules } from "./rules";
import { fromAnswer } from "./gemini";
import { validateRecords } from "./validate";

const FILES: Record<string, string> = {
  "maple-grove/clinicflow-export-2026-11-20.csv": mapleNov20,
  "lakeshore/theratrack-events-2026-11-20.csv": lakeshore,
  "riviere-est/dossierplus-2026-11-20.csv": riviere,
};
const load = (p: string) => parseDelimited(FILES[p]);

function run(file: string) {
  const table = load(file);
  const profile = profileTable(table);
  const recipe = proposeByRules(profile);
  const { records, issues } = applyRecipe(table, recipe);
  const v = validateRecords(records, { today: "2026-11-22" });
  return { table, profile, recipe, records: v.records, issues: [...issues, ...v.issues], asOf: v.asOf };
}

describe("rule-based mapping of the three sample formats", () => {
  it("maps Maple Grove's per-referral English export", () => {
    const r = run("maple-grove/clinicflow-export-2026-11-20.csv");
    expect(r.recipe.shape).toBe("per_referral");
    expect(r.recipe.date_format).toBe("YYYY-MM-DD");
    expect(r.recipe.columns).toMatchObject({
      referral_id: "Referral ID",
      priority: "Priority Level",
      received_on: "Date Referral Received",
      intake_completed_on: "Intake Complete Date",
      booked_for: "Appointment Date",
      closed_on: "Discharge Date",
      close_reason: "Discharge Reason",
      family_email: "Guardian Email",
    });
    expect(r.issues.filter((i) => i.level === "error")).toEqual([]);
    expect(r.asOf).toBe("2026-11-20");
    expect(r.records.filter((x) => x.close_reason === "assessed").length).toBeGreaterThan(400);
  });

  it("maps Lakeshore's event log with day-first dates", () => {
    const r = run("lakeshore/theratrack-events-2026-11-20.csv");
    expect(r.recipe.shape).toBe("per_event");
    expect(r.recipe.date_format).toBe("DD/MM/YYYY");
    expect(r.recipe.event).toMatchObject({ kind_column: "evt_cd", date_column: "evt_dt", appointment_column: "appt_dt" });
    expect(r.recipe.event!.kinds).toMatchObject({ REF: "received", INT: "intake_complete", BKD: "booked", DNA: "missed", ATT: "assessed", WDR: "withdrawn", "HLD+": "hold_start", "HLD-": "hold_end" });
    expect(r.recipe.priority_values).toMatchObject({ P1: "urgent", P2: "high", P3: "standard" });
    expect(r.issues.filter((i) => i.level === "error")).toEqual([]);
    expect(r.records.length).toBeGreaterThan(200);
  });

  it("maps Rivière-Est's French, semicolon, YYYYMMDD export", () => {
    const r = run("riviere-est/dossierplus-2026-11-20.csv");
    expect(r.table.delimiter).toBe(";");
    expect(r.recipe.date_format).toBe("YYYYMMDD");
    expect(r.recipe.columns).toMatchObject({ referral_id: "No_dossier", priority: "Priorite", received_on: "Date_reception", intake_completed_on: "Date_fin_accueil", closed_on: "Date_fermeture", close_reason: "Motif_fermeture" });
    expect(r.recipe.priority_values).toMatchObject({ Urgente: "urgent", "Élevée": "high", Normale: "standard" });
    expect(Object.values(r.recipe.close_values)).toContain("withdrawn");
    expect(r.issues.filter((i) => i.level === "error")).toEqual([]);
  });

  it("keeps identifying values out of the profile sent to the AI", () => {
    const { profile } = run("maple-grove/clinicflow-export-2026-11-20.csv");
    const text = JSON.stringify(profile);
    expect(text).not.toMatch(/@example\.com/);
    expect(text).not.toMatch(/555-01/);
  });

  it("accepts an AI answer, drops columns that don't exist and fills gaps from the rules", () => {
    const { profile } = run("maple-grove/clinicflow-export-2026-11-20.csv");
    const recipe = fromAnswer(
      {
        shape: "per_referral",
        date_format: "YYYY-MM-DD",
        columns: [
          { field: "referral_id", source: "Referral ID", confidence: 0.99 },
          { field: "received_on", source: "Date Referral Received", confidence: 0.95 },
          { field: "clinician", source: "Not A Column", confidence: 0.9 },
        ],
        priority_values: [{ from: "Routine", to: "standard" }],
        close_values: [],
        questions: [],
      },
      profile,
    );
    expect(recipe.columns.clinician).toBe("Clinician");
    expect(recipe.columns.closed_on).toBe("Discharge Date");
    expect(recipe.questions.some((q) => q.includes("closed_on"))).toBe(true);
  });
});

describe("engine on sample clinics", () => {
  const clinics = {
    "maple-grove": run("maple-grove/clinicflow-export-2026-11-20.csv"),
    lakeshore: run("lakeshore/theratrack-events-2026-11-20.csv"),
    "riviere-est": run("riviere-est/dossierplus-2026-11-20.csv"),
  };

  it("fits each clinic from its own history and back-tests the ranges", () => {
    for (const [name, c] of Object.entries(clinics)) {
      const t0 = performance.now();
      const m = buildModel(c.records, c.asOf);
      const est = estimateAll(c.records, m);
      const ready = [...est.values()].filter((e) => e.status === "ready");
      const ms = Math.round(performance.now() - t0);
      console.log(
        `${name}: ${m.params.meanThroughput.toFixed(1)}/wk, ahead(std) ${m.params.aheadRate.standard.toFixed(2)}/wk, withdraw ${(m.params.withdrawWeekly * 100).toFixed(2)}%/wk, ` +
          `speed=${m.backtest.calibration.speed} k=${m.backtest.calibration.k}, join ${(m.params.joinWeekly*100).toFixed(0)}%/wk, coverage raw ${pct(m.backtest.coverageRaw)} → ${pct(m.backtest.coverage)} (n=${m.backtest.resolved}), ` +
          `KM p50 ${m.survival.all.p50}w, ready ${ready.length}, family-visible ${m.gate.familyVisible}, ${ms} ms`,
      );
      expect(m.backtest.resolved).toBeGreaterThan(20);
      // Lakeshore is small: the gate may keep its ranges from families, which is the point of the gate.
      if (m.gate.familyVisible) expect(m.backtest.coverage!).toBeGreaterThanOrEqual(0.8);
      expect(ready.length).toBeGreaterThan(5);
      // Ranges grow with place in line.
      const byPos = ready.filter((e) => e.range).sort((a, b) => a.position! - b.position!);
      expect(byPos[byPos.length - 1].range!.upper).toBeGreaterThanOrEqual(byPos[0].range!.upper);
    }
  });

  it("gives different clinics different speeds", () => {
    const a = buildModel(clinics["maple-grove"].records, clinics["maple-grove"].asOf);
    const b = buildModel(clinics.lakeshore.records, clinics.lakeshore.asOf);
    expect(a.params.meanThroughput).toBeGreaterThan(b.params.meanThroughput * 2);
  });
});

const pct = (x: number | null) => (x === null ? "–" : `${Math.round(x * 100)}%`);
