import {
  BadgeCheck,
  CalendarCheck,
  CalendarClock,
  ChevronDown,
  CircleHelp,
  Clock,
  Info,
  Library,
  Mail,
  MessageCircleQuestion,
  PauseCircle,
  Phone,
  Sparkles,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";
import { addWeeks, daysBetween, fmtLong, fmtShort, fmtWeekday } from "../lib/dates";
import type { FamilyReferralResponse } from "../lib/types";
import { Card, Chip, STATUS_LABEL, weeksLabel } from "./ui";

interface Props {
  data: FamilyReferralResponse;
  /** single column, used inside the staff preview panel */
  compact?: boolean;
}

/**
 * The family-facing referral page. Confirmed facts (status, dates, contact)
 * and the estimate are drawn differently on purpose: solid cards for what the
 * clinic has confirmed, a dashed card for what is estimated.
 */
export function FamilyReferralView({ data, compact = false }: Props) {
  const { referral, estimate, clinic } = data;
  const contactId = compact ? undefined : "contact";

  return (
    <div className={compact ? "space-y-4" : "grid gap-5 lg:grid-cols-3 lg:gap-6"}>
      <div className={compact ? "space-y-4" : "space-y-5 lg:col-span-2 lg:space-y-6"}>
        <StatusCard data={data} compact={compact} />
        {referral.status === "assessment_booked" ? <BookedNextSteps data={data} /> : <EstimateCard data={data} contactHref={contactId ? `#${contactId}` : undefined} />}
        <Journey data={data} />
      </div>
      <aside className={compact ? "space-y-4" : "space-y-5 lg:space-y-6"}>
        <ContactCard id={contactId} referralId={referral.id} clinic={clinic} />
        <WhileYouWait />
        {estimate.status === "available" && <HowEstimated />}
      </aside>
    </div>
  );
}

function StatusCard({ data, compact }: { data: FamilyReferralResponse; compact: boolean }) {
  const { referral, estimate } = data;
  const waited = daysBetween(referral.received_on, estimate.as_of);
  const Icon = referral.status === "on_hold" ? PauseCircle : referral.status === "assessment_booked" ? CalendarCheck : BadgeCheck;
  const explain = {
    waiting_for_assessment: "Your referral is on the waitlist for a first speech-language assessment. You don't need to do anything right now.",
    on_hold: "Your referral is paused but still on the waitlist. It has not been cancelled. Contact the clinic if you're not sure why it's on hold.",
    assessment_booked: "Your first assessment has a confirmed date.",
  }[referral.status];

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Referral status</h2>
        <Chip tone="teal" icon={<BadgeCheck className="size-3.5" aria-hidden />}>
          Confirmed by the clinic
        </Chip>
      </div>
      <div className="mt-4 flex items-start gap-3">
        <span className={`grid size-11 shrink-0 place-items-center rounded-xl ${referral.status === "on_hold" ? "bg-amber-100 text-amber-800" : "bg-teal-100 text-teal-800"}`}>
          <Icon className="size-6" aria-hidden />
        </span>
        <div>
          <p className="text-xl font-semibold text-slate-900 sm:text-2xl">{STATUS_LABEL[referral.status]}</p>
          <p className="mt-1 text-slate-600">{explain}</p>
        </div>
      </div>

      {referral.status === "assessment_booked" && referral.appointment_on && (
        <div className="mt-4 rounded-xl bg-emerald-50 p-4 ring-1 ring-emerald-200">
          <p className="text-sm text-emerald-900">First assessment</p>
          <p className="text-lg font-semibold text-emerald-950">{fmtWeekday(referral.appointment_on)}</p>
          {referral.appointment_site && (
            <p className="mt-1 text-sm text-emerald-900">{referral.appointment_site.name} · {referral.appointment_site.location}</p>
          )}
          <p className="mt-1 text-sm text-emerald-900">The clinic sent you the time and location when they booked it.</p>
        </div>
      )}

      <dl className={`mt-5 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-slate-100 pt-4 text-sm ${compact ? "" : "sm:grid-cols-4"}`}>
        <Fact label="Service" value={referral.service} />
        <Fact label="Referral received" value={fmtLong(referral.received_on)} />
        <Fact label="Waiting so far" value={weeksLabel(waited)} />
        <Fact label="Referral ID" value={<span className="font-mono">{referral.id}</span>} />
      </dl>
    </Card>
  );
}

function Fact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-medium text-slate-900">{value}</dd>
    </div>
  );
}

