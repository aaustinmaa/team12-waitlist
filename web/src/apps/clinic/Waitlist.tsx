import { useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  Bell,
  CalendarCheck,
  ClipboardCheck,
  Eye,
  FileWarning,
  History,
  ListOrdered,
  Minus,
  PauseCircle,
  Plus,
  Search,
  SearchX,
  SlidersHorizontal,
  ShieldCheck,
  X,
} from "lucide-react";
import { clinicianName, getFamilyReferral, listQueue, type ClinicView } from "../../lib/api";
import { useDemo } from "../../lib/demoState";
import { fmtLong, fmtShort } from "../../lib/dates";
import { PRIORITIES, type Notice, type Priority, type StaffRow } from "../../lib/types";
import { FamilyReferralView } from "../../components/FamilyReferralView";
import {
  btn,
  Card,
  CardHeading,
  Chip,
  DISABLED,
  EmptyState,
  IconBadge,
  MetricKey,
  PRIORITY_ICON,
  PRIORITY_LABEL,
  PRIORITY_ORDER_NOTE,
  PRIORITY_STYLE,
  PriorityBadge,
  REASON_LABEL,
  STATUS_LABEL,
  STATUS_TONE,
  StatCard,
  SuccessNote,
  weeksLabel,
} from "../../components/ui";
import { downloadCsv, toCsv } from "../../lib/csv";
import { CAN } from "../../platform/clinics";
import { useClinicView, usePlatform } from "../../platform/store";
import { NoDataYet } from "./ClinicShell";

type Filter = "all" | "ready" | "hold" | "intake" | "booked";

const FILTERS: { key: Filter; label: string; test: (r: StaffRow) => boolean }[] = [
  { key: "all", label: "All", test: () => true },
  { key: "ready", label: "Ready to book", test: (r) => r.position !== null },
  { key: "intake", label: "Needs intake info", test: (r) => r.status === "waiting_for_assessment" && !r.intake_complete },
  { key: "hold", label: "On hold", test: (r) => r.status === "on_hold" },
  { key: "booked", label: "Booked", test: (r) => r.status === "assessment_booked" },
];

export function Waitlist() {
  const v = useClinicView();
  if (!v) return <NoDataYet />;
  return <WaitlistBody v={v} />;
}

/** A coloured edge on urgent and high rows, so the top of the line reads at a glance. */
const ROW_EDGE: Record<Priority, string> = {
  urgent: "[&>td:first-child]:border-s-[3px] [&>td:first-child]:border-rose-400",
  high: "[&>td:first-child]:border-s-[3px] [&>td:first-child]:border-amber-400",
  standard: "",
};

const REASONS = ["Clinical review of the referral", "New information from the referrer or family", "Correcting a data-entry error", "Other"];

