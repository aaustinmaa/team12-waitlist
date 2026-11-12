// Dates in the contract are plain YYYY-MM-DD strings. Treat them as UTC days so
// the displayed date never shifts with the viewer's time zone.

const DAY = 86_400_000;

export function parseDay(s: string) {
  return new Date(`${s}T00:00:00Z`);
}

export function addWeeks(s: string, weeks: number) {
  return new Date(parseDay(s).getTime() + weeks * 7 * DAY);
}

export function daysBetween(from: string, to: string) {
  return Math.round((parseDay(to).getTime() - parseDay(from).getTime()) / DAY);
}

const long = new Intl.DateTimeFormat("en-CA", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
const short = new Intl.DateTimeFormat("en-CA", { month: "short", day: "numeric", timeZone: "UTC" });
const weekday = new Intl.DateTimeFormat("en-CA", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });

export const fmtLong = (d: string | Date) => long.format(typeof d === "string" ? parseDay(d) : d);
export const fmtShort = (d: string | Date) => short.format(typeof d === "string" ? parseDay(d) : d);
export const fmtWeekday = (d: string | Date) => weekday.format(typeof d === "string" ? parseDay(d) : d);
