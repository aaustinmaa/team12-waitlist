import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import {
  Bell,
  CalendarCheck,
  ClipboardCheck,
  ExternalLink,
  Eye,
  FileWarning,
  ListOrdered,
  Minus,
  PauseCircle,
  Plus,
  RotateCcw,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import { AS_OF, CLINIC, DEFAULT_SLOTS, clinicianName, getFamilyReferral, listQueue, newReferralEstimate } from "../lib/api";
import { useDemo } from "../lib/demoState";
import { fmtLong, fmtShort } from "../lib/dates";
import { PRIORITIES, type Notice, type Priority, type StaffRow } from "../lib/types";
import { FamilyReferralView } from "../components/FamilyReferralView";
import { StaffTabs } from "../components/StaffTabs";
import { btn, Card, Chip, DISABLED, PRIORITY_LABEL, PRIORITY_TONE, REASON_LABEL, STATUS_LABEL, STATUS_TONE, weeksLabel } from "../components/ui";
import { downloadCsv, toCsv } from "../lib/csv";

type Filter = "all" | "ready" | "hold" | "intake" | "booked";

const FILTERS: { key: Filter; label: string; test: (r: StaffRow) => boolean }[] = [
  { key: "all", label: "All", test: () => true },
  { key: "ready", label: "Ready to book", test: (r) => r.position !== null },
  { key: "intake", label: "Needs intake info", test: (r) => r.status === "waiting_for_assessment" && !r.intake_complete },
  { key: "hold", label: "On hold", test: (r) => r.status === "on_hold" },
  { key: "booked", label: "Booked", test: (r) => r.status === "assessment_booked" },
];

export function StaffDashboard() {
  const { state, setSlots, completeIntake, setPriority, reset, isPristine } = useDemo();
  const rows = useMemo(() => listQueue(state), [state]);
  const newRange = useMemo(() => newReferralEstimate(state), [state]);
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
  const actions = { onPreview: setPreviewId, onComplete: completeIntake, onPriority: setPriority };

  const preview = previewId ? getFamilyReferral(previewId, state) : null;

  useEffect(() => {
    if (!previewId) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setPreviewId(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [previewId]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      <StaffTabs />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Chip tone="rose" icon={<ShieldCheck className="size-3.5" aria-hidden />}>Staff only</Chip>
            <span className="text-sm text-slate-500">Intake team · {CLINIC.name}</span>
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Staff dashboard</h1>
          <p className="mt-1 text-slate-600">{CLINIC.service} · first-assessment waitlist · data as of {fmtLong(AS_OF)}</p>
        </div>
        <button onClick={reset} disabled={isPristine} className={btn("outline", "self-start sm:self-auto")} title={isPristine ? "The demo is at its starting state" : undefined}>
          <RotateCcw className="size-4" aria-hidden /> {isPristine ? "Demo at starting state" : "Reset demo"}
        </button>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3 lg:gap-6">
        <CapacityCard slots={state.slotsPerWeek} setSlots={setSlots} />
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:col-span-2 xl:grid-cols-4">
          <Stat icon={ListOrdered} label="Ready to book" value={counts.ready} sub="in line for a first assessment" />
          <Stat icon={FileWarning} label="Needs intake info" value={counts.intake} sub="no estimate shown to family" tone="amber" />
          <Stat icon={PauseCircle} label="On hold" value={counts.hold} sub="still on the waitlist" tone="amber" />
          <Stat icon={CalendarCheck} label="Booked" value={counts.booked} sub="first assessment scheduled" tone="green" />
          <div className="col-span-2 rounded-2xl border-2 border-dashed border-indigo-200 bg-white p-4 xl:col-span-4">
            <p className="text-sm text-slate-500">A family referred today would be told</p>
            <dl className="mt-2 grid grid-cols-3 gap-3">
              {[...PRIORITIES].reverse().map((p) => (
                <div key={p}>
                  <dt className="text-xs font-medium text-slate-500">{PRIORITY_LABEL[p]} priority</dt>
                  <dd className={`font-bold tabular-nums text-indigo-950 ${p === "standard" ? "text-2xl" : "text-lg"}`}>
                    {newRange[p] ? `${newRange[p]!.lower}–${newRange[p]!.upper} wk` : "Too long to estimate"}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mt-2 text-sm text-slate-500">
              at {state.slotsPerWeek} first-assessment slots per week. Higher priorities join the line ahead of standard referrals. Change the capacity to see how every family's estimate moves.
            </p>
          </div>
        </div>
      </div>

      <Card className="mt-6 !p-0">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:p-5 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Waitlist</h2>
            <p className="text-sm text-slate-500">Ordered by priority, then referral date. Clinical staff set the priority; a change moves the line and every estimate behind it.</p>
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
              className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium ${filter === f.key ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}
            >
              {f.label} <span className={filter === f.key ? "text-slate-300" : "text-slate-400"}>{counts[f.key]}</span>
            </button>
          ))}
        </div>

        {/* Download sits with the list it downloads, and says which rows go in the file. */}
        <div className="flex flex-col gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <p role="status" className="text-sm text-slate-600">
            {saved ? (
              <>
                Downloaded <span className="font-medium text-slate-900">{saved}</span>. Look in your Downloads folder.
              </>
            ) : (
              <>
                Download the {shown.length} {shown.length === 1 ? "referral" : "referrals"} shown below as a spreadsheet (.csv) for Excel or Google Sheets. Referral IDs only, no names.
              </>
            )}
          </p>
          <button
            onClick={() => setSaved(exportWaitlist(shown, filter, state.slotsPerWeek))}
            disabled={shown.length === 0}
            className={btn("primary", "shrink-0")}
          >
            Download spreadsheet
          </button>
        </div>

        {/* Desktop table */}
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3 font-medium">#</th>
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
                <tr key={r.id} className={r.id.startsWith("demo") ? "bg-teal-50/40" : "hover:bg-slate-50"}>
                  <td className="px-5 py-3 tabular-nums text-slate-500">{r.position ?? "–"}</td>
                  <td className="px-3 py-3 font-mono font-medium text-slate-900">{r.id}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-slate-700">{fmtShort(r.received_on)}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-slate-700">
                    {weeksLabel(r.days_waiting)}
                    {r.days_on_hold > 0 && <span className="block text-xs text-amber-800">{weeksLabel(r.days_on_hold)} on hold</span>}
                  </td>
                  <td className="hidden px-3 py-3 text-slate-600 xl:table-cell"><span className="whitespace-nowrap">{r.age_group}</span><span className="block text-xs text-slate-400">{r.referral_source}</span></td>
                  <td className="px-3 py-3"><StatusCell r={r} /></td>
                  <td className="px-3 py-3"><PriorityCell r={r} onChange={setPriority} /></td>
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
            <li key={r.id} className={`p-4 ${r.id.startsWith("demo") ? "bg-teal-50/40" : ""}`}>
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
                <StatusCell r={r} />
              </div>
              <div className="mt-3 flex items-center gap-2 text-sm">
                <span className="text-slate-500">Priority</span>
                <PriorityCell r={r} onChange={setPriority} />
              </div>
              <div className="mt-2 flex items-end justify-between gap-2">
                <div className="text-sm"><span className="text-slate-500">Family sees: </span><EstimateCell r={r} /></div>
                <RowActions r={r} {...actions} />
              </div>
            </li>
          ))}
        </ul>
        {shown.length === 0 && <p className="p-8 text-center text-sm text-slate-500">No referrals match.</p>}
      </Card>

      <Outbox notices={state.notices} />

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
                <Link to={`/family/${preview.referral.id}`} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm font-medium text-teal-700 hover:bg-teal-50">
                  Open <ExternalLink className="size-3.5" aria-hidden />
                </Link>
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
function exportWaitlist(rows: StaffRow[], filter: Filter, slots: number): string {
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
    "slots_per_week",
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
    clinicianName(r.appointment?.clinician_id),
    r.estimate.range_weeks ? "estimate" : r.estimate.reason === "booked" ? "confirmed date" : "no estimate",
    r.estimate.range_weeks?.lower,
    r.estimate.range_weeks?.upper,
    r.estimate.reason && r.estimate.reason !== "booked" ? REASON_LABEL[r.estimate.reason] : null,
    r.estimate.as_of,
    slots,
  ]);
  const name = filter === "all" ? "waitlist" : `waitlist-${filter}`;
  const filename = `${name}-${AS_OF}.csv`;
  downloadCsv(filename, toCsv(header, body));
  return filename;
}

