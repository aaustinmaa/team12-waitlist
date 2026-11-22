// The rule-based mapper: proposes a recipe from column names and values alone.
// Used when no AI key is set, and as a cross-check of the AI's proposal.

import type { Priority, RecordField } from "../engine/types";
import type { DateFormat } from "./dates";
import type { TableProfile } from "./profile";
import { IDENTITY_FIELDS, type EventKind, type Recipe } from "./recipe";

export const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9+-]+/g, " ")
    .trim();

/** Words a column name may use for each field, English and French. */
export const SYNONYMS: Record<RecordField, string[]> = {
  referral_id: ["referral id", "referral no", "referral number", "client ref", "client id", "no dossier", "dossier", "file number", "case id", "id"],
  service: ["program", "programme", "service", "svc cd", "discipline", "service line"],
  priority: ["priority", "priority level", "priorite", "prio cd", "urgency", "triage"],
  received_on: ["date referral received", "referral received", "received", "date received", "date reception", "referral date", "reception"],
  intake_completed_on: ["intake complete date", "intake complete", "intake completed", "intake date", "date fin accueil", "fin accueil", "accueil"],
  hold_start: ["hold start", "on hold from", "debut suspension", "suspension debut", "pause start"],
  hold_end: ["hold end", "on hold to", "fin suspension", "suspension fin", "pause end"],
  hold_reason: ["hold reason", "motif suspension", "pause reason"],
  booked_for: ["appointment date", "appt date", "appt dt", "date rdv", "rdv", "booked for", "scheduled date"],
  booked_time: ["appointment time", "appt time", "heure rdv", "heure"],
  clinician: ["clinician", "therapist", "provider", "intervenant", "slp"],
  closed_on: ["discharge date", "closed on", "close date", "date fermeture", "fermeture", "end date", "date fin"],
  close_reason: ["discharge reason", "close reason", "closure reason", "motif fermeture", "outcome", "reason closed"],
  withdrawn_reason: ["withdrawal reason", "motif retrait"],
  age_group: ["age band", "age group", "groupe age", "age grp", "age"],
  referral_source: ["referral source", "source", "src cd", "referred by", "referent"],
  family_email: ["guardian email", "parent email", "family email", "courriel parent", "courriel", "email", "cg email", "e-mail"],
  family_phone: ["guardian phone", "parent phone", "family phone", "tel parent", "telephone", "phone", "cg phone", "mobile"],
};

function score(header: string, field: RecordField) {
  const h = norm(header).replace(/[+-]/g, " ").replace(/\s+/g, " ");
  let best = 0;
  for (const syn of SYNONYMS[field]) {
    if (h === syn) best = Math.max(best, 1);
    else if (` ${h} `.includes(` ${syn} `)) best = Math.max(best, 0.6 + 0.3 * (syn.length / Math.max(h.length, 1)));
  }
  return best;
}

const PRIORITY_RULES: [RegExp, Priority][] = [
  [/urg|^p ?1$|^1$|stat|emerg/i, "urgent"],
  [/high|elev|^p ?2$|^2$|semi|soon/i, "high"],
  [/rout|norm|stand|^p ?3$|^3$|low|non urg/i, "standard"],
];

const EVENT_RULES: [RegExp, EventKind][] = [
  [/^ref|receiv|recu|reception|^new$/i, "received"],
  [/^int|intake|accueil/i, "intake_complete"],
  [/hld ?\+|hold ?(start|on|begin)|susp.*(deb|start)|^hold$/i, "hold_start"],
  [/hld ?-|hold ?(end|off|stop)|susp.*fin|resume/i, "hold_end"],
  [/^bkd|book|sched|rdv|appt/i, "booked"],
  [/^dna|no ?show|missed|absent|did not/i, "missed"],
  [/^att|attend|assess|seen|evalu|complet/i, "assessed"],
  [/^wdr|withdr|retrait|cancel|discharged? (by|at) (family|parent)/i, "withdrawn"],
];

export function guessCloseValue(v: string): "assessed" | "withdrawn" | null {
  const n = norm(v);
  if (/withdr|retrait|cancel|moved|demenag|declin|no longer|prive|private/.test(n)) return "withdrawn";
  if (/assess|evaluation|complet|seen|attended|done|termine/.test(n)) return "assessed";
  return null;
}

