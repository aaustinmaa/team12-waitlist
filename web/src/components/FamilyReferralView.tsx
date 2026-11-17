import {
  BadgeCheck,
  Bell,
  CalendarCheck,
  ChevronDown,
  CircleHelp,
  Clock,
  Info,
  Mail,
  MessageCircleQuestion,
  PauseCircle,
  Phone,
  Sparkles,
} from "lucide-react";
import type { ReactNode } from "react";
import { addWeeks, daysBetween } from "../lib/dates";
import { duration, useI18n } from "../lib/i18n";
import type { FamilyReferralResponse } from "../lib/types";
import { AppointmentCard } from "./family/AppointmentCard";
import { PortalsCard, WhileYouWait } from "./family/Resources";
import { OPEN_NOTIFY_SETTINGS, UpdatesCard, useActiveChannels } from "./family/UpdatesCard";
import { btn, Card, CardHeading, jumpTo, Tag } from "./ui";

interface Props {
  data: FamilyReferralResponse;
  /** single column, used inside the staff preview panel */
  compact?: boolean;
}

/**
 * The family-facing referral page. Confirmed facts (status, dates, contact)
 * and the estimate are drawn differently on purpose: solid cards for what the
 * clinic has confirmed, a dashed card for what is estimated. All text comes
 * from the family's chosen language (lib/i18n).
 */
export function FamilyReferralView({ data, compact = false }: Props) {
  const { dir, lang } = useI18n();
  const { referral, clinic } = data;
  // In the staff preview there is nothing to jump to, so the jump buttons are left out.
  const ids = compact ? {} : { contact: "contact", updates: "updates", wait: "while-you-wait" };

  // Two rows. The first is about this referral: the main column, with the
  // two short cards a family needs at hand (who to call, how they'll hear)
  // beside it. The second is general help, across the full width, so the
  // side column is never much longer than the main one.
  return (
    <div dir={dir} lang={lang} className={compact ? "space-y-4" : "space-y-5 lg:space-y-6"}>
      <div className={compact ? "space-y-4" : "grid items-start gap-5 lg:grid-cols-3 lg:gap-6"}>
        <div className={compact ? "space-y-4" : "space-y-5 lg:col-span-2 lg:space-y-6"}>
          <StatusCard data={data} compact={compact} />
          {referral.status === "assessment_booked" ? <AppointmentCard data={data} /> : <EstimateCard data={data} ids={ids} />}
          <Journey data={data} />
        </div>
        <aside className={compact ? "space-y-4" : "space-y-5 lg:space-y-6"}>
          <ContactCard id={ids.contact} referralId={referral.id} clinic={clinic} />
          <UpdatesCard data={data} id={ids.updates} readOnly={compact} />
        </aside>
      </div>
      <div className={compact ? "space-y-4" : "grid items-start gap-5 lg:grid-cols-3 lg:gap-6"}>
        <WhileYouWait id={ids.wait} className={compact ? "" : "lg:col-span-2"} />
        <PortalsCard portals={clinic.portals ?? []} />
      </div>
    </div>
  );
}

function StatusCard({ data, compact }: { data: FamilyReferralResponse; compact: boolean }) {
  const { t, fmt } = useI18n();
  const { referral, estimate, appointment } = data;
  const waited = daysBetween(referral.received_on, estimate.as_of);
  const Icon = referral.status === "on_hold" ? PauseCircle : referral.status === "assessment_booked" ? CalendarCheck : BadgeCheck;

  return (
    <Card tour="status">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <CardHeading>{t.status.heading}</CardHeading>
        <Tag icon={<BadgeCheck className="size-3.5" aria-hidden />}>{t.status.confirmed}</Tag>
      </div>
      <div className="mt-4 flex items-start gap-3">
        <span className={`grid size-11 shrink-0 place-items-center rounded-xl ${referral.status === "on_hold" ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-600"}`}>
          <Icon className="size-6" aria-hidden />
        </span>
        <div>
          <p className="text-xl font-semibold text-slate-900 sm:text-2xl">{t.status.label[referral.status]}</p>
          <p className="mt-1 text-slate-600">{t.status.explain[referral.status]}</p>
        </div>
      </div>

      {referral.status === "on_hold" && referral.hold && (
        <div className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-950 ring-1 ring-amber-200">
          <p>
            <strong>{t.status.holdSince(fmt.long(referral.hold.start))}</strong>
            {referral.hold.reason && <> · {t.status.holdReasons[referral.hold.reason] ?? referral.hold.reason}</>}
          </p>
          <p className="mt-1 text-amber-900">{t.status.holdKept}</p>
        </div>
      )}

      {referral.status === "assessment_booked" && referral.appointment_on && (
        <div className="mt-4 rounded-xl bg-emerald-50 p-4 ring-1 ring-emerald-200">
          <p className="text-sm text-emerald-900">{t.status.firstAssessment}</p>
          <p className="text-lg font-semibold text-emerald-950">
            {appointment ? t.status.at(fmt.weekday(referral.appointment_on), fmt.time(appointment.start_time)) : fmt.weekday(referral.appointment_on)}
          </p>
        </div>
      )}

      <dl className={`mt-5 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-slate-100 pt-4 text-sm ${compact ? "" : "sm:grid-cols-4"}`}>
        <Fact label={t.status.service} value={t.page.service} />
        <Fact label={t.status.received} value={fmt.long(referral.received_on)} />
        <Fact
          label={t.status.waited}
          value={duration(t, waited)}
          note={referral.days_on_hold ? t.status.includingHold(duration(t, referral.days_on_hold)) : undefined}
        />
        <Fact
          label={t.status.referralId}
          value={
            <span className="font-mono" dir="ltr">
              {referral.id}
            </span>
          }
        />
      </dl>
    </Card>
  );
}

