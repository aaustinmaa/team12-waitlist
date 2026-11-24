import { useMemo, useState } from "react";
import { BadgeCheck, CalendarCheck, CalendarPlus, Clock, ExternalLink, ListChecks, MapPin, UserRound } from "lucide-react";
import { downloadIcs, googleCalendarUrl, outlookCalendarUrl, toIcs, type CalEvent } from "../../lib/calendar";
import { useI18n } from "../../lib/i18n";
import type { FamilyReferralResponse } from "../../lib/types";
import { btn, Card, CardHeading, SuccessNote, Tag } from "../ui";

function addMinutes(hhmm: string, minutes: number) {
  const [h, m] = hhmm.split(":").map(Number);
  const total = h * 60 + m + minutes;
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/**
 * Everything a family needs for a booked first assessment: when, where, who
 * they will meet, and a way to put it in their own calendar.
 */
export function AppointmentCard({ data }: { data: FamilyReferralResponse }) {
  const { t, fmt } = useI18n();
  const [saved, setSaved] = useState<string | null>(null);
  const a = data.appointment;
  const { referral, clinic } = data;

  const events = useMemo(() => {
    if (!a) return null;
    const room = a.location.room ? `, ${t.appointment.room(a.location.room)}` : "";
    const lines = [
      a.clinician ? t.appointment.eventWith(a.clinician.name, t.appointment.role[a.clinician.role]) : null,
      t.appointment.eventBring,
      clinic.phone ? t.appointment.eventContact(clinic.phone) : null,
    ].filter((x): x is string => !!x);
    const base: CalEvent = {
      uid: `${referral.id}-first-assessment@team12-waitlist.example`,
      title: t.appointment.eventTitle(a.location.name),
      description: lines.join("\n"),
      location: `${a.location.name}${room}, ${a.location.address}`,
      date: a.on,
      start: a.start_time,
      durationMinutes: a.duration_minutes,
      timeZone: a.timezone,
      reminderMinutes: 24 * 60,
    };
    // The file stays on the family's device, so it can carry the referral ID.
    // The links hand the text to another company's calendar, so they don't.
    return { file: { ...base, description: `${base.description}\n${t.status.referralId}: ${referral.id}` }, link: base };
  }, [a, clinic.phone, referral.id, t]);

  if (!a || !events) {
    return (
      <Card tour="appointment">
        <CardHeading icon={ListChecks}>{t.appointment.beforeTitle}</CardHeading>
        <BeforeList items={t.appointment.before} />
      </Card>
    );
  }

  const end = addMinutes(a.start_time, a.duration_minutes);
  const save = () => {
    const filename = `first-assessment-${a.on}.ics`;
    downloadIcs(filename, toIcs(events.file));
    setSaved(filename);
  };

  return (
    <Card tour="appointment">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <CardHeading icon={CalendarCheck}>{t.appointment.heading}</CardHeading>
        <Tag icon={<BadgeCheck className="size-3.5" aria-hidden />}>{t.status.confirmed}</Tag>
      </div>

      <dl className="mt-4 grid gap-4 sm:grid-cols-3">
        <Detail icon={Clock} label={t.appointment.when}>
          <p className="font-semibold text-slate-900">{fmt.weekday(a.on)}</p>
          <p className="text-slate-700">{t.appointment.timeRange(fmt.time(a.start_time), fmt.time(end))}</p>
          <p className="text-sm text-slate-500">{t.appointment.about(t.units.minutes(a.duration_minutes))}</p>
        </Detail>
        <Detail icon={MapPin} label={t.appointment.where}>
          <p className="font-semibold text-slate-900">{a.location.name}</p>
          <p className="text-slate-700">{a.location.address}</p>
          {a.location.room && <p className="text-sm text-slate-500">{t.appointment.room(a.location.room)}</p>}
        </Detail>
        {a.clinician && (
          <Detail icon={UserRound} label={t.appointment.with}>
            <p className="font-semibold text-slate-900">{a.clinician.name}</p>
            <p className="text-slate-700">
              {t.appointment.role[a.clinician.role]}
              <span className="text-slate-500"> · {a.clinician.registration}</span>
            </p>
            <p className="text-sm text-slate-500">{t.appointment.speaks(t.units.list(a.clinician.languages.map((l) => t.appointment.languages[l])))}</p>
          </Detail>
        )}
      </dl>

      <div className="mt-5 rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200">
        <p className="flex items-center gap-2 text-sm font-medium text-slate-900">
          <CalendarPlus className="size-4 text-slate-500" aria-hidden />
          {t.appointment.calendarTitle}
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <button type="button" onClick={save} className={btn("primary")}>
            {t.appointment.ics}
          </button>
          <a href={googleCalendarUrl(events.link)} target="_blank" rel="noopener noreferrer" className={btn("outline")}>
            {t.appointment.google}
            <ExternalLink className="size-3.5" aria-hidden />
            <span className="sr-only">({t.page.newTab})</span>
          </a>
          <a href={outlookCalendarUrl(events.link)} target="_blank" rel="noopener noreferrer" className={btn("outline")}>
            {t.appointment.outlook}
            <ExternalLink className="size-3.5" aria-hidden />
            <span className="sr-only">({t.page.newTab})</span>
          </a>
        </div>
        <p role="status" className="mt-2 text-sm text-slate-600">
          {saved ? <SuccessNote>{t.appointment.downloaded(saved)}</SuccessNote> : t.appointment.calendarNote}
        </p>
      </div>

      <h3 className="mt-5 text-sm font-medium text-slate-900">{t.appointment.beforeTitle}</h3>
      <BeforeList items={t.appointment.before} />
    </Card>
  );
}

function Detail({ icon: Icon, label, children }: { icon: typeof Clock; label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <Icon className="mt-0.5 size-5 shrink-0 text-slate-500" aria-hidden />
      <div className="min-w-0">
        <dt className="text-sm text-slate-500">{label}</dt>
        <dd>{children}</dd>
      </div>
    </div>
  );
}

function BeforeList({ items }: { items: string[] }) {
  return (
    <ul className="mt-2 list-disc space-y-1.5 ps-5 text-slate-700">
      {items.map((s) => (
        <li key={s}>{s}</li>
      ))}
    </ul>
  );
}
