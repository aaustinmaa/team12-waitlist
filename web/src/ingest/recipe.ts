// A mapping recipe says how one clinic's export turns into referral records.
//
// The AI (or the rule-based fallback) only proposes the recipe; staff check
// it; then this plain code applies it to every row, the same way every time.
// A saved recipe is reused for every later export from that clinic, so the AI
// is not called again unless the export's columns change.

import { PRIORITIES, RECORD_FIELDS, type CloseReason, type Priority, type RecordField, type ReferralRecord } from "../engine/types";
import { readDate, type DateFormat } from "./dates";
import type { Table } from "./parse";

export const EVENT_KINDS = ["received", "intake_complete", "hold_start", "hold_end", "booked", "missed", "assessed", "withdrawn", "ignore"] as const;
export type EventKind = (typeof EVENT_KINDS)[number];

/** Fields that describe the referral itself; in an event log they repeat on every row. */
export const IDENTITY_FIELDS: RecordField[] = ["referral_id", "service", "priority", "age_group", "referral_source", "family_email", "family_phone"];

export interface Recipe {
  shape: "per_referral" | "per_event";
  date_format: DateFormat;
  /** canonical field -> source column. In an event log only the identity fields are used. */
  columns: Partial<Record<RecordField, string>>;
  event?: {
    kind_column: string;
    date_column: string;
    /** for booking events: the appointment date, when it is in its own column */
    appointment_column?: string;
    /** hold or withdrawal reason */
    note_column?: string;
    kinds: Record<string, EventKind>;
  };
  /** source value -> priority */
  priority_values: Record<string, Priority>;
  /** source value of the close/discharge reason column -> outcome */
  close_values: Record<string, CloseReason>;
  /** columns deliberately left out (not needed, or identifying) */
  ignored_columns: string[];
  /** 0–1 per canonical field (and "shape", "date_format") */
  confidence: Record<string, number>;
  /** things the proposer was not sure about, for staff to check */
  questions: string[];
  proposed_by: "rules" | "gemini" | "staff";
  /** the export's header when the recipe was made, to notice when it changes */
  header: string[];
}

export interface RowIssue {
  level: "error" | "warning";
  /** 1-based data row (header is row 0), when the issue is about one row */
  row?: number;
  referral_id?: string;
  message: string;
}

const empty = (): ReferralRecord => ({
  referral_id: "",
  service: "",
  priority: "standard",
  received_on: "",
  intake_completed_on: null,
  hold_start: null,
  hold_end: null,
  hold_reason: null,
  booked_for: null,
  booked_time: null,
  clinician: null,
  closed_on: null,
  close_reason: null,
  withdrawn_reason: null,
  age_group: null,
  referral_source: null,
  family_email: null,
  family_phone: null,
});

const DATE_FIELDS = new Set<RecordField>(["received_on", "intake_completed_on", "hold_start", "hold_end", "booked_for", "closed_on"]);

function readPriority(v: string, map: Record<string, Priority>, issues: RowIssue[], ctx: { row?: number; id: string }): Priority {
  if (!v) return "standard";
  const p = map[v] ?? map[v.trim()] ?? (PRIORITIES as readonly string[]).find((x) => x === v.toLowerCase());
  if (p) return p as Priority;
  issues.push({ level: "warning", row: ctx.row, referral_id: ctx.id, message: `Priority "${v}" is not in the recipe; treated as standard.` });
  return "standard";
}

export function applyRecipe(table: Table, recipe: Recipe): { records: ReferralRecord[]; issues: RowIssue[] } {
  const col = (name: string | undefined) => (name ? table.header.indexOf(name) : -1);
  const issues: RowIssue[] = [];
  const missing = Object.entries(recipe.columns).filter(([, c]) => c && col(c) === -1);
  for (const [field, c] of missing) issues.push({ level: "error", message: `Column "${c}" (for ${field}) is not in this file.` });
  if (missing.length) return { records: [], issues };
  return recipe.shape === "per_event" ? applyEvents(table, recipe, col, issues) : applyRows(table, recipe, col, issues);
}