function CapacityCard({ slots, setSlots }: { slots: number; setSlots: (n: number) => void }) {
  return (
    <Card>
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Assessment capacity</h2>
      <p className="mt-1 text-sm text-slate-600">First speech-language assessment slots the clinic plans to offer each week.</p>
      <div className="mt-4 flex items-center justify-between gap-3">
        <button onClick={() => setSlots(slots - 1)} disabled={slots <= 1} className={`grid size-11 place-items-center rounded-xl ring-1 ring-inset ring-slate-300 hover:bg-slate-50 ${DISABLED}`} aria-label="Fewer slots">
          <Minus className="size-5" />
        </button>
        <p className="text-center">
          <span className="block text-4xl font-bold tabular-nums text-slate-900">{slots}</span>
          <span className="text-sm text-slate-500">slots / week</span>
        </p>
        <button onClick={() => setSlots(slots + 1)} disabled={slots >= 10} className={`grid size-11 place-items-center rounded-xl ring-1 ring-inset ring-slate-300 hover:bg-slate-50 ${DISABLED}`} aria-label="More slots">
          <Plus className="size-5" />
        </button>
      </div>
      <input
        type="range"
        min={1}
        max={10}
        value={slots}
        onChange={(e) => setSlots(Number(e.target.value))}
        className="mt-4 w-full accent-teal-700"
        aria-label="Slots per week"
      />
      <div className="flex justify-between text-xs text-slate-400">
        <span>1</span>
        <span>Usual: {DEFAULT_SLOTS}</span>
        <span>10</span>
      </div>
      <p className="mt-3 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">Simulation for the demo. Changes update every family's estimate right away.</p>
    </Card>
  );
}

