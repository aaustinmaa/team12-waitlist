// The AI mapper: asks Gemini to read the masked column profile and propose a
// mapping recipe as structured JSON.
//
// Only the profile is sent (column names, value kinds, masked examples and the
// short lists of code values) — never the rows. The answer is checked against
// the file before it is used: columns that don't exist are dropped and
// anything the AI left out is filled from the rule-based proposal, marked
// with lower confidence.
//
// Where the key lives: in the hosted version the request goes through the
// server (supabase/functions/propose-mapping), which holds the key. In the
// local prototype a staff admin can paste a key in Settings; it stays in this
// browser only. Free-tier Gemini keys may let Google use prompts to improve
// its products, which is one more reason only masked profiles are sent.

import { PRIORITIES, RECORD_FIELDS, type RecordField } from "../engine/types";
import { DATE_FORMATS } from "./dates";
import type { TableProfile } from "./profile";
import { EVENT_KINDS, type EventKind, type Recipe } from "./recipe";
import { proposeByRules } from "./rules";

export const DEFAULT_GEMINI_MODEL = "gemini-3.5-flash-lite";

const FIELD_HELP: Record<RecordField, string> = {
  referral_id: "unique ID of the referral (or client file) in the clinic system",
  service: "service or program name",
  priority: "clinical priority / urgency code",
  received_on: "date the clinic received the referral",
  intake_completed_on: "date intake information was complete (child ready to be booked)",
  hold_start: "date a hold/pause started",
  hold_end: "date the hold ended",
  hold_reason: "reason for the hold",
  booked_for: "date of the booked first assessment / appointment",
  booked_time: "time of the booked appointment",
  clinician: "clinician for the booked appointment",
  closed_on: "date the referral left the waitlist (assessment done, discharged or withdrawn)",
  close_reason: "why it left the waitlist (assessment completed vs withdrawn, etc.)",
  withdrawn_reason: "reason a referral was withdrawn, if a separate column",
  age_group: "child's age group or band",
  referral_source: "who referred the child",
  family_email: "parent/guardian email (used only for sign-in and updates)",
  family_phone: "parent/guardian phone (used only for sign-in and updates)",
};

const pairList = (to: readonly string[]) => ({
  type: "array",
  items: {
    type: "object",
    properties: { from: { type: "string", description: "value exactly as it appears in the file" }, to: { type: "string", enum: [...to] } },
    required: ["from", "to"],
  },
});

const SCHEMA = {
  type: "object",
  properties: {
    shape: { type: "string", enum: ["per_referral", "per_event"], description: "per_event if the file has one row per event (several rows per referral)" },
    date_format: { type: "string", enum: [...DATE_FORMATS] },
    columns: {
      type: "array",
      description: "one entry per canonical field you can find; source must be a column name exactly as given",
      items: {
        type: "object",
        properties: { field: { type: "string", enum: [...RECORD_FIELDS] }, source: { type: "string" }, confidence: { type: "number", minimum: 0, maximum: 1 } },
        required: ["field", "source", "confidence"],
      },
    },
    event_kind_column: { type: "string", description: "per_event only: column holding the event type" },
    event_date_column: { type: "string", description: "per_event only: column holding the event date" },
    event_appointment_column: { type: "string", description: "per_event only: column holding the appointment date of booking events, if any" },
    event_note_column: { type: "string", description: "per_event only: column holding a reason/note, if any" },
    event_kinds: pairList(EVENT_KINDS),
    priority_values: pairList(PRIORITIES),
    close_values: pairList(["assessed", "withdrawn"]),
    questions: { type: "array", items: { type: "string" }, description: "short questions for clinic staff about anything uncertain" },
  },
  required: ["shape", "date_format", "columns", "priority_values", "close_values", "questions"],
};

export function buildPrompt(profile: TableProfile) {
  return [
    "You map a children's therapy clinic's waitlist export onto a standard referral format.",
    "The export may come from any clinic system, in English or French, with one row per referral or one row per event.",
    "",
    "Standard fields:",
    ...RECORD_FIELDS.map((f) => `- ${f}: ${FIELD_HELP[f]}`),
    "",
    "Event types for one-row-per-event files: received, intake_complete, hold_start, hold_end, booked (an appointment was booked), missed (appointment missed / did not attend, booking cancelled), assessed (first assessment done), withdrawn, ignore.",
    "Priorities: urgent, high, standard. Close values: assessed (first assessment done / completed) or withdrawn (family withdrew, moved, went private, no longer needed).",
    "",
    "Rules: use column names and values exactly as given. Do not invent columns. Leave out fields you cannot find.",
    "Map every listed priority value, close-reason value and event type value. If unsure, add a short question for staff.",
    "Values like <email> and <phone> are masked; the real values are never shown to you.",
    "",
    "Column profile (JSON):",
    JSON.stringify(profile, null, 1),
  ].join("\n");
}