export function proposeByRules(p: TableProfile): Recipe {
  const columns: Partial<Record<RecordField, string>> = {};
  const confidence: Record<string, number> = {};
  const questions: string[] = [];
  const used = new Set<string>();

  // Event log: rows repeat per referral and one code column holds event types.
  const eventKindCol = p.columns.find((c) => c.kind === "code" && (c.values ?? []).filter((v) => EVENT_RULES.some(([re]) => re.test(v))).length >= 3);
  const isEvents = p.rowsPerId > 1.5 && !!eventKindCol;

  const candidates = (Object.keys(SYNONYMS) as RecordField[]).filter((f) => !isEvents || IDENTITY_FIELDS.includes(f));
  const pairs: { f: RecordField; col: string; s: number }[] = [];
  for (const f of candidates) for (const c of p.columns) if (c.kind !== "empty" || !isEvents) pairs.push({ f, col: c.name, s: score(c.name, f) });
  pairs.sort((a, b) => b.s - a.s);
  for (const { f, col, s } of pairs) {
    if (s < 0.6 || columns[f] || used.has(col)) continue;
    // Sanity checks on the kind of values.
    const c = p.columns.find((x) => x.name === col)!;
    const isDateField = ["received_on", "intake_completed_on", "hold_start", "hold_end", "booked_for", "closed_on"].includes(f);
    if (isDateField && c.kind !== "date" && c.kind !== "empty") continue;
    if (f === "family_email" && c.kind !== "email" && c.kind !== "empty") continue;
    columns[f] = col;
    used.add(col);
    confidence[f] = Math.round(s * 100) / 100;
  }

  const dateCols = p.columns.filter((c) => c.kind === "date");
  const formats = dateCols.map((c) => c.dateFormats ?? []).reduce<DateFormat[]>((acc, f) => acc.filter((x) => f.includes(x)), dateCols[0]?.dateFormats ?? ["YYYY-MM-DD"]);
  const date_format = formats[0] ?? "YYYY-MM-DD";
  confidence.date_format = formats.length === 1 ? 0.95 : formats.length > 1 ? 0.5 : 0.2;
  if (formats.length > 1) questions.push(`Dates fit more than one format (${formats.join(", ")}). Check which one your system uses.`);

  let event: Recipe["event"];
  if (isEvents) {
    const kinds: Record<string, EventKind> = {};
    for (const v of eventKindCol!.values ?? []) kinds[v] = EVENT_RULES.find(([re]) => re.test(v))?.[1] ?? "ignore";
    const unmatched = (eventKindCol!.values ?? []).filter((v) => !EVENT_RULES.some(([re]) => re.test(v)));
    if (unmatched.length) questions.push(`Event types not recognised: ${unmatched.join(", ")}. They are ignored unless you map them.`);
    const dates = dateCols.sort((a, b) => b.filled - a.filled);
    const appt = dates.find((c) => /appt|rdv|appoint|booked/i.test(c.name) && c !== dates[0]);
    const note = p.columns.find((c) => /note|reason|motif|comment/i.test(c.name));
    event = { kind_column: eventKindCol!.name, date_column: dates[0]?.name ?? "", ...(appt ? { appointment_column: appt.name } : {}), ...(note ? { note_column: note.name } : {}), kinds };
    confidence.shape = 0.85;
  } else confidence.shape = 0.9;

  const priority_values: Record<string, Priority> = {};
  const pcol = p.columns.find((c) => c.name === columns.priority);
  for (const v of pcol?.values ?? []) {
    const hit = PRIORITY_RULES.find(([re]) => re.test(norm(v)) || re.test(v));
    if (hit) priority_values[v] = hit[1];
    else questions.push(`Priority value "${v}" not recognised.`);
  }
  const close_values: Record<string, "assessed" | "withdrawn"> = {};
  const ccol = p.columns.find((c) => c.name === columns.close_reason);
  for (const v of ccol?.values ?? []) {
    const g = guessCloseValue(v);
    if (g) close_values[v] = g;
    else questions.push(`Close reason "${v}" not recognised as assessed or withdrawn.`);
  }

  for (const f of ["referral_id", "received_on"] as RecordField[]) if (!columns[f] && !(isEvents && f === "received_on")) questions.push(`No column found for ${f}.`);
  const mapped = new Set([...Object.values(columns), event?.kind_column, event?.date_column, event?.appointment_column, event?.note_column].filter(Boolean) as string[]);
  return {
    shape: isEvents ? "per_event" : "per_referral",
    date_format,
    columns,
    ...(event ? { event } : {}),
    priority_values,
    close_values,
    ignored_columns: p.columns.map((c) => c.name).filter((n) => !mapped.has(n)),
    confidence,
    questions,
    proposed_by: "rules",
    header: p.columns.map((c) => c.name),
  };
}