function WaitlistBody({ v }: { v: ClinicView }) {
  const { state, setExtraSlots, completeIntake, setPriority } = useDemo();
  const p = usePlatform();
  const canEdit = !!p.staff && CAN.editWaitlist(p.staff.role);
  const rows = useMemo(() => listQueue(v), [v]);
  const newRange = v.newReferral;
  const [pending, setPending] = useState<{ id: string; from: Priority; to: Priority } | null>(null);
  const askPriority = (id: string, to: Priority) => {
    const from = rows.find((r) => r.id === id)?.priority ?? "standard";
    if (from !== to) setPending({ id, from, to });
  };
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const counts = Object.fromEntries(FILTERS.map((f) => [f.key, rows.filter(f.test).length])) as Record<Filter, number>;
  const active = FILTERS.find((f) => f.key === filter)!;
  const shown = rows
    .filter(active.test)
    .filter((r) => r.id.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => (a.position ?? 999) - (b.position ?? 999) || a.received_on.localeCompare(b.received_on));
  const openPreview = (id: string) => {
    setPreviewId(id);
    p.log(v.id, "Viewed family preview", id, id);
  };
  const actions = { onPreview: openPreview, onComplete: completeIntake, canEdit };

  const preview = previewId ? getFamilyReferral(v, previewId) : null;

  useEffect(() => {
    if (!previewId) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setPreviewId(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [previewId]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Chip tone="teal" icon={<ShieldCheck className="size-3.5" aria-hidden />}>Staff only</Chip>
            <span className="text-sm text-slate-500">Intake team · {v.info.name}</span>
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Waitlist</h1>
          <p className="mt-1 text-slate-600">{v.info.service} · first-assessment waitlist · data as of {fmtLong(v.asOf)}</p>
        </div>
        <MetricKey kinds={["count", "wait", "estimate"]} />
      </div>

      {!v.model.gate.familyVisible && (
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Families at this clinic are not shown wait ranges yet: the estimates haven't passed the back-test ({v.model.gate.failed.join("; ")}). Staff still see the ranges below, marked "staff only". See the Estimates page.
        </p>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-3 lg:gap-6">
        <ScenarioCard extra={state.extraSlots} setExtra={setExtraSlots} baseline={v.model.params.meanThroughput} canEdit={canEdit} />
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:col-span-2 xl:grid-cols-4">
          {/* Children counted, so the figures are ink; the icon carries the status colour used in the table below. */}
          <StatCard icon={ListOrdered} label="Ready to book" value={counts.ready} sub="in line for a first assessment" accent="wait" />
          <StatCard icon={FileWarning} label="Needs intake info" value={counts.intake} sub="no estimate shown to family" accent="attention" />
          <StatCard icon={PauseCircle} label="On hold" value={counts.hold} sub="still on the waitlist" accent="attention" />
          <StatCard icon={CalendarCheck} label="Booked" value={counts.booked} sub="first assessment scheduled" accent="quality" />
          <div className="col-span-2 rounded-2xl border border-indigo-200 bg-indigo-50/50 p-4 xl:col-span-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium text-slate-700">
                {v.model.gate.familyVisible ? "A family referred today would be told" : "Range for a family referred today (staff only until the estimates pass the back-test)"}
              </p>
              <p className="flex items-center gap-1 text-xs text-slate-500">
                <ArrowDown className="size-3.5" aria-hidden /> Line order: urgent, then high, then standard
              </p>
            </div>
            {/* Same size for every priority: the colour, icon and order say which is which. */}
            <dl className="mt-3 grid gap-2 sm:grid-cols-3">
              {PRIORITIES.map((p, i) => {
                const Icon = PRIORITY_ICON[p];
                return (
                  <div key={p} className={`rounded-xl border-s-4 bg-white px-3 py-2.5 ${PRIORITY_STYLE[p].edge}`}>
                    <dt className={`flex items-center gap-1.5 text-xs font-semibold ${PRIORITY_STYLE[p].text}`}>
                      <Icon className="size-3.5" aria-hidden />
                      {i + 1}. {PRIORITY_LABEL[p]} priority
                    </dt>
                    <dd className="mt-0.5 text-xl font-semibold tracking-tight text-indigo-800">
                      {newRange[p] ? `${newRange[p]!.lower}–${newRange[p]!.upper} wk` : "Too long to estimate"}
                    </dd>
                    <dd className="text-xs text-slate-500">{PRIORITY_ORDER_NOTE[p]}</dd>
                  </div>
                );
              })}
            </dl>
            <p className="mt-2 text-sm text-slate-500">
              {state.extraSlots === 0
                ? `based on how this clinic's line actually moved over the last ${v.model.params.windowWeeks} weeks.`
                : `if the clinic offers ${state.extraSlots > 0 ? "+" : ""}${state.extraSlots} first assessments a week compared with recent weeks.`}{" "}
              Higher priorities join the line ahead of standard referrals.
            </p>
          </div>
        </div>
      </div>

      <Card className="mt-6 !p-0">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:p-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <IconBadge icon={ListOrdered} />
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Waitlist</h2>
              <p className="text-sm text-slate-500">Ordered by priority, then referral date. Clinical staff set the priority; a change moves the line and every estimate behind it.</p>
            </div>
          </div>
          <label className="relative block min-w-0 md:w-64">
            <span className="sr-only">Search referral ID</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSaved(null);
              }}
              placeholder="Search referral ID"
              className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-teal-500"
            />
          </label>
        </div>
        <div className="flex gap-1 overflow-x-auto border-b border-slate-200 px-4 py-2 sm:px-5" role="tablist" aria-label="Filter waitlist">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              role="tab"
              aria-selected={filter === f.key}
              onClick={() => {
                setFilter(f.key);
                setSaved(null);
              }}
              className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium ${filter === f.key ? "bg-teal-50 text-teal-800 ring-1 ring-inset ring-teal-200" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"}`}
            >
              {f.label} <span className={filter === f.key ? "text-teal-600" : "text-slate-400"}>{counts[f.key]}</span>
            </button>
          ))}
        </div>

        {/* Download sits with the list it downloads, and says which rows go in the file. */}
        <div className="flex flex-col gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <p role="status" className="text-sm text-slate-600">
            {saved ? (
              <SuccessNote>
                Downloaded <span className="font-medium">{saved}</span>. Look in your Downloads folder.
              </SuccessNote>
            ) : (
              <>
                Download the {shown.length} {shown.length === 1 ? "referral" : "referrals"} shown below as a spreadsheet (.csv) for Excel or Google Sheets. Referral IDs only, no names.
              </>
            )}
          </p>
          <button
            onClick={() => {
              setSaved(exportWaitlist(v, shown, filter, state.extraSlots));
              p.log(v.id, "Downloaded waitlist", `${shown.length} rows (${filter})`);
            }}
            disabled={shown.length === 0}
            className={btn("primary", "shrink-0")}
          >
            Download spreadsheet
          </button>
        </div>

        {/* Desktop table */}
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-[0.6875rem] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-3 font-semibold">#</th>
                <th className="px-3 py-3 font-medium">Referral</th>
                <th className="px-3 py-3 font-medium">Received</th>
                <th className="px-3 py-3 font-medium" title="Calendar time since the referral was received. Time on hold is shown underneath and is part of this total.">Waiting</th>
                <th className="hidden px-3 py-3 font-medium xl:table-cell">Age · Source</th>
                <th className="px-3 py-3 font-medium">Status</th>
                <th className="px-3 py-3 font-medium">Priority</th>
                <th className="px-3 py-3 font-medium">Family sees</th>
                <th className="px-5 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {shown.map((r) => (
                <tr
                  key={r.id}
                  className={`transition-colors duration-150 ${r.needs_review ? "bg-amber-50/60 hover:bg-amber-50" : "hover:bg-teal-50/50"} ${ROW_EDGE[r.priority]}`}
                >
                  <td className="px-5 py-3 text-slate-500">{r.position ?? "–"}</td>
                  <td className="whitespace-nowrap px-3 py-3 font-mono font-medium text-slate-900">{r.id}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-slate-700">{fmtShort(r.received_on)}</td>
                  <td className="whitespace-nowrap px-3 py-3 font-medium text-teal-800">
                    {weeksLabel(r.days_waiting)}
                    {r.days_on_hold > 0 && <span className="block text-xs text-amber-800">{weeksLabel(r.days_on_hold)} on hold</span>}
                  </td>
                  <td className="hidden px-3 py-3 text-slate-600 xl:table-cell"><span className="whitespace-nowrap">{r.age_group}</span><span className="block text-xs text-slate-400">{r.referral_source}</span></td>
                  <td className="px-3 py-3"><StatusCell v={v} r={r} /></td>
                  <td className="px-3 py-3"><PriorityCell r={r} onChange={askPriority} canEdit={canEdit} /></td>
                  <td className="px-3 py-3"><EstimateCell r={r} /></td>
                  <td className="px-5 py-3"><RowActions r={r} {...actions} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Phone cards */}
        <ul className="divide-y divide-slate-100 md:hidden">
          {shown.map((r) => (
            <li key={r.id} className={`p-4 ${r.needs_review ? "bg-amber-50/60" : ""}`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-mono font-medium text-slate-900">
                    {r.position && <span className="mr-2 text-slate-400">#{r.position}</span>}
                    {r.id}
                  </p>
                  <p className="text-sm text-slate-500">
                    Received {fmtShort(r.received_on)} · {weeksLabel(r.days_waiting)}
                    {r.days_on_hold > 0 && <span className="text-amber-800"> ({weeksLabel(r.days_on_hold)} on hold)</span>}
                  </p>
                </div>
                <StatusCell v={v} r={r} />
              </div>
              <div className="mt-3 flex items-center gap-2 text-sm">
                <span className="text-slate-500">Priority</span>
                <PriorityCell r={r} onChange={askPriority} canEdit={canEdit} />
              </div>
              <div className="mt-2 flex items-end justify-between gap-2">
                <div className="text-sm"><span className="text-slate-500">Family sees: </span><EstimateCell r={r} /></div>
                <RowActions r={r} {...actions} />
              </div>
            </li>
          ))}
        </ul>
        {shown.length === 0 && (
          <EmptyState icon={SearchX} title="No referrals match">
            {query.trim() ? `Nothing in "${active.label}" has an ID containing "${query.trim()}".` : `No referrals are in "${active.label}" right now.`}
          </EmptyState>
        )}
      </Card>

      <Outbox notices={state.notices} />
      <PriorityLog log={state.priorityLog} />

      {pending && (
        <PriorityDialog
          change={pending}
          onCancel={() => setPending(null)}
          onConfirm={(reason) => {
            setPriority(pending.id, pending.to, reason);
            setPending(null);
          }}
        />
      )}

      {preview && (
        <div className="fixed inset-0 z-40 flex justify-end bg-black/50" onClick={() => setPreviewId(null)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Family view preview for ${preview.referral.id}`}
            className="flex h-full w-full flex-col bg-slate-50 shadow-2xl sm:max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-white px-4 py-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Family view preview</p>
                <p className="font-mono font-semibold text-slate-900">{preview.referral.id}</p>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => setPreviewId(null)} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100" aria-label="Close preview">
                  <X className="size-5" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <FamilyReferralView data={preview} compact />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Downloads the rows currently shown (filter and search applied). No names, only referral IDs. */
function exportWaitlist(v: ClinicView, rows: StaffRow[], filter: Filter, extra: number): string {
  const header = [
    "place_in_line",
    "referral_id",
    "received_on",
    "days_waiting",
    "days_on_hold",
    "days_waiting_excluding_hold",
    "age_group",
    "referral_source",
    "status",
    "priority",
    "intake_complete",
    "hold_start",
    "hold_end",
    "hold_reason",
    "appointment_on",
    "appointment_time",
    "clinician",
    "family_sees",
    "estimate_lower_weeks",
    "estimate_upper_weeks",
    "no_estimate_reason",
    "estimate_as_of",
    "scenario_extra_slots_per_week",
    "needs_review",
  ];
  const body = rows.map((r) => [
    r.position,
    r.id,
    r.received_on,
    r.days_waiting,
    r.days_on_hold,
    r.days_waiting - r.days_on_hold,
    r.age_group,
    r.referral_source,
    STATUS_LABEL[r.status],
    PRIORITY_LABEL[r.priority],
    r.intake_complete ? "yes" : "no",
    r.hold?.start,
    r.hold?.end,
    r.hold?.reason,
    r.appointment_on,
    r.appointment?.start_time,
    clinicianName(v, r.appointment?.clinician_id),
    r.estimate.range_weeks ? "estimate" : r.estimate.reason === "booked" ? "confirmed date" : "no estimate",
    r.estimate.range_weeks?.lower,
    r.estimate.range_weeks?.upper,
    r.estimate.reason && r.estimate.reason !== "booked" ? REASON_LABEL[r.estimate.reason] : null,
    r.estimate.as_of,
    extra,
    r.needs_review ? "yes" : "no",
  ]);
  const name = filter === "all" ? "waitlist" : `waitlist-${filter}`;
  const filename = `${name}-${v.asOf}.csv`;
  downloadCsv(filename, toCsv(header, body));
  return filename;
}

/**
 * A planning scenario on top of the clinic's real recent capacity. The
 * baseline is never typed in: it is what the clinic actually did.
 */
function ScenarioCard({ extra, setExtra, baseline, canEdit }: { extra: number; setExtra: (n: number) => void; baseline: number; canEdit: boolean }) {
  return (
    <Card>
      <CardHeading icon={SlidersHorizontal}>Capacity scenario</CardHeading>
      <p className="mt-2 text-sm text-slate-600">
        Recently the clinic did about <strong className="text-slate-900">{baseline.toFixed(1)}</strong> first assessments a week. Try what more or fewer would do.
      </p>
      <div className="mt-4 flex items-center justify-between gap-3">
        <button onClick={() => setExtra(extra - 1)} disabled={!canEdit || extra <= -5} className={`grid size-11 place-items-center rounded-xl ring-1 ring-inset ring-slate-300 hover:bg-slate-50 ${DISABLED}`} aria-label="Fewer a week">
          <Minus className="size-5" />
        </button>
        <p className="text-center">
          <span className="block text-4xl font-bold tabular-nums text-slate-900">
            {extra > 0 ? "+" : ""}
            {extra}
          </span>
          <span className="text-sm text-slate-500">a week vs recent weeks</span>
        </p>
        <button onClick={() => setExtra(extra + 1)} disabled={!canEdit || extra >= 10} className={`grid size-11 place-items-center rounded-xl ring-1 ring-inset ring-slate-300 hover:bg-slate-50 ${DISABLED}`} aria-label="More a week">
          <Plus className="size-5" />
        </button>
      </div>
      <input type="range" min={-5} max={10} value={extra} disabled={!canEdit} onChange={(e) => setExtra(Number(e.target.value))} className="mt-4 w-full accent-teal-700" aria-label="Extra first assessments a week" />
      <div className="flex justify-between text-xs text-slate-400">
        <span>−5</span>
        <span>0 = as recent weeks</span>
        <span>+10</span>
      </div>
      {extra !== 0 ? (
        <p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">
          Scenario on: families' estimates now assume this change. Set it back to 0 unless the extra (or lost) capacity is confirmed.
          <button onClick={() => setExtra(0)} disabled={!canEdit} className="ml-1 font-semibold underline">
            Back to 0
          </button>
        </p>
      ) : (
        <p className="mt-3 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">Estimates use the clinic's real weekly numbers from its own data, not a number typed in here.</p>
      )}
    </Card>
  );
}

function StatusCell({ v, r }: { v: ClinicView; r: StaffRow }) {
  return (
    <div className="flex flex-col items-start gap-1">
      <Chip tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Chip>
      {r.needs_review && <Chip tone="amber">Missing from latest export · check</Chip>}
      {r.status === "waiting_for_assessment" && !r.intake_complete && <Chip tone="amber">Intake info incomplete</Chip>}
      {r.hold && (
        <span className="text-xs text-slate-500">
          {r.hold.end ? `Was on hold ${fmtShort(r.hold.start)}–${fmtShort(r.hold.end)}` : `Since ${fmtShort(r.hold.start)}: ${r.hold.reason}`}
        </span>
      )}
      {r.appointment_on && (
        <span className="text-xs text-slate-500">
          On {fmtShort(r.appointment_on)}
          {r.appointment && ` at ${r.appointment.start_time} · ${clinicianName(v, r.appointment.clinician_id) ?? ""}`}
        </span>
      )}
    </div>
  );
}

function EstimateCell({ r }: { r: StaffRow }) {
  const range = r.estimate.range_weeks;
  if (range) return <span className="whitespace-nowrap font-semibold text-indigo-900">{range.lower}–{range.upper} wk</span>;
  if (r.estimate.reason === "booked" && r.appointment_on) return <span className="text-emerald-800">Confirmed date · {fmtShort(r.appointment_on)}</span>;
  if (r.estimate.reason === "insufficient_data" && r.staff_range)
    return (
      <span className="text-amber-900" title="Not shown to the family until the estimates pass the back-test">
        <span className="whitespace-nowrap font-semibold">{r.staff_range.lower}–{r.staff_range.upper} wk</span>
        <span className="block text-xs">staff only</span>
      </span>
    );
  return <span className="text-slate-500">No estimate · {REASON_LABEL[r.estimate.reason ?? "intake_incomplete"]}</span>;
}

function RowActions({ r, onPreview, onComplete, canEdit }: { r: StaffRow; onPreview: (id: string) => void; onComplete: (id: string) => void; canEdit: boolean }) {
  const needsIntake = canEdit && r.status === "waiting_for_assessment" && !r.intake_complete;
  return (
    <div className="flex shrink-0 justify-end gap-1.5">
      {needsIntake && (
        <button onClick={() => onComplete(r.id)} className={btn("soft", "px-2.5 py-1.5 text-xs font-medium")} title="Mark intake information as complete">
          <ClipboardCheck className="size-3.5" aria-hidden /> Intake done
        </button>
      )}
      <button onClick={() => onPreview(r.id)} className={btn("outline", "px-2.5 py-1.5 text-xs font-medium")}>
        <Eye className="size-3.5" aria-hidden /> Preview
      </button>
    </div>
  );
}

/** Clinical priority. Staff can change it for referrals still waiting; a booked referral's is fixed. */
function PriorityCell({ r, onChange, canEdit }: { r: StaffRow; onChange: (id: string, p: Priority) => void; canEdit: boolean }) {
  if (r.status === "assessment_booked" || !canEdit) return <PriorityBadge priority={r.priority} />;
  const Icon = PRIORITY_ICON[r.priority];
  return (
    <label className="relative inline-flex items-center">
      <span className="sr-only">Priority for {r.id}</span>
      <Icon className={`pointer-events-none absolute start-2 size-3.5 ${PRIORITY_STYLE[r.priority].text}`} aria-hidden />
      <select
        value={r.priority}
        onChange={(e) => onChange(r.id, e.target.value as Priority)}
        className={`rounded-lg border py-1 pe-2 ps-6 text-xs font-medium outline-none hover:brightness-[0.97] focus-visible:border-teal-500 ${PRIORITY_STYLE[r.priority].field}`}
      >
        {PRIORITIES.map((p) => (
          <option key={p} value={p}>
            {PRIORITY_LABEL[p]}
          </option>
        ))}
      </select>
    </label>
  );
}

const NOTICE_LABEL: Record<Notice["kind"], string> = {
  estimate_ready: "Estimate ready",
  estimate_changed: "Estimate changed",
  estimate_paused: "Estimate paused",
};
const CHANNEL_LABEL = { email: "email", sms: "text", browser: "device" } as const;

/**
 * What families were told after a staff change. Families hear about a new
 * estimate, one that moved by 2 weeks or more, or one that can no longer be
 * shown; small shifts are not announced.
 */
function Outbox({ notices }: { notices: Notice[] }) {
  const [all, setAll] = useState(false);
  const shown = all ? notices : notices.slice(0, 6);
  return (
    <Card className="mt-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-3 text-lg font-semibold text-slate-900">
          <IconBadge icon={Bell} />
          Updates sent to families
        </h2>
        <span className="text-sm text-slate-500">{notices.length} sent</span>
      </div>
      <p className="mt-1 text-sm text-slate-600">
        Sent automatically when a family's estimate becomes available, moves by 2 weeks or more, or can no longer be shown. Each family chooses email, text or device notifications on their page.
      </p>
      {notices.length === 0 ? (
        <div className="mt-4 rounded-xl bg-slate-50">
          <EmptyState icon={Bell} title="Nothing sent yet">
            Updates go out after an import changes estimates, or after a staff change (intake done, priority, capacity scenario).
          </EmptyState>
        </div>
      ) : (
        <>
          <ul className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-200">
            {shown.map((n) => (
              <li key={n.id} className="flex flex-col gap-1 px-4 py-2.5 text-sm sm:flex-row sm:items-center sm:gap-4">
                <span className="w-24 shrink-0 font-mono font-medium text-slate-900">{n.referral_id}</span>
                <span className="flex-1 text-slate-700">
                  <span className="font-medium">{NOTICE_LABEL[n.kind]}</span>
                  {n.range && (
                    <>
                      {" · "}
                      {n.previous ? `${n.previous.lower}–${n.previous.upper} → ` : ""}
                      {n.range.lower}–{n.range.upper} wk
                    </>
                  )}
                  {!n.range && n.reason && ` · ${REASON_LABEL[n.reason]}`}
                </span>
                <span className="text-xs text-slate-500">
                  {n.channels.length ? n.channels.map((c) => CHANNEL_LABEL[c]).join(", ") : "page only"} ·{" "}
                  {new Date(n.at).toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit" })}
                </span>
              </li>
            ))}
          </ul>
          {notices.length > 6 && (
            <button type="button" onClick={() => setAll(!all)} className="mt-2 text-sm font-medium text-teal-700 underline underline-offset-2">
              {all ? "Show fewer" : `Show all ${notices.length}`}
            </button>
          )}
        </>
      )}
      <p className="mt-3 text-xs text-slate-400">Prototype: emails and texts are recorded here, not actually sent.</p>
    </Card>
  );
}

/** Every priority change needs a reason; it goes in the change log and the audit log. */
function PriorityDialog({ change, onCancel, onConfirm }: { change: { id: string; from: Priority; to: Priority }; onCancel: () => void; onConfirm: (reason: string) => void }) {
  const [reason, setReason] = useState(REASONS[0]);
  const [note, setNote] = useState("");
  const full = reason === "Other" ? note.trim() : note.trim() ? `${reason}: ${note.trim()}` : reason;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={onCancel}>
      <div role="dialog" aria-modal="true" aria-label="Confirm priority change" className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold text-slate-900">Change priority for {change.id}?</h2>
        <p className="mt-1 text-sm text-slate-600">
          {PRIORITY_LABEL[change.from]} → <strong>{PRIORITY_LABEL[change.to]}</strong>. This moves the line and every estimate behind it, and families whose range moves by 2 weeks or more are told.
        </p>
        <fieldset className="mt-4 space-y-2">
          <legend className="text-sm font-medium text-slate-800">Reason</legend>
          {REASONS.map((r) => (
            <label key={r} className="flex items-center gap-2 text-sm text-slate-700">
              <input type="radio" name="reason" checked={reason === r} onChange={() => setReason(r)} className="accent-teal-700" />
              {r}
            </label>
          ))}
        </fieldset>
        <label className="mt-3 block">
          <span className="text-sm font-medium text-slate-800">Note {reason === "Other" ? "(required)" : "(optional)"}</span>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-500" placeholder="No names or health details" />
        </label>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onCancel} className={btn("outline")}>
            Cancel
          </button>
          <button onClick={() => onConfirm(full)} disabled={!full} className={btn("primary")}>
            Change priority
          </button>
        </div>
      </div>
    </div>
  );
}

function PriorityLog({ log }: { log: { referral_id: string; from: Priority; to: Priority; reason: string; by: string; at: string }[] }) {
  if (log.length === 0) return null;
  return (
    <Card className="mt-6">
      <h2 className="flex items-center gap-3 text-lg font-semibold text-slate-900">
        <IconBadge icon={History} />
        Priority changes
      </h2>
      <p className="mt-1 text-sm text-slate-600">Every change, who made it and why. Also in the audit log.</p>
      <ul className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-200">
        {log.slice(0, 10).map((c) => (
          <li key={c.at + c.referral_id} className="flex flex-col gap-1 px-4 py-2.5 text-sm sm:flex-row sm:items-center sm:gap-4">
            <span className="w-28 shrink-0 font-mono font-medium text-slate-900">{c.referral_id}</span>
            <span className="flex flex-1 flex-wrap items-center gap-1.5 text-slate-700">
              <PriorityBadge priority={c.from} /> → <PriorityBadge priority={c.to} /> <span>· {c.reason}</span>
            </span>
            <span className="text-xs text-slate-500">
              {c.by} · {new Date(c.at).toLocaleString("en-CA", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