function Fact({ label, value, note }: { label: string; value: ReactNode; note?: string }) {
  return (
    <div>
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-medium text-slate-900">{value}</dd>
      {note && <dd className="text-xs text-slate-500">{note}</dd>}
    </div>
  );
}

type Ids = { contact?: string; updates?: string; wait?: string };

/** "We'll let you know": how this family will hear when their estimate appears or changes. */
function NotifyPromise({ data, kind, ids }: { data: FamilyReferralResponse; kind: "ready" | "change"; ids: Ids }) {
  const { t } = useI18n();
  const channels = useActiveChannels(data);
  const say = kind === "ready" ? t.notify.readyBy : t.notify.changeBy;
  return (
    <div className="mt-4 flex items-start gap-3 rounded-xl bg-slate-50 p-4 text-sm text-slate-700 ring-1 ring-slate-200">
      <Bell className="mt-0.5 size-4 shrink-0 text-slate-500" aria-hidden />
      <div className="min-w-0">
        {kind === "ready" && <p className="font-medium text-slate-900">{t.notify.promiseTitle}</p>}
        {channels.length === 0 ? (
          <p>{t.notify.noChannel}</p>
        ) : (
          channels.map(({ channel, to }) => (
            <p key={channel}>
              <bdi>{say[channel](to)}</bdi>
            </p>
          ))
        )}
        {ids.updates && (
          <button
            type="button"
            onClick={() => {
              window.dispatchEvent(new Event(OPEN_NOTIFY_SETTINGS));
              jumpTo(ids.updates!);
            }}
            className="mt-1 font-medium text-teal-700 underline underline-offset-2 hover:text-teal-800">
            {t.notify.settings}
          </button>
        )}
      </div>
    </div>
  );
}

