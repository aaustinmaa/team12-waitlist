// Date formats clinic systems commonly export, and how to read each one.

export const DATE_FORMATS = ["YYYY-MM-DD", "YYYY/MM/DD", "YYYYMMDD", "DD/MM/YYYY", "MM/DD/YYYY", "DD-MM-YYYY", "DD-MMM-YYYY"] as const;
export type DateFormat = (typeof DATE_FORMATS)[number];

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
  janv: 1, fevr: 2, fév: 2, févr: 2, mars: 3, avr: 4, mai: 5, juin: 6, juil: 7, aout: 8, août: 8, sept: 9, déc: 12,
};

const PATTERNS: Record<DateFormat, RegExp> = {
  "YYYY-MM-DD": /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T].*)?$/,
  "YYYY/MM/DD": /^(\d{4})\/(\d{1,2})\/(\d{1,2})(?: .*)?$/,
  YYYYMMDD: /^(\d{4})(\d{2})(\d{2})$/,
  "DD/MM/YYYY": /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?: .*)?$/,
  "MM/DD/YYYY": /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?: .*)?$/,
  "DD-MM-YYYY": /^(\d{1,2})-(\d{1,2})-(\d{4})$/,
  "DD-MMM-YYYY": /^(\d{1,2})[- ]([A-Za-zéûÉ.]{3,5})[- ](\d{4})$/,
};

function valid(y: number, m: number, d: number) {
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1900 || y > 2100) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCMonth() !== m - 1) return null;
  return dt.toISOString().slice(0, 10);
}

/** A date in the given format as YYYY-MM-DD, or null if it doesn't read as one. */
export function readDate(value: string, format: DateFormat): string | null {
  const v = value.trim();
  if (!v) return null;
  const m = PATTERNS[format].exec(v);
  if (!m) return null;
  switch (format) {
    case "YYYY-MM-DD":
    case "YYYY/MM/DD":
    case "YYYYMMDD":
      return valid(+m[1], +m[2], +m[3]);
    case "DD/MM/YYYY":
    case "DD-MM-YYYY":
      return valid(+m[3], +m[2], +m[1]);
    case "MM/DD/YYYY":
      return valid(+m[3], +m[1], +m[2]);
    case "DD-MMM-YYYY": {
      const mon = MONTHS[m[2].toLowerCase().replace(".", "").normalize("NFC")];
      return mon ? valid(+m[3], mon, +m[1]) : null;
    }
  }
}

/** Formats that read every one of these values. Day-first and month-first stay ambiguous when no day is above 12. */
export function formatsThatFit(values: string[]): DateFormat[] {
  const vs = values.filter((v) => v.trim() !== "");
  if (vs.length === 0) return [];
  return DATE_FORMATS.filter((f) => vs.every((v) => readDate(v, f) !== null));
}
