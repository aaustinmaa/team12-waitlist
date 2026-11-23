// "Add to calendar" for a booked first assessment: an .ics file (Apple
// Calendar, Outlook, most phones) and links that open a pre-filled event in
// Google Calendar or Outlook on the web.

export interface CalEvent {
  uid: string;
  title: string;
  description: string;
  location: string;
  /** YYYY-MM-DD and HH:MM in `timeZone` */
  date: string;
  start: string;
  durationMinutes: number;
  /** IANA time zone, e.g. America/Toronto */
  timeZone: string;
  /** minutes before the start for a reminder, e.g. 1440 for one day */
  reminderMinutes?: number;
}

/** The instant a wall-clock time in a time zone refers to. */
export function zonedToUtc(date: string, time: string, timeZone: string) {
  const guess = new Date(`${date}T${time}:00Z`);
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const part = Object.fromEntries(fmt.formatToParts(guess).map((p) => [p.type, p.value]));
  const shown = Date.UTC(+part.year, +part.month - 1, +part.day, +part.hour, +part.minute, +part.second);
  // `shown - guess` is the zone's offset at that moment; take it off the guess.
  return new Date(guess.getTime() - (shown - guess.getTime()));
}

const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");

export function eventTimes(ev: CalEvent) {
  const start = zonedToUtc(ev.date, ev.start, ev.timeZone);
  return { start, end: new Date(start.getTime() + ev.durationMinutes * 60_000) };
}

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/** RFC 5545 asks for lines of at most 75 octets; longer ones continue after CRLF + space. */
function fold(line: string) {
  const enc = new TextEncoder();
  const out: string[] = [];
  let cur = "";
  let bytes = 0;
  for (const ch of line) {
    const n = enc.encode(ch).length;
    if (bytes + n > (out.length === 0 ? 75 : 74)) {
      out.push(cur);
      cur = "";
      bytes = 0;
    }
    cur += ch;
    bytes += n;
  }
  out.push(cur);
  return out.join("\r\n ");
}

export function toIcs(ev: CalEvent, now: Date = new Date()) {
  const { start, end } = eventTimes(ev);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//CS 497 ClearWait//Waitlist Prototype//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${ev.uid}`,
    `DTSTAMP:${stamp(now)}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${esc(ev.title)}`,
    `LOCATION:${esc(ev.location)}`,
    `DESCRIPTION:${esc(ev.description)}`,
    ...(ev.reminderMinutes
      ? ["BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${esc(ev.title)}`, `TRIGGER:-PT${ev.reminderMinutes}M`, "END:VALARM"]
      : []),
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n") + "\r\n";
}

export function googleCalendarUrl(ev: CalEvent) {
  const { start, end } = eventTimes(ev);
  const q = new URLSearchParams({
    action: "TEMPLATE",
    text: ev.title,
    dates: `${stamp(start)}/${stamp(end)}`,
    details: ev.description,
    location: ev.location,
  });
  return `https://calendar.google.com/calendar/render?${q}`;
}

export function outlookCalendarUrl(ev: CalEvent) {
  const { start, end } = eventTimes(ev);
  const q = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: ev.title,
    startdt: start.toISOString(),
    enddt: end.toISOString(),
    body: ev.description,
    location: ev.location,
  });
  return `https://outlook.live.com/calendar/0/deeplink/compose?${q}`;
}

export function downloadIcs(filename: string, ics: string) {
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