function EstimateCard({ data, ids }: { data: FamilyReferralResponse; ids: Ids }) {
  const { t, fmt } = useI18n();
  const { estimate, intake } = data;

  if (estimate.status === "unavailable" || !estimate.range_weeks) {
    const reason = estimate.reason ?? "intake_incomplete";
    const late = reason === "intake_incomplete" && !!intake && intake.days_since_received > intake.most_within_days;
    const when =
      reason === "intake_incomplete" && intake
        ? t.estimate.whenIntake(t.units.days(intake.typical_days), t.units.days(intake.most_within_days), t.units.days(intake.days_since_received))
        : reason === "on_hold"
          ? t.estimate.whenHold
          : reason === "beyond_horizon"
            ? t.estimate.whenHorizon
            : null;
    return (
      <Card dashed tour="estimate">
        <EstimateHeader />
        <div className="mt-4 flex items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-600">
            <CircleHelp className="size-6" aria-hidden />
          </span>
          <div>
            <p className="text-xl font-semibold text-slate-900">{t.estimate.noneTitle}</p>
            <p className="mt-1 text-slate-600">{t.estimate.none[reason]}</p>
          </div>
        </div>
        <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-700 ring-1 ring-slate-200">
          <p className="font-medium text-slate-900">{t.estimate.keptTitle}</p>
          <p className="mt-1">{t.estimate.keptBody}</p>
        </div>
        {when && (
          <div className="mt-4 flex items-start gap-3 rounded-xl bg-slate-50 p-4 text-sm text-slate-700 ring-1 ring-slate-200">
            <Clock className="mt-0.5 size-4 shrink-0 text-slate-500" aria-hidden />
            <div>
              <p className="font-medium text-slate-900">{t.estimate.whenTitle}</p>
              <p className="mt-1">{when}</p>
              {late && <p className="mt-1 font-medium text-amber-900">{t.estimate.whenIntakeLate}</p>}
            </div>
          </div>
        )}
        <NotifyPromise data={data} kind="ready" ids={ids} />
        {ids.contact && (
          <button type="button" onClick={() => jumpTo(ids.contact!)} className={btn("primary", "mt-4 px-4 py-2.5")}>
            <MessageCircleQuestion className="size-4" aria-hidden />
            {t.estimate.contact}
          </button>
        )}
        <p className="mt-4 text-xs text-slate-500">{t.estimate.checked(fmt.long(estimate.as_of))}</p>
      </Card>
    );
  }

  const { lower, upper } = estimate.range_weeks;
  const from = addWeeks(estimate.as_of, lower);
  const to = addWeeks(estimate.as_of, upper);

  return (
    <Card dashed tour="estimate">
      <EstimateHeader />
      <p className="mt-4 text-slate-600">{t.estimate.lead}</p>
      <p className="mt-1 text-3xl font-bold tracking-tight text-indigo-950 sm:text-4xl rtl:tracking-normal">{t.estimate.range(estimate.range_weeks)}</p>
      <p className="mt-2 text-slate-700">{t.estimate.between(fmt.long(from), fmt.long(to))}</p>

      <RangeBar asOf={estimate.as_of} lower={lower} upper={upper} />

      <div className="mt-5 flex items-start gap-3 rounded-xl bg-amber-50 p-4 text-sm text-amber-950 ring-1 ring-amber-200">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
        <p>
          <strong>{t.estimate.notAppointment}</strong> {t.estimate.message}
        </p>
      </div>

      <NotifyPromise data={data} kind="change" ids={ids} />

      <details className="group mt-4 rounded-xl border border-slate-200">
        <summary className="flex cursor-pointer items-center justify-between gap-2 px-4 py-3 text-sm font-medium text-slate-800">
          {t.estimate.whyTitle}
          <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden />
        </summary>
        <ul className="list-disc space-y-1 px-4 pb-4 ps-9 text-sm text-slate-600">
          {t.estimate.why.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      </details>
      <HowEstimated data={data} />

      {ids.wait && (
        <button type="button" onClick={() => jumpTo(ids.wait!)} className="mt-4 text-sm font-medium text-teal-700 underline underline-offset-2 hover:text-teal-800">
          {t.estimate.whileYouWait}
        </button>
      )}

      <p className="mt-4 flex items-center gap-1.5 text-xs text-slate-500">
        <Clock className="size-3.5 shrink-0" aria-hidden />
        {t.estimate.calculated(fmt.long(estimate.as_of))}
      </p>
    </Card>
  );
}

function EstimateHeader() {
  const { t } = useI18n();
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <CardHeading>{t.estimate.heading}</CardHeading>
      <Tag icon={<Sparkles className="size-3.5" aria-hidden />}>{t.estimate.chip}</Tag>
    </div>
  );
}

