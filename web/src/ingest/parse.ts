// Read a clinic's delimited export (CSV, semicolon-separated or tab-separated)
// into a header row and data rows. Handles quoted values, doubled quotes,
// CRLF line ends and a leading byte-order mark.

export interface Table {
  delimiter: string;
  header: string[];
  rows: string[][];
}

export function detectDelimiter(text: string) {
  const firstLine = text.slice(0, text.indexOf("\n") === -1 ? undefined : text.indexOf("\n"));
  const counts = [",", ";", "\t", "|"].map((d) => [d, firstLine.split(d).length - 1] as const);
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0][1] > 0 ? counts[0][0] : ",";
}

export function parseDelimited(input: string, delimiter = detectDelimiter(input)): Table {
  const text = input.replace(/^﻿/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
      continue;
    }
    if (ch === '"' && field === "") quoted = true;
    else if (ch === delimiter) {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
    } else field += ch;
  }
  row.push(field);
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  const [header = [], ...data] = rows;
  return { delimiter, header: header.map((h) => h.trim()), rows: data.map((r) => r.map((c) => c.trim())) };
}