interface GeminiAnswer {
  shape: "per_referral" | "per_event";
  date_format: (typeof DATE_FORMATS)[number];
  columns: { field: RecordField; source: string; confidence: number }[];
  event_kind_column?: string;
  event_date_column?: string;
  event_appointment_column?: string;
  event_note_column?: string;
  event_kinds?: { from: string; to: EventKind }[];
  priority_values: { from: string; to: (typeof PRIORITIES)[number] }[];
  close_values: { from: string; to: "assessed" | "withdrawn" }[];
  questions: string[];
}

export type Transport = (body: unknown) => Promise<unknown>;

/** Call the Gemini REST API directly with a key held in this browser. */
export function directTransport(apiKey: string, model = DEFAULT_GEMINI_MODEL): Transport {
  return async (body) => {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Gemini returned ${res.status}${text ? `: ${text.slice(0, 300)}` : ""}`);
    }
    return res.json();
  };
}

export function requestBody(profile: TableProfile) {
  return {
    contents: [{ role: "user", parts: [{ text: buildPrompt(profile) }] }],
    generationConfig: { responseMimeType: "application/json", responseJsonSchema: SCHEMA, temperature: 0 },
  };
}

export async function proposeByGemini(profile: TableProfile, send: Transport): Promise<Recipe> {
  const json = (await send(requestBody(profile))) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  let answer: GeminiAnswer;
  try {
    answer = JSON.parse(text) as GeminiAnswer;
  } catch {
    throw new Error("Gemini's answer was not valid JSON.");
  }
  return fromAnswer(answer, profile);
}

/** Check the AI's answer against the file and fill gaps from the rules. */
export function fromAnswer(a: GeminiAnswer, profile: TableProfile): Recipe {
  const names = new Set(profile.columns.map((c) => c.name));
  const rules = proposeByRules(profile);
  const columns: Recipe["columns"] = {};
  const confidence: Record<string, number> = { shape: 0.9, date_format: 0.9 };
  const questions = [...(a.questions ?? [])];
  for (const c of a.columns ?? []) {
    if (!names.has(c.source) || !(RECORD_FIELDS as readonly string[]).includes(c.field)) continue;
    columns[c.field] = c.source;
    confidence[c.field] = Math.max(0, Math.min(1, c.confidence ?? 0.7));
  }
  for (const [f, src] of Object.entries(rules.columns) as [RecordField, string][]) {
    if (!columns[f] && !Object.values(columns).includes(src)) {
      columns[f] = src;
      confidence[f] = Math.min(0.5, rules.confidence[f] ?? 0.5);
      questions.push(`${f} was filled in by the rule-based check ("${src}"); please confirm.`);
    }
  }
  const pairs = <T extends string>(xs: { from: string; to: T }[] | undefined) => Object.fromEntries((xs ?? []).map((x) => [x.from, x.to])) as Record<string, T>;
  const shape = a.shape === "per_event" && a.event_kind_column && names.has(a.event_kind_column) ? "per_event" : "per_referral";
  if (shape !== rules.shape) questions.push(`The AI and the rule-based check disagree on the file's shape (${shape} vs ${rules.shape}).`);
  const valid = (c?: string) => (c && names.has(c) ? c : undefined);
  const event: Recipe["event"] =
    shape === "per_event"
      ? {
          kind_column: a.event_kind_column!,
          date_column: valid(a.event_date_column) ?? rules.event?.date_column ?? "",
          ...(valid(a.event_appointment_column) ? { appointment_column: a.event_appointment_column } : {}),
          ...(valid(a.event_note_column) ? { note_column: a.event_note_column } : {}),
          kinds: { ...(rules.event?.kinds ?? {}), ...pairs(a.event_kinds) },
        }
      : undefined;
  const mapped = new Set([...Object.values(columns), event?.kind_column, event?.date_column, event?.appointment_column, event?.note_column].filter(Boolean) as string[]);
  return {
    shape,
    date_format: (DATE_FORMATS as readonly string[]).includes(a.date_format) ? a.date_format : rules.date_format,
    columns: shape === "per_event" ? Object.fromEntries(Object.entries(columns).filter(([f]) => ["referral_id", "service", "priority", "age_group", "referral_source", "family_email", "family_phone"].includes(f))) : columns,
    ...(event ? { event } : {}),
    priority_values: { ...rules.priority_values, ...pairs(a.priority_values) },
    close_values: { ...rules.close_values, ...pairs(a.close_values) },
    ignored_columns: profile.columns.map((c) => c.name).filter((n) => !mapped.has(n)),
    confidence,
    questions,
    proposed_by: "gemini",
    header: profile.columns.map((c) => c.name),
  };
}