/** Positions use inline-start, so the bar runs right to left in right-to-left languages. */
function RangeBar({ asOf, lower, upper }: { asOf: string; lower: number; upper: number }) {
  const { t, fmt } = useI18n();
  const max = Math.max(12, Math.ceil((upper + 2) / 4) * 4);
  const pct = (w: number) => `${(w / max) * 100}%`;
  const ticks = Array.from({ length: max / 4 + 1 }, (_, i) => i * 4);

  return (
    <div className="mt-6" aria-hidden>
      <div className="relative h-3 rounded-full bg-slate-100">
        <div className="absolute inset-y-0 rounded-full bg-indigo-500/80" style={{ insetInlineStart: pct(lower), width: `calc(${pct(upper)} - ${pct(lower)})` }} />
        <div className="absolute -top-1.5 h-6 w-1 -translate-x-1/2 rounded bg-slate-800 rtl:translate-x-1/2" style={{ insetInlineStart: 0 }} />
      </div>
      <div className="relative mt-2 h-8 text-xs text-slate-500">
        {ticks.map((tick) => (
          <span
            key={tick}
            className={`absolute whitespace-nowrap ${
              tick === 0 ? "font-medium text-slate-800" : tick === max ? "-translate-x-full rtl:translate-x-full" : "-translate-x-1/2 rtl:translate-x-1/2"
            }`}
            style={{ insetInlineStart: pct(tick) }}
          >
            {tick === 0 ? t.estimate.today : t.units.wk(tick)}
            <span className="block text-[10px] text-slate-400">{fmt.short(addWeeks(asOf, tick))}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function Journey({ data }: { data: FamilyReferralResponse }) {
  const { t, fmt } = useI18n();
  const { referral, appointment } = data;
  const booked = referral.status === "assessment_booked";
  const steps = [
    { label: t.steps.received, detail: fmt.long(referral.received_on), state: "done" },
    {
      label: referral.status === "on_hold" ? t.steps.waitlistHold : t.steps.waitlist,
      detail: booked ? t.steps.done : t.steps.here,
      state: booked ? "done" : "current",
    },
    {
      label: t.steps.booked,
      detail: booked && referral.appointment_on ? t.steps.bookedFor(fmt.long(referral.appointment_on)) : t.steps.clinicContacts,
      state: booked ? "current" : "todo",
    },
    { label: t.steps.assessment, detail: appointment?.clinician ? t.steps.withName(appointment.clinician.name) : t.steps.withSlp, state: "todo" },
  ] as const;

  return (
    <Card tour="steps">
      <CardHeading>{t.steps.heading}</CardHeading>
      <ol className="mt-4 grid gap-0 sm:grid-cols-4 sm:gap-3">
        {steps.map((s, i) => (
          <li key={s.label} className="relative flex gap-3 pb-5 last:pb-0 sm:flex-col sm:pb-0">
            {i < steps.length - 1 && (
              <span
                className={`absolute start-[11px] top-6 h-[calc(100%-1.5rem)] w-0.5 sm:start-6 sm:top-[11px] sm:h-0.5 sm:w-[calc(100%-0.75rem)] ${s.state === "done" ? "bg-slate-500" : "bg-slate-200"}`}
                aria-hidden
              />
            )}
            <span
              className={`relative z-10 grid size-6 shrink-0 place-items-center rounded-full text-xs font-bold ${
                s.state === "done" ? "bg-slate-600 text-white" : s.state === "current" ? "bg-white text-slate-900 ring-4 ring-slate-700" : "bg-slate-200 text-slate-500"
              }`}
            >
              {s.state === "done" ? "✓" : i + 1}
            </span>
            <div>
              <p className={`font-medium ${s.state === "todo" ? "text-slate-500" : "text-slate-900"}`}>{s.label}</p>
              <p className={`text-sm ${s.state === "current" ? "font-semibold text-slate-900" : "text-slate-500"}`}>{s.detail}</p>
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}

function ContactCard({ id, referralId, clinic }: { id?: string; referralId: string; clinic: FamilyReferralResponse["clinic"] }) {
  const { t } = useI18n();
  return (
    <Card id={id} tour="contact" className="scroll-mt-20">
      <CardHeading id={id ? `${id}-heading` : undefined}>{t.contact.heading}</CardHeading>
      {clinic.name && <p className="mt-3 font-semibold text-slate-900">{clinic.name}</p>}
      <p className="text-sm text-slate-600">{t.contact.team}</p>
      <div className="mt-4 space-y-2">
        <a
          href={`mailto:${clinic.contact}?subject=${encodeURIComponent(`Referral ${referralId}`)}`}
          className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 hover:border-teal-300 hover:bg-teal-50"
        >
          <Mail className="size-5 shrink-0 text-teal-700" aria-hidden />
          <span className="min-w-0">
            <span className="block text-sm text-slate-500">{t.contact.email}</span>
            <span className="block break-words font-medium text-teal-800 underline decoration-teal-300 underline-offset-2" dir="ltr">
              {clinic.contact}
            </span>
          </span>
        </a>
        {clinic.phone && (
          <a href={`tel:${clinic.phone}`} className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 hover:border-teal-300 hover:bg-teal-50">
            <Phone className="size-5 shrink-0 text-teal-700" aria-hidden />
            <span className="min-w-0">
              <span className="block text-sm text-slate-500">
                {t.contact.phone}
                {clinic.hours ? ` · ${clinic.hours}` : ""}
              </span>
              <span className="block font-medium text-teal-800 underline decoration-teal-300 underline-offset-2" dir="ltr">
                {clinic.phone}
              </span>
            </span>
          </a>
        )}
      </div>
      <p className="mt-3 text-sm text-slate-600">
        {t.contact.haveId}{" "}
        <span className="font-mono font-medium text-slate-900" dir="ltr">
          {referralId}
        </span>
      </p>
    </Card>
  );
}

/** Folded away under the estimate it explains. */
function HowEstimated({ data }: { data: FamilyReferralResponse }) {
  const { t } = useI18n();
  return (
    <details className="group mt-2 rounded-xl border border-slate-200">
      <summary className="flex cursor-pointer items-center justify-between gap-2 px-4 py-3 text-sm font-medium text-slate-800">
        {t.how.heading}
        <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <div className="space-y-2 px-4 pb-4 text-sm text-slate-600">
        <p>{t.how.p1}</p>
        <p>{t.how.p2}</p>
        <p>{t.how.priority}</p>
        {data.priority && data.priority !== "standard" && <p className="font-medium text-slate-800">{t.how.priorityRaised}</p>}
        <p>{t.how.p3}</p>
      </div>
    </details>
  );
}
