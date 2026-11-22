// Describe each column of an export without exposing the people in it.
//
// The profile is what the AI mapper sees: column names, how full each column
// is, what kind of values it holds and a few example values. Anything that
// could identify a family (emails, phone numbers, names, free text) is replaced
// by a placeholder before it leaves this browser.

import { formatsThatFit, type DateFormat } from "./dates";
import type { Table } from "./parse";

export type ColumnKind = "empty" | "date" | "number" | "email" | "phone" | "code" | "text";

export interface ColumnProfile {
  name: string;
  index: number;
  filled: number;
  distinct: number;
  kind: ColumnKind;
  /** a handful of distinct example values, masked where they could identify someone */
  examples: string[];
  /** for code-like columns: every distinct value (there are few of them) */
  values?: string[];
  dateFormats?: DateFormat[];
}

export interface TableProfile {
  rows: number;
  delimiter: string;
  columns: ColumnProfile[];
  /** rows per distinct value of the most ID-like column; well above 1 suggests one row per event */
  rowsPerId: number;
}

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const PHONE = /^\+?[\d\s().-]{7,}$/;
const NUMBER = /^-?\d+(\.\d+)?$/;
const NAMEISH = /\b(name|nom|prenom|prénom|first|last|surname|guardian|parent|child|enfant)\b/i;

function mask(kind: ColumnKind, header: string, v: string) {
  if (kind === "email") return "<email>";
  if (kind === "phone") return "<phone>";
  if (kind === "text" && NAMEISH.test(header) && !/source|reason|motif/i.test(header)) return "<name or free text>";
  return v.length > 40 ? `${v.slice(0, 37)}…` : v;
}

export function profileTable(t: Table): TableProfile {
  const columns: ColumnProfile[] = t.header.map((name, index) => {
    const vals = t.rows.map((r) => r[index] ?? "").filter((v) => v !== "");
    const distinctSet = new Set(vals);
    const sample = vals.slice(0, 400);
    let kind: ColumnKind = "text";
    let dateFormats: DateFormat[] | undefined;
    if (vals.length === 0) kind = "empty";
    else if (sample.every((v) => EMAIL.test(v))) kind = "email";
    else if ((dateFormats = formatsThatFit(sample)).length > 0) kind = "date";
    else if (sample.every((v) => NUMBER.test(v))) kind = "number";
    else if (sample.every((v) => PHONE.test(v)) && sample.some((v) => /\d{3}.?\d{4}/.test(v))) kind = "phone";
    else if (distinctSet.size <= 20 && distinctSet.size < vals.length / 3) kind = "code";
    if (kind === "date" && dateFormats!.length > 1) {
      // Use every value to separate day-first from month-first.
      dateFormats = formatsThatFit(vals);
    }
    const distinct = [...distinctSet];
    return {
      name,
      index,
      filled: vals.length,
      distinct: distinctSet.size,
      kind,
      examples: distinct.slice(0, 6).map((v) => mask(kind, name, v)),
      ...(kind === "code" ? { values: distinct.slice(0, 20) } : {}),
      ...(kind === "date" ? { dateFormats } : {}),
    };
  });
  // The ID column is usually the first mostly-distinct text column.
  const idCol = columns.find((c) => c.kind === "text" || c.kind === "number" || c.kind === "code") ?? columns[0];
  const rowsPerId = idCol && idCol.distinct > 0 ? t.rows.length / idCol.distinct : 1;
  return { rows: t.rows.length, delimiter: t.delimiter, columns, rowsPerId: Math.round(rowsPerId * 100) / 100 };
}