function Stat({ icon: Icon, label, value, sub, tone = "teal" }: { icon: typeof ListOrdered; label: string; value: number; sub: string; tone?: "teal" | "amber" | "green" }) {
  const color = { teal: "text-teal-700 bg-teal-50", amber: "text-amber-800 bg-amber-50", green: "text-emerald-700 bg-emerald-50" }[tone];
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <span className={`grid size-8 place-items-center rounded-lg ${color}`}>
        <Icon className="size-4" aria-hidden />
      </span>
      <p className="mt-3 text-2xl font-bold tabular-nums text-slate-900">{value}</p>
      <p className="text-sm font-medium text-slate-800">{label}</p>
      <p className="text-xs text-slate-500">{sub}</p>
    </div>
  );
}

function StatusCell({ r }: { r: StaffRow }) {
  return (
    <div className="flex flex-col items-start gap-1">
      <Chip tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Chip>
      {r.status === "waiting_for_assessment" && !r.intake_complete && <Chip tone="amber">Intake info incomplete</Chip>}
      {r.hold && (
        <span className="text-xs text-slate-500">
          {r.hold.end ? `Was on hold ${fmtShort(r.hold.start)}–${fmtShort(r.hold.end)}` : `Since ${fmtShort(r.hold.start)}: ${r.hold.reason}`}
        </span>
      )}
      {r.appointment_on && (
        <span className="text-xs text-slate-500">
          On {fmtShort(r.appointment_on)}
          {r.appointment && ` at ${r.appointment.start_time} · ${clinicianName(r.appointment.clinician_id) ?? ""}`}
        </span>
      )}
    </div>
  );
}

function EstimateCell({ r }: { r: StaffRow }) {
  const range = r.estimate.range_weeks;
  if (range) return <span className="whitespace-nowrap font-semibold text-indigo-900">{range.lower}–{range.upper} wk</span>;
  if (r.estimate.reason === "booked" && r.appointment_on) return <span className="text-emerald-800">Confirmed date · {fmtShort(r.appointment_on)}</span>;
  return <span className="text-slate-500">No estimate · {REASON_LABEL[r.estimate.reason ?? "intake_incomplete"]}</span>;
}

function RowActions({ r, onPreview, onComplete }: { r: StaffRow; onPreview: (id: string) => void; onComplete: (id: string) => void; onPriority: (id: string, p: Priority) => void }) {
  const needsIntake = r.status === "waiting_for_assessment" && !r.intake_complete;
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
function PriorityCell({ r, onChange }: { r: StaffRow; onChange: (id: string, p: Priority) => void }) {
  if (r.status === "assessment_booked") return <Chip tone={PRIORITY_TONE[r.priority]}>{PRIORITY_LABEL[r.priority]}</Chip>;
  return (
    <label className="inline-flex">
      <span className="sr-only">Priority for {r.id}</span>
      <select
        value={r.priority}
        onChange={(e) => onChange(r.id, e.target.value as Priority)}
        className={`rounded-lg border px-2 py-1 text-xs font-medium outline-none focus-visible:border-teal-500 ${
          r.priority === "urgent"
            ? "border-rose-200 bg-rose-50 text-rose-800"
            : r.priority === "high"
              ? "border-amber-200 bg-amber-50 text-amber-900"
              : "border-slate-300 bg-white text-slate-700"
        }`}
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
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <Bell className="size-5 text-slate-500" aria-hidden />
          Updates sent to families
        </h2>
        <span className="text-sm text-slate-500">{notices.length} since the demo was reset</span>
      </div>
      <p className="mt-1 text-sm text-slate-600">
        Sent automatically when a family's estimate becomes available, moves by 2 weeks or more, or can no longer be shown. Each family chooses email, text or device notifications on their page.
      </p>
      {notices.length === 0 ? (
        <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
          Nothing sent yet. Try <strong className="font-medium text-slate-700">Intake done</strong> on demo-002, or change the capacity.
        </p>
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
