import { Link, NavLink, useParams } from "react-router";
import { RefreshCw } from "lucide-react";
import { FamilyReferralView } from "../components/FamilyReferralView";
import { CLINIC, getFamilyReferral } from "../lib/api";
import { useDemo } from "../lib/demoState";

export const FAMILY_CASES = [
  { id: "demo-001", label: "Estimate available", hint: "Waiting, with a wait range" },
  { id: "demo-002", label: "No estimate yet", hint: "Waiting, intake info still under review" },
  { id: "demo-003", label: "Assessment booked", hint: "Confirmed first-assessment date" },
];

export function FamilyPage() {
  const { id = "" } = useParams();
  const { state, isBaseline, reset } = useDemo();
  const data = getFamilyReferral(id, state);

  if (!data) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <h1 className="text-2xl font-semibold">We couldn't find that referral</h1>
        <p className="mt-2 text-slate-600">Check the referral ID or contact {CLINIC.contact}.</p>
        <Link to="/family/demo-001" className="mt-6 inline-block font-medium text-teal-700 underline">
          Open the demo referral
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      <div className="mb-6 sm:mb-8">
        <p className="text-sm font-medium text-teal-700">{CLINIC.name} · Family portal</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Your child's referral</h1>
        <p className="mt-1 text-slate-600">{data.referral.service}</p>
      </div>

      <FamilyReferralView data={data} />

      <div className="mt-10 rounded-2xl border border-dashed border-slate-300 bg-white/60 p-4 text-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <p className="font-medium text-slate-500">Prototype demo · switch family case</p>
          <div className="flex flex-wrap gap-2">
            {FAMILY_CASES.map((c) => (
              <NavLink
                key={c.id}
                to={`/family/${c.id}`}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-1.5 font-medium ring-1 ring-inset ${isActive ? "bg-slate-900 text-white ring-slate-900" : "bg-white text-slate-700 ring-slate-300 hover:bg-slate-100"}`
                }
              >
                {c.label}
              </NavLink>
            ))}
          </div>
        </div>
        {!isBaseline && (
          <p className="mt-3 flex flex-wrap items-center gap-2 text-slate-500">
            Clinic settings were changed in the staff dashboard ({state.slotsPerWeek} slots/week).
            <button onClick={reset} className="inline-flex items-center gap-1 font-medium text-teal-700 underline">
              <RefreshCw className="size-3.5" aria-hidden /> Reset demo
            </button>
          </p>
        )}
      </div>
    </div>
  );
}