function EstimateCard({ data, contactHref }: { data: FamilyReferralResponse; contactHref?: string }) {
  const { estimate } = data;

  if (estimate.status === "unavailable" || !estimate.range_weeks) {
    return (
      <Card dashed>
        <EstimateHeader />
        <div className="mt-4 flex items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-600">
            <CircleHelp className="size-6" aria-hidden />
          </span>
          <div>
            <p className="text-xl font-semibold text-slate-900">No wait estimate right now</p>
            <p className="mt-1 text-slate-600">{estimate.message}</p>
          </div>
        </div>
        <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-700 ring-1 ring-slate-200">
          <p className="font-medium text-slate-900">Your place on the waitlist is kept.</p>
          <p className="mt-1">Not having an estimate does not mean your referral was removed or cancelled. We'll show a range here as soon as we can calculate one.</p>
        </div>
        {contactHref && (
          <a href={contactHref} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800">
            <MessageCircleQuestion className="size-4" aria-hidden />
            Questions? Contact the clinic
          </a>
        )}
        <p className="mt-4 text-xs text-slate-500">Checked on {fmtLong(estimate.as_of)}</p>
      </Card>
    );
  }

  const { lower, upper } = estimate.range_weeks;
  const from = addWeeks(estimate.as_of, lower);
  const to = addWeeks(estimate.as_of, upper);

  return (
    <Card dashed>
      <EstimateHeader />
      <p className="mt-4 text-slate-600">Estimated time until your child's first speech-language assessment:</p>
      <p className="mt-1 text-3xl font-bold tracking-tight text-indigo-950 sm:text-4xl">
        About {lower}–{upper} more weeks
      </p>
      <p className="mt-2 text-slate-700">
        Most likely between <strong>{fmtLong(from)}</strong> and <strong>{fmtLong(to)}</strong>.
      </p>

      <RangeBar asOf={estimate.as_of} lower={lower} upper={upper} />

      <div className="mt-5 flex items-start gap-3 rounded-xl bg-amber-50 p-4 text-sm text-amber-950 ring-1 ring-amber-200">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
        <p>
          <strong>This is not an appointment.</strong> {estimate.message}
        </p>
      </div>

      <details className="group mt-4 rounded-xl border border-slate-200">
        <summary className="flex cursor-pointer items-center justify-between gap-2 px-4 py-3 text-sm font-medium text-slate-800">
          Why might this change?
          <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden />
        </summary>
        <ul className="list-disc space-y-1 px-4 pb-4 pl-9 text-sm text-slate-600">
          <li>More or fewer assessment appointments open up (for example, a clinician joins or is away).</li>
          <li>Other families cancel or reschedule.</li>
          <li>Some children with more urgent needs are seen sooner.</li>
          <li>Your referral is put on hold, for example while waiting for other test results.</li>
        </ul>
      </details>

      <p className="mt-4 flex items-center gap-1.5 text-xs text-slate-500">
        <Clock className="size-3.5" aria-hidden />
        Calculated on {fmtLong(estimate.as_of)}. Updated when the clinic's availability changes.
      </p>
    </Card>
  );
}

function EstimateHeader() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Wait estimate</h2>
      <Chip tone="indigo" icon={<Sparkles className="size-3.5" aria-hidden />}>
        Estimate · may change
      </Chip>
    </div>
  );
}

