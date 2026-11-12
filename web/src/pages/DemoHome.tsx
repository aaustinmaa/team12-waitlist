import { Link } from "react-router";
import { ArrowRight, ChevronDown, LayoutDashboard, RotateCcw, Smartphone } from "lucide-react";
import { useDemo } from "../lib/demoState";
import { ClinicSelector } from "../components/ClinicSelector";
import { FAMILY_CASES } from "./FamilyPage";

const TASKS = [
  {
    title: "Task 1 · How much longer is the wait?",
    scenario: "You got a message that your child's speech-language referral was registered. You want to know how much longer your child might wait.",
    link: "/family/demo-001",
    steps: [
      "Open the family view for referral demo-001.",
      "Find the confirmed status: Waiting for first assessment.",
      "Find the estimate: about 6–10 more weeks, with the likely date range.",
      "Read the note that this is not an appointment and may change.",
    ],
    watch: "Can they say what the range measures? Do they treat it as a booked appointment?",
  },
  {
    title: "Task 2 · No estimate: is my referral still there?",
    scenario: "You can't see a wait estimate. You want to check your referral is still on the waitlist and know who to contact.",
    link: "/family/demo-002",
    steps: [
      "Open the family view for referral demo-002.",
      "Find the confirmed status: still waiting, place kept.",
      "Understand that no estimate is available yet, and why.",
      "Find the clinic's email or phone and the referral ID to mention.",
    ],
    watch: "Do they think the referral disappeared or was cancelled? Can they find a person to contact on their own?",
  },
  {
    title: "Extra · Staff changes capacity",
    scenario: "You work on the intake team. A new clinician starts next week, so the clinic can offer more first assessments.",
    link: "/staff",
    steps: [
      "Open the staff dashboard.",
      "Raise slots per week from 5 to 7.",
      "Preview demo-001 and see its estimate shorten.",
      "Mark intake done for demo-002 and see it get an estimate.",
    ],
    watch: "Is the link between capacity and what families see clear? Is it obvious which screen is staff-only?",
  },
];

export function DemoHome() {
  const { isBaseline, reset } = useDemo();

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <section className="max-w-3xl">
        <p className="text-sm font-semibold text-teal-700">CS 497 · Team 12 · Prototype V.0</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Clear wait information for families waiting for children's speech-language services</h1>
        <p className="mt-4 text-lg text-slate-600">
          Families see their confirmed referral status and, separately, an estimated wait range for the first assessment. The clinic's intake team sees the waitlist and can test how appointment capacity changes those estimates.
        </p>
        <p className="mt-3 text-sm text-slate-500">The clinics and referrals in this demo are fictional.</p>
      </section>

      <section className="mt-10 grid gap-5 md:grid-cols-2">
        <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <span className="grid size-11 place-items-center rounded-xl bg-teal-100 text-teal-800"><Smartphone className="size-6" aria-hidden /></span>
          <h2 className="mt-4 text-xl font-semibold text-slate-900">Family view</h2>
          <p className="mt-1 text-slate-600">For parents and guardians. Works on a phone or a computer.</p>
          <ul className="mt-5 space-y-2">
            {FAMILY_CASES.map((c) => (
              <li key={c.id}>
                <Link to={`/family/${c.id}`} className="group flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-3 hover:border-teal-300 hover:bg-teal-50">
                  <span>
                    <span className="block font-medium text-slate-900">{c.label}</span>
                    <span className="text-sm text-slate-500"><span className="font-mono">{c.id}</span> · {c.hint}</span>
                  </span>
                  <ArrowRight className="size-4 text-slate-400 group-hover:text-teal-700" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <span className="grid size-11 place-items-center rounded-xl bg-rose-100 text-rose-800"><LayoutDashboard className="size-6" aria-hidden /></span>
          <h2 className="mt-4 text-xl font-semibold text-slate-900">Staff dashboard</h2>
          <p className="mt-1 text-slate-600">For the clinic's intake team. Best on a computer.</p>
          <ul className="mt-5 flex-1 list-disc space-y-1.5 pl-5 text-sm text-slate-600">
            <li>The whole first-assessment waitlist, with holds and missing intake info flagged</li>
            <li>Adjust weekly assessment capacity and watch estimates update</li>
            <li>Connect clinics and preview shared assessment capacity</li>
          </ul>
          <div className="mt-5"><ClinicSelector /></div>
          <Link to="/staff" className="mt-3 inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 font-semibold text-white hover:bg-slate-800">
            Open staff dashboard <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
      </section>

      <details className="group mt-10 rounded-2xl border border-slate-200 bg-white">
        <summary className="flex cursor-pointer items-center justify-between gap-3 p-5 sm:p-6">
          <span>
            <span className="block text-lg font-semibold text-slate-900">For facilitators: walkthrough tasks</span>
            <span className="text-sm text-slate-500">Read the scenario aloud, then watch. Don't show participants the expected steps.</span>
          </span>
          <ChevronDown className="size-5 shrink-0 text-slate-500 transition-transform group-open:rotate-180" aria-hidden />
        </summary>
        <div className="grid gap-4 border-t border-slate-200 p-5 sm:p-6 lg:grid-cols-3">
          {TASKS.map((t) => (
            <div key={t.title} className="flex flex-col rounded-xl bg-slate-50 p-4">
              <h3 className="font-semibold text-slate-900">{t.title}</h3>
              <p className="mt-2 text-sm italic text-slate-700">"{t.scenario}"</p>
              <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Expected steps</p>
              <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm text-slate-700">
                {t.steps.map((s) => <li key={s}>{s}</li>)}
              </ol>
              <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Watch for</p>
              <p className="mt-1 flex-1 text-sm text-slate-700">{t.watch}</p>
              <Link to={t.link} className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-teal-700 hover:underline">
                Start this task <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3 border-t border-slate-200 p-5 text-sm text-slate-600 sm:px-6">
          Before each participant, reset the demo so everyone starts from the same data.
          <button onClick={reset} disabled={isBaseline} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium ring-1 ring-slate-300 hover:bg-slate-50 disabled:opacity-50">
            <RotateCcw className="size-4" aria-hidden /> {isBaseline ? "Demo is at the starting state" : "Reset demo"}
          </button>
        </div>
      </details>
    </div>
  );
}
