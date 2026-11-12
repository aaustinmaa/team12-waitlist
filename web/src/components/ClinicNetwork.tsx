import { useMemo, useState } from "react";
import { ArrowRight, CalendarPlus, Link2 } from "lucide-react";
import {
  ASSESSMENT_SITES, CLINICS, MAX_SLOTS, MAX_WEEK, SERVICE_ID, connectionBetween,
  localSlots, reservedSlots, travelToSite, validateSlotPlan, type NetworkAction,
} from "../../../backend/api/network";
import { AS_OF, listQueue, newReferralEstimate, readyLine } from "../lib/api";
import { addWeeks, fmtLong, fmtShort } from "../lib/dates";
import { useDemo } from "../lib/demoState";
import type { DemoState, SlotPlan, StaffRow } from "../lib/types";
import { Card, Chip } from "./ui";

const control = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900";
const primary = "rounded-lg bg-teal-700 px-3 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50";
const secondary = "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50";

function rangeLabel(range: { lower: number; upper: number } | null) {
  return range ? `${range.lower}–${range.upper} weeks` : "No estimate";
}

function weekLabel(week: number) {
  return fmtShort(addWeeks(AS_OF, week - 1));
}

export function ClinicNetwork({ clinicId, rows }: { clinicId: string; rows: StaffRow[] }) {
  const { state, changeNetwork } = useDemo();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const partners = Object.keys(CLINICS).filter((id) => id !== clinicId);
  const active = partners.filter((id) => connectionBetween(state, clinicId, id)?.status === "active");
  const agreements = (state.sharedSlots ?? []).filter((plan) =>
    plan.providerId === clinicId || plan.receiverId === clinicId,
  );

  async function apply(action: NetworkAction) {
    setError("");
    setBusy(true);
    try {
      await changeNetwork(clinicId, action);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The change could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-6 grid items-start gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]" aria-label="Clinic collaboration">
      <Card>
        <div className="flex gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-teal-50 text-teal-700"><Link2 className="size-5" aria-hidden /></span>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Clinic connections</h2>
            <p className="text-sm text-slate-600">Connect with a clinic to share waitlist summaries and propose assessment capacity.</p>
          </div>
        </div>
        <ul className="mt-4 divide-y divide-slate-200 border-y border-slate-200">
          {partners.map((partnerId) => {
            const link = connectionBetween(state, clinicId, partnerId);
            const isActive = link?.status === "active";
            const isPending = link?.status === "pending";
            const incoming = isPending && link.to === clinicId;
            return (
              <li key={partnerId} className="py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-slate-900">{CLINICS[partnerId].clinic.name}</span>
                  <Chip tone={isActive ? "green" : isPending ? "amber" : "slate"}>
                    {isActive ? "Connected" : incoming ? "Invitation received" : isPending ? "Invitation sent" : "Independent"}
                  </Chip>
                </div>
                {isPending && !incoming && <p className="mt-2 text-sm text-slate-600">Switch to the partner’s demo dashboard to accept the invitation.</p>}
                <div className="mt-3 flex flex-wrap gap-2">
                  {incoming && <button className={primary} disabled={busy} onClick={() => void apply({ type: "accept", partnerId })}>Accept connection</button>}
                  {isActive || isPending
                    ? <button className={secondary} disabled={busy} onClick={() => void apply({ type: "disconnect", partnerId })}>
                      {isActive ? "Disconnect" : incoming ? "Decline invitation" : "Withdraw invitation"}
                    </button>
                    : <button className={primary} disabled={busy} onClick={() => void apply({ type: "invite", partnerId })}>Invite to connect</button>}
                </div>
              </li>
            );
          })}
        </ul>
        {active.length > 0 && <NetworkOverview clinicIds={[clinicId, ...active]} state={state} />}
      </Card>

      <Card>
        <div className="flex gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-700"><CalendarPlus className="size-5" aria-hidden /></span>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Shared assessment capacity</h2>
            <p className="text-sm text-slate-600">Preview the effect of borrowing assessment slots from a connected clinic.</p>
          </div>
        </div>
        {active.length > 0
          ? <CapacityScenario key={active.join(",")} clinicId={clinicId} partners={active} rows={rows} apply={apply} busy={busy} />
          : <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">Connect a clinic to create a capacity scenario. Confirmed agreements can still be managed here.</p>}
        {agreements.length > 0 && (
          <ul className="mt-4 divide-y divide-slate-200 border-t border-slate-200">
            {agreements.map((plan) => {
              const providing = plan.providerId === clinicId;
              const otherClinic = CLINICS[providing ? plan.receiverId : plan.providerId].clinic.name;
              const site = ASSESSMENT_SITES.find((entry) => entry.id === plan.siteId);
              const confirmationError = plan.status === "proposed" && providing ? validateSlotPlan(state, plan) : null;
              const canConfirm = providing && plan.status === "proposed" && !confirmationError;
              return (
                <li key={plan.id} className="space-y-2 py-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-slate-900">{providing ? "Providing to" : "Receiving from"} {otherClinic}</p>
                    <Chip tone={plan.status === "confirmed" ? "green" : plan.status === "proposed" ? "amber" : "slate"}>
                      {plan.status === "confirmed" ? "Confirmed" : plan.status === "proposed" ? "Awaiting confirmation" : "Cancelled"}
                    </Chip>
                  </div>
                  <p className="text-slate-600">{plan.slots} slots/week · {plan.weeks} {plan.weeks === 1 ? "week" : "weeks"} from {weekLabel(plan.startWeek)} · {site?.name}</p>
                  {plan.status === "proposed" && !providing && <p className="text-xs text-slate-600">The providing clinic can confirm this proposal.</p>}
                  {confirmationError && <p className="text-xs text-amber-800">{confirmationError}</p>}
                  {canConfirm && (
                    <p className="text-xs text-slate-600">
                      Your clinic’s new-referral estimate if confirmed: {rangeLabel(newReferralEstimate(state, clinicId))} → {rangeLabel(newReferralEstimate(state, clinicId, plan))}
                    </p>
                  )}
                  {plan.status !== "cancelled" && (
                    <div className="flex flex-wrap gap-2">
                      {plan.status === "proposed" && providing && (
                        <button className={primary} disabled={busy || Boolean(confirmationError)} onClick={() => void apply({ type: "confirm", id: plan.id })}>Confirm slots</button>
                      )}
                      <button className={secondary} disabled={busy} onClick={() => void apply({ type: "cancel", id: plan.id })}>
                        {plan.status === "confirmed" ? "Cancel shared slots" : providing ? "Decline proposal" : "Withdraw proposal"}
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {error && <p role="alert" className="mt-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-900">{error}</p>}
      </Card>
    </section>
  );
}

function NetworkOverview({ clinicIds, state }: { clinicIds: string[]; state: DemoState }) {
  return (
    <div className="mt-5">
      <h3 className="font-semibold text-slate-900">Network overview</h3>
      <p className="mt-1 text-xs text-slate-500">First assessment · queue snapshot {fmtLong(AS_OF)}</p>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-xs text-slate-500">
            <tr><th scope="col" className="py-2 pr-3">Clinic</th><th scope="col" className="pr-3">Ready</th><th scope="col" className="pr-3">Local slots · week 1</th><th scope="col">New referral</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {clinicIds.map((id) => (
              <tr key={id}>
                <th scope="row" className="py-2 pr-3 font-medium text-slate-900">{CLINICS[id].clinic.name}</th>
                <td className="pr-3 tabular-nums">{readyLine(state, id).length}</td>
                <td className="pr-3 tabular-nums">{localSlots(state, id) - reservedSlots(state, id, 1)}</td>
                <td className="whitespace-nowrap">{rangeLabel(newReferralEstimate(state, id))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CapacityScenario({ clinicId, partners, rows, apply, busy }: {
  clinicId: string;
  partners: string[];
  rows: StaffRow[];
  apply: (action: NetworkAction) => Promise<void>;
  busy: boolean;
}) {
  const { state } = useDemo();
  const [providerId, setProviderId] = useState(partners[0]);
  const [siteId, setSiteId] = useState(ASSESSMENT_SITES.find((site) => site.clinic_id === partners[0])!.id);
  const [slots, setSlots] = useState(2);
  const [startWeek, setStartWeek] = useState(1);
  const [weeks, setWeeks] = useState(3);
  const ready = rows.filter((row) => row.position !== null);
  const [selectedReferral, setSelectedReferral] = useState(ready.find((row) => row.id.endsWith("-001"))?.id ?? "");
  const example = ready.find((row) => row.id === selectedReferral) ?? ready[0];
  const sites = ASSESSMENT_SITES.filter((site) => [clinicId, providerId].includes(site.clinic_id));
  const plan = useMemo<SlotPlan>(() => ({
    providerId, receiverId: clinicId, serviceId: SERVICE_ID, siteId, startWeek, weeks, slots,
  }), [providerId, clinicId, siteId, startWeek, weeks, slots]);
  const error = validateSlotPlan(state, plan);
  const scenarioRows = useMemo(() => error ? [] : listQueue(state, clinicId, plan), [error, state, clinicId, plan]);
  const scenario = scenarioRows.find((row) => row.id === example?.id);
  const atLocalSite = sites.find((site) => site.id === siteId)?.clinic_id === clinicId;
  const travel = example && !atLocalSite ? travelToSite(example.id, siteId) : null;
  const canUseSite = atLocalSite || travel?.eligible === true;

  return (
    <form className="mt-4 space-y-3" onSubmit={(event) => {
      event.preventDefault();
      if (!error) void apply({ type: "propose", id: crypto.randomUUID(), plan });
    }}>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm font-medium">Providing clinic
          <select className={control} value={providerId} onChange={(event) => {
            const id = event.target.value;
            setProviderId(id);
            setSiteId(ASSESSMENT_SITES.find((site) => site.clinic_id === id)!.id);
          }}>
            {partners.map((id) => <option key={id} value={id}>{CLINICS[id].clinic.name}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-sm font-medium">Assessment site
          <select className={control} value={siteId} onChange={(event) => setSiteId(event.target.value)}>
            {sites.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}
          </select>
        </label>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <label className="space-y-1 text-sm font-medium">Slots / week
          <input className={control} type="number" min={1} max={MAX_SLOTS} required value={slots || ""} onChange={(e) => setSlots(Number(e.target.value))} />
        </label>
        <label className="space-y-1 text-sm font-medium">Start week
          <input className={control} type="number" min={1} max={MAX_WEEK} required value={startWeek || ""} onChange={(e) => setStartWeek(Number(e.target.value))} />
        </label>
        <label className="space-y-1 text-sm font-medium">Duration (weeks)
          <input className={control} type="number" min={1} max={MAX_WEEK} required value={weeks || ""} onChange={(e) => setWeeks(Number(e.target.value))} />
        </label>
      </div>
      {error && <p className="text-sm text-amber-800">{error}</p>}
      {example && (
        <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="flex items-center gap-2 text-sm font-medium text-indigo-950">Preview referral
              <select className="rounded-lg border border-indigo-200 bg-white px-2 py-1 text-sm" value={example.id} onChange={(e) => setSelectedReferral(e.target.value)}>
                {ready.map((row) => <option key={row.id}>{row.id}</option>)}
              </select>
            </label>
            <Chip tone={canUseSite ? "teal" : "amber"}>{canUseSite ? "Can use this site" : "Cannot use this site"}</Chip>
          </div>
          {!atLocalSite && (
            <p className="mt-2 text-xs text-indigo-900">
              {travel ? `${travel.minutes} min by ${travel.mode} · family limit ${travel.maxMinutes} min` : "Travel time or family preferences unavailable."}
            </p>
          )}
          {scenario && (
            <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-indigo-950">
              <div><p className="text-xs">Current estimate</p><p className="font-semibold">{rangeLabel(example.estimate.range_weeks)}</p></div>
              <ArrowRight className="size-4 text-indigo-500" aria-hidden />
              <div><p className="text-xs">Scenario estimate</p><p className="font-semibold">{rangeLabel(scenario.estimate.range_weeks)}</p></div>
            </div>
          )}
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button type="submit" className={primary} disabled={busy || Boolean(error)}>Send capacity proposal</button>
        {!error && <span className="text-xs text-slate-500">Weeks of {weekLabel(startWeek)}{weeks > 1 && `–${weekLabel(startWeek + weeks - 1)}`}</span>}
      </div>
    </form>
  );
}