function RangeBar({ asOf, lower, upper }: { asOf: string; lower: number; upper: number }) {
  const max = Math.max(12, Math.ceil((upper + 2) / 4) * 4);
  const pct = (w: number) => `${(w / max) * 100}%`;
  const ticks = Array.from({ length: max / 4 + 1 }, (_, i) => i * 4);

  return (
    <div className="mt-6" aria-hidden>
      <div className="relative h-3 rounded-full bg-slate-100">
        <div className="absolute inset-y-0 rounded-full bg-indigo-500/80" style={{ left: pct(lower), width: `calc(${pct(upper)} - ${pct(lower)})` }} />
        <div className="absolute -top-1.5 h-6 w-1 -translate-x-1/2 rounded bg-slate-800" style={{ left: 0 }} />
      </div>
      <div className="relative mt-2 h-8 text-xs text-slate-500">
        {ticks.map((t) => (
          <span
            key={t}
            className={`absolute -translate-x-1/2 whitespace-nowrap ${t === 0 ? "translate-x-0 font-medium text-slate-800" : ""} ${t === max ? "-translate-x-full" : ""}`}
            style={{ left: pct(t) }}
          >
            {t === 0 ? "Today" : `${t} wk`}
            <span className="block text-[10px] text-slate-400">{fmtShort(addWeeks(asOf, t))}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function BookedNextSteps({ data }: { data: FamilyReferralResponse }) {
  return (
    <Card>
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Before your appointment</h2>
      <ul className="mt-3 space-y-2 text-slate-700">
        <li className="flex gap-2"><CalendarCheck className="mt-0.5 size-4 shrink-0 text-teal-700" aria-hidden />Check the time and location in the booking message from {data.clinic.name ?? "the clinic"}.</li>
        <li className="flex gap-2"><CalendarClock className="mt-0.5 size-4 shrink-0 text-teal-700" aria-hidden />Can't make it? Let the clinic know early so another family can use the time.</li>
      </ul>
    </Card>
  );
}

function Journey({ data }: { data: FamilyReferralResponse }) {
  const { referral } = data;
  const booked = referral.status === "assessment_booked";
  const steps = [
    { label: "Referral received", detail: fmtLong(referral.received_on), state: "done" },
    {
      label: referral.status === "on_hold" ? "On the waitlist (on hold)" : "On the waitlist",
      detail: booked ? "Done" : "You are here",
      state: booked ? "done" : "current",
    },
    { label: "Appointment booked", detail: booked && referral.appointment_on ? `For ${fmtLong(referral.appointment_on)}` : "The clinic contacts you", state: booked ? "current" : "todo" },
    { label: "First assessment", detail: "With a speech-language pathologist", state: "todo" },
  ] as const;

  return (
    <Card>
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Your referral's steps</h2>
      <ol className="mt-4 grid gap-0 sm:grid-cols-4 sm:gap-3">
        {steps.map((s, i) => (
          <li key={s.label} className="relative flex gap-3 pb-5 last:pb-0 sm:flex-col sm:pb-0">
            {i < steps.length - 1 && (
              <span className={`absolute left-[11px] top-6 h-[calc(100%-1.5rem)] w-0.5 sm:left-6 sm:top-[11px] sm:h-0.5 sm:w-[calc(100%-0.75rem)] ${s.state === "done" ? "bg-teal-600" : "bg-slate-200"}`} aria-hidden />
            )}
            <span
              className={`relative z-10 grid size-6 shrink-0 place-items-center rounded-full text-xs font-bold ${
                s.state === "done" ? "bg-teal-600 text-white" : s.state === "current" ? "bg-white text-teal-700 ring-4 ring-teal-500" : "bg-slate-200 text-slate-500"
              }`}
            >
              {s.state === "done" ? "✓" : i + 1}
            </span>
            <div>
              <p className={`font-medium ${s.state === "todo" ? "text-slate-500" : "text-slate-900"}`}>{s.label}</p>
              <p className={`text-sm ${s.state === "current" ? "font-medium text-teal-700" : "text-slate-500"}`}>{s.detail}</p>
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}

function ContactCard({ id, referralId, clinic }: { id?: string; referralId: string; clinic: FamilyReferralResponse["clinic"] }) {
  return (
    <Card id={id} className="scroll-mt-20">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Questions? Contact the clinic</h2>
      {clinic.name && <p className="mt-3 font-semibold text-slate-900">{clinic.name}</p>}
      <p className="text-sm text-slate-600">Waitlist and intake team</p>
      <div className="mt-4 space-y-2">
        <a href={`mailto:${clinic.contact}?subject=Referral ${referralId}`} className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 hover:border-teal-300 hover:bg-teal-50">
          <Mail className="size-5 text-teal-700" aria-hidden />
          <span>
            <span className="block text-sm text-slate-500">Email</span>
            <span className="font-medium text-slate-900">{clinic.contact}</span>
          </span>
        </a>
        {clinic.phone && (
          <a href={`tel:${clinic.phone}`} className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 hover:border-teal-300 hover:bg-teal-50">
            <Phone className="size-5 text-teal-700" aria-hidden />
            <span>
              <span className="block text-sm text-slate-500">Phone{clinic.hours ? ` · ${clinic.hours}` : ""}</span>
              <span className="font-medium text-slate-900">{clinic.phone}</span>
            </span>
          </a>
        )}
      </div>
      <p className="mt-3 text-sm text-slate-600">
        Have your referral ID ready: <span className="font-mono font-medium text-slate-900">{referralId}</span>
      </p>
    </Card>
  );
}

function WhileYouWait() {
  const items = [
    { icon: Library, title: "Play & Talk drop-in", where: "Riverside Public Library · Saturdays 10–11:30", note: "Songs, books and play, run by supervised students in child development programs." },
    { icon: Users, title: "Parent coffee circle", where: "Northfield Community Centre · Wednesdays 6–7 pm", note: "Meet other families who are waiting for services." },
  ];
  return (
    <Card>
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">While you wait</h2>
      <p className="mt-2 text-sm text-slate-600">Free community programs near you. These are general activities, not a replacement for the assessment.</p>
      <ul className="mt-4 space-y-3">
        {items.map(({ icon: Icon, title, where, note }) => (
          <li key={title} className="flex gap-3 rounded-xl bg-slate-50 p-3">
            <Icon className="mt-0.5 size-5 shrink-0 text-teal-700" aria-hidden />
            <div>
              <p className="font-medium text-slate-900">{title}</p>
              <p className="text-sm text-slate-600">{where}</p>
              <p className="mt-1 text-sm text-slate-500">{note}</p>
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-slate-400">Example programs for the prototype.</p>
    </Card>
  );
}

function HowEstimated() {
  return (
    <Card>
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">How we estimate</h2>
      <p className="mt-2 text-sm text-slate-600">
        We look at how many families are ahead of you and how many first-assessment appointments the clinic expects to offer each week. We run that forward many times with normal ups and downs, like cancellations or staff time off.
      </p>
      <p className="mt-2 text-sm text-slate-600">The range covers most of those outcomes. About 1 in 10 families may be seen sooner, and about 1 in 10 may wait longer.</p>
      <p className="mt-2 text-sm text-slate-600">The estimate doesn't use your child's diagnosis or personal details.</p>
    </Card>
  );
}
