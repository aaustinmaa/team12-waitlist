import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useParams } from "react-router";
import {
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
import { AS_OF, getFamilyReferral, listQueue, newReferralEstimate } from "../lib/api";
import { CLINICS, DEFAULT_CLINIC_ID, localSlots, minimumLocalSlots } from "../../../backend/api/network";
import { ClinicNetwork } from "../components/ClinicNetwork";
import { ClinicSelector } from "../components/ClinicSelector";
import { useDemo } from "../lib/demoState";
import { fmtLong, fmtShort } from "../lib/dates";
import type { StaffRow } from "../lib/types";
import { FamilyReferralView } from "../components/FamilyReferralView";
import { Card, Chip, REASON_LABEL, STATUS_LABEL, STATUS_TONE, weeksLabel } from "../components/ui";

type Filter = "all" | "ready" | "hold" | "intake" | "booked";

const FILTERS: { key: Filter; label: string; test: (r: StaffRow) => boolean }[] = [
  { key: "all", label: "All", test: () => true },
  { key: "ready", label: "Ready to book", test: (r) => r.position !== null },
  { key: "intake", label: "Needs intake info", test: (r) => r.status === "waiting_for_assessment" && !r.intake_complete },
  { key: "hold", label: "On hold", test: (r) => r.status === "on_hold" },
  { key: "booked", label: "Booked", test: (r) => r.status === "assessment_booked" },
];

export function StaffDashboard() {
  const { clinicId = DEFAULT_CLINIC_ID } = useParams();
  if (!Object.hasOwn(CLINICS, clinicId)) return <Navigate to="/staff" replace />;
  return <ClinicDashboard key={clinicId} clinicId={clinicId} />;
}

function ClinicDashboard({ clinicId }: { clinicId: string }) {
  const { state, setSlots, completeIntake, reset, isBaseline } = useDemo();
  const { clinic, capacity } = CLINICS[clinicId];
  const slots = localSlots(state, clinicId);
  const minSlots = minimumLocalSlots(state, clinicId);
  const rows = useMemo(() => listQueue(state, clinicId), [state, clinicId]);
  const newRange = useMemo(() => newReferralEstimate(state, clinicId), [state, clinicId]);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [previewId, setPreviewId] = useState<string | null>(null);

  const counts = Object.fromEntries(FILTERS.map((f) => [f.key, rows.filter(f.test).length])) as Record<Filter, number>;
  const active = FILTERS.find((f) => f.key === filter)!;
  const shown = rows
    .filter(active.test)
    .filter((r) => r.id.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => (a.position ?? 999) - (b.position ?? 999) || a.received_on.localeCompare(b.received_on));

  const preview = previewId ? getFamilyReferral(previewId, state) : null;

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
            <Chip tone="rose" icon={<ShieldCheck className="size-3.5" aria-hidden />}>Staff only</Chip>
            <span className="text-sm text-slate-500">Intake team · {clinic.name}</span>
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Staff dashboard</h1>
          <p className="mt-1 text-slate-600">{clinic.service} · first-assessment waitlist · data as of {fmtLong(AS_OF)}</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <ClinicSelector clinicId={clinicId} />
          {!isBaseline && (
            <button onClick={reset} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 ring-1 ring-slate-300 hover:bg-white">
              <RotateCcw className="size-4" aria-hidden /> Reset demo
            </button>
          )}
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3 lg:gap-6">
        <CapacityCard slots={slots} minSlots={minSlots} usual={capacity.assessment_slots_per_week} setSlots={(n) => setSlots(n, clinicId)} />
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:col-span-2 xl:grid-cols-4">
          <Stat icon={ListOrdered} label="Ready to book" value={counts.ready} sub="in line for a first assessment" />
          <Stat icon={FileWarning} label="Needs intake info" value={counts.intake} sub="no estimate shown to family" tone="amber" />
          <Stat icon={PauseCircle} label="On hold" value={counts.hold} sub="still on the waitlist" tone="amber" />
          <Stat icon={CalendarCheck} label="Booked" value={counts.booked} sub="first assessment scheduled" tone="green" />
          <div className="col-span-2 rounded-2xl border-2 border-dashed border-indigo-200 bg-white p-4 xl:col-span-4">
            <p className="text-sm text-slate-500">A family referred today would be told</p>
            <p className="mt-1 text-2xl font-bold text-indigo-950">{newRange ? `${newRange.lower}–${newRange.upper} weeks` : "No estimate (too long to estimate)"}</p>
            <p className="mt-1 text-sm text-slate-500">Based on this clinic’s queue and confirmed capacity. A new referral has no travel preferences yet.</p>
          </div>
        </div>
      </div>

      <ClinicNetwork clinicId={clinicId} rows={rows} />

      <Card className="mt-6 !p-0">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:p-5 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Waitlist</h2>
            <p className="text-sm text-slate-500">Ordered by referral date. Urgent referrals and holds are handled by clinical staff.</p>
          </div>
          <label className="relative block md:w-64">
            <span className="sr-only">Search referral ID</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
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
              onClick={() => setFilter(f.key)}
              className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium ${filter === f.key ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}
            >
              {f.label} <span className={filter === f.key ? "text-slate-300" : "text-slate-400"}>{counts[f.key]}</span>
            </button>
          ))}
        </div>

        {/* Desktop table */}
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3 font-medium">#</th>
                <th className="px-3 py-3 font-medium">Referral</th>
                <th className="px-3 py-3 font-medium">Received</th>
                <th className="px-3 py-3 font-medium">Waiting</th>
                <th className="hidden px-3 py-3 font-medium xl:table-cell">Age · Source</th>
                <th className="px-3 py-3 font-medium">Status</th>
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
                  <td className="whitespace-nowrap px-3 py-3 text-slate-700">{weeksLabel(r.days_waiting)}</td>
                  <td className="hidden px-3 py-3 text-slate-600 xl:table-cell"><span className="whitespace-nowrap">{r.age_group}</span><span className="block text-xs text-slate-400">{r.referral_source}</span></td>
                  <td className="px-3 py-3"><StatusCell r={r} /></td>
                  <td className="px-3 py-3"><EstimateCell r={r} /></td>
                  <td className="px-5 py-3"><RowActions r={r} onPreview={setPreviewId} onComplete={completeIntake} /></td>
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
                  <p className="text-sm text-slate-500">Received {fmtShort(r.received_on)} · {weeksLabel(r.days_waiting)}</p>
                </div>
                <StatusCell r={r} />
              </div>
              <div className="mt-3 flex items-end justify-between gap-2">
                <div className="text-sm"><span className="text-slate-500">Family sees: </span><EstimateCell r={r} /></div>
                <RowActions r={r} onPreview={setPreviewId} onComplete={completeIntake} />
              </div>
            </li>
          ))}
        </ul>
        {shown.length === 0 && <p className="p-8 text-center text-sm text-slate-500">No referrals match.</p>}
      </Card>

      {preview && (
        <div className="fixed inset-0 z-40 flex justify-end bg-slate-900/40" onClick={() => setPreviewId(null)}>
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

function CapacityCard({ slots, minSlots, usual, setSlots }: { slots: number; minSlots: number; usual: number; setSlots: (n: number) => void }) {
  return (
    <Card>
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Assessment capacity</h2>
      <p className="mt-1 text-sm text-slate-600">Weekly first-assessment slots before any commitments to partner clinics.</p>
      <div className="mt-4 flex items-center justify-between gap-3">
        <button onClick={() => setSlots(slots - 1)} disabled={slots <= minSlots} className="grid size-11 place-items-center rounded-xl ring-1 ring-slate-300 hover:bg-slate-50 disabled:opacity-40" aria-label="Fewer slots">
          <Minus className="size-5" />
        </button>
        <p className="text-center">
          <span className="block text-4xl font-bold tabular-nums text-slate-900">{slots}</span>
          <span className="text-sm text-slate-500">slots / week</span>
        </p>
        <button onClick={() => setSlots(slots + 1)} disabled={slots >= 10} className="grid size-11 place-items-center rounded-xl ring-1 ring-slate-300 hover:bg-slate-50 disabled:opacity-40" aria-label="More slots">
          <Plus className="size-5" />
        </button>
      </div>
      <input
        type="range"
        min={minSlots}
        max={10}
        value={slots}
        onChange={(e) => setSlots(Number(e.target.value))}
        className="mt-4 w-full accent-teal-700"
        aria-label="Slots per week"
      />
      <div className="flex justify-between text-xs text-slate-400">
        <span>{minSlots}</span>
        <span>Usual: {usual}</span>
        <span>10</span>
      </div>
      <p className="mt-3 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">{minSlots > 1 ? `Up to ${minSlots} slots per week are committed to partner clinics.` : "Changes recalculate this clinic’s wait estimates."}</p>
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
      {r.appointment_on && <span className="text-xs text-slate-500">On {fmtShort(r.appointment_on)}</span>}
    </div>
  );
}

function EstimateCell({ r }: { r: StaffRow }) {
  const range = r.estimate.range_weeks;
  if (range) return <span className="whitespace-nowrap font-semibold text-indigo-900">{range.lower}–{range.upper} wk</span>;
  if (r.estimate.reason === "booked" && r.appointment_on) return <span className="text-emerald-800">Confirmed date · {fmtShort(r.appointment_on)}</span>;
  return <span className="text-slate-500">No estimate · {REASON_LABEL[r.estimate.reason ?? "intake_incomplete"]}</span>;
}

function RowActions({ r, onPreview, onComplete }: { r: StaffRow; onPreview: (id: string) => void; onComplete: (id: string) => void }) {
  const needsIntake = r.status === "waiting_for_assessment" && !r.intake_complete;
  return (
    <div className="flex shrink-0 justify-end gap-1.5">
      {needsIntake && (
        <button onClick={() => onComplete(r.id)} className="inline-flex items-center gap-1 rounded-lg bg-amber-100 px-2.5 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-200" title="Mark intake information as complete">
          <ClipboardCheck className="size-3.5" aria-hidden /> Intake done
        </button>
      )}
      <button onClick={() => onPreview(r.id)} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-teal-800 ring-1 ring-teal-200 hover:bg-teal-50">
        <Eye className="size-3.5" aria-hidden /> Preview
      </button>
    </div>
  );
}