function applyRows(table: Table, recipe: Recipe, col: (n?: string) => number, issues: RowIssue[]) {
  const records: ReferralRecord[] = [];
  table.rows.forEach((cells, i) => {
    const row = i + 1;
    const rec = empty();
    const get = (f: RecordField) => {
      const c = col(recipe.columns[f]);
      return c === -1 ? "" : (cells[c] ?? "").trim();
    };
    rec.referral_id = get("referral_id");
    let bad = false;
    for (const f of RECORD_FIELDS) {
      if (f === "referral_id" || f === "priority" || f === "close_reason") continue;
      const v = get(f);
      if (!v) continue;
      if (DATE_FIELDS.has(f)) {
        const d = readDate(v, recipe.date_format);
        if (!d) {
          issues.push({ level: "error", row, referral_id: rec.referral_id, message: `${f}: "${v}" is not a ${recipe.date_format} date.` });
          bad = true;
        }
        (rec as unknown as Record<string, unknown>)[f] = d;
      } else (rec as unknown as Record<string, unknown>)[f] = v;
    }
    rec.priority = readPriority(get("priority"), recipe.priority_values, issues, { row, id: rec.referral_id });
    const close = get("close_reason");
    if (close) {
      const outcome = recipe.close_values[close];
      if (outcome) {
        rec.close_reason = outcome;
        if (outcome === "withdrawn") rec.withdrawn_reason = rec.withdrawn_reason ?? close;
      } else issues.push({ level: "warning", row, referral_id: rec.referral_id, message: `Close reason "${close}" is not in the recipe; not counted as an assessment.` });
    } else if (rec.closed_on && !recipe.columns.close_reason) rec.close_reason = "assessed";
    if (!bad) records.push(rec);
  });
  return { records, issues };
}

function applyEvents(table: Table, recipe: Recipe, col: (n?: string) => number, issues: RowIssue[]) {
  const ev = recipe.event!;
  const kindCol = col(ev.kind_column);
  const dateCol = col(ev.date_column);
  const apptCol = col(ev.appointment_column);
  const noteCol = col(ev.note_column);
  const idCol = col(recipe.columns.referral_id);
  if (kindCol === -1 || dateCol === -1 || idCol === -1) {
    issues.push({ level: "error", message: "The event columns in the recipe are not all in this file." });
    return { records: [], issues };
  }
  type Ev = { row: number; kind: EventKind; date: string; appt: string | null; note: string };
  const byId = new Map<string, { cells: string[]; row: number; events: Ev[] }>();
  table.rows.forEach((cells, i) => {
    const row = i + 1;
    const id = (cells[idCol] ?? "").trim();
    const raw = (cells[kindCol] ?? "").trim();
    const kind = ev.kinds[raw];
    if (!kind) {
      issues.push({ level: "warning", row, referral_id: id, message: `Event type "${raw}" is not in the recipe; row skipped.` });
      return;
    }
    if (kind === "ignore") return;
    const date = readDate(cells[dateCol] ?? "", recipe.date_format);
    if (!date) {
      issues.push({ level: "error", row, referral_id: id, message: `Event date "${cells[dateCol]}" is not a ${recipe.date_format} date.` });
      return;
    }
    const appt = apptCol === -1 ? null : readDate(cells[apptCol] ?? "", recipe.date_format);
    const entry = byId.get(id) ?? { cells, row, events: [] };
    entry.events.push({ row, kind, date, appt, note: noteCol === -1 ? "" : (cells[noteCol] ?? "").trim() });
    byId.set(id, entry);
  });

  const records: ReferralRecord[] = [];
  for (const [id, { cells, row, events }] of byId) {
    const rec = empty();
    rec.referral_id = id;
    for (const f of IDENTITY_FIELDS) {
      if (f === "referral_id" || f === "priority") continue;
      const c = col(recipe.columns[f]);
      if (c !== -1 && cells[c]) (rec as unknown as Record<string, unknown>)[f] = cells[c].trim();
    }
    const pc = col(recipe.columns.priority);
    rec.priority = readPriority(pc === -1 ? "" : cells[pc] ?? "", recipe.priority_values, issues, { row, id });
    // Same-day events keep file order; otherwise oldest first.
    events.sort((a, b) => a.date.localeCompare(b.date) || a.row - b.row);
    for (const e of events) {
      switch (e.kind) {
        case "received":
          rec.received_on = e.date;
          break;
        case "intake_complete":
          rec.intake_completed_on = e.date;
          break;
        case "hold_start":
          rec.hold_start = e.date;
          rec.hold_end = null;
          rec.hold_reason = e.note || null;
          break;
        case "hold_end":
          rec.hold_end = e.date;
          break;
        case "booked":
          rec.booked_for = e.appt ?? e.date;
          break;
        case "missed":
          rec.booked_for = null;
          break;
        case "assessed":
          rec.closed_on = e.date;
          rec.close_reason = "assessed";
          rec.booked_for = null;
          break;
        case "withdrawn":
          rec.closed_on = e.date;
          rec.close_reason = "withdrawn";
          rec.withdrawn_reason = e.note || null;
          rec.booked_for = null;
          break;
      }
    }
    if (!rec.received_on) {
      issues.push({ level: "error", row, referral_id: id, message: "No referral-received event." });
      continue;
    }
    records.push(rec);
  }
  return { records, issues };
}
