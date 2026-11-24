// The referrer page (/refer/): family doctors and other referrers compare the
// wait a child referred today would face at each clinic, before choosing
// where to refer. Clinic-wide totals only; no child's information.

import { useMemo, useState, type ReactNode } from "react";
import { CalendarClock, Info, Languages, Send, Stethoscope, Users } from "lucide-react";
import { Brand, DemoFooter, ThemeButton } from "../../components/ThemeButton";
import { btn, Card, CardHeading, Chip, METRIC, type MetricKind } from "../../components/ui";
import { fmtLong } from "../../lib/dates";
import { directoryEntry, sortByWait, speaks, type DirectoryEntry } from "../../lib/referrer";
import type { ClinicianLanguage, Priority } from "../../lib/types";
import { directoryViews } from "../../platform/directory";
import { usePlatform } from "../../platform/store";

const SESSION_KEY = "early-birds-referrer-session";

/** The demo referrer. In the real service referrers sign in with a verified clinician account. */
const DEMO_REFERRER = { name: "Dr. Robin Hale", role: "Family physician, Waterloo" };

const LANG_NAME: Record<ClinicianLanguage, string> = { en: "English", fr: "French", es: "Spanish", cmn: "Mandarin", yue: "Cantonese" };

const PRIORITIES: { value: Priority; label: string; hint: string }[] = [
  { value: "standard", label: "Standard", hint: "Most referrals" },
  { value: "high", label: "High", hint: "Seen ahead of standard" },
  { value: "urgent", label: "Urgent", hint: "Seen first" },
];

function readSession(): typeof DEMO_REFERRER | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as typeof DEMO_REFERRER) : null;
  } catch {
    return null;
  }
}

export function ReferrerApp() {
  const [session, setSession] = useState(readSession);
  const signIn = () => {
    localStorage.setItem(SESSION_KEY, JSON.stringify(DEMO_REFERRER));
    setSession(DEMO_REFERRER);
  };
  const signOut = () => {
    localStorage.removeItem(SESSION_KEY);
    setSession(null);
  };

  return (
    <div className="flex min-h-dvh flex-col bg-wash">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur print:hidden">
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-2.5 sm:px-6">
          <Brand sub="For referrers" />
          <div className="ms-auto flex items-center gap-1">
            <ThemeButton />
            {session && (
              <button type="button" onClick={signOut} className="whitespace-nowrap rounded-lg px-2 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100">
                <span className="hidden sm:inline">{session.name} · </span>Sign out
              </button>
            )}
          </div>
        </div>
      </header>
      <main className="relative isolate flex-1">
        {/* Same soft brand wash as the family app behind the top of the page. */}
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-96 bg-linear-to-b from-teal-50/80 to-transparent print:hidden" />
        <div key={session ? "compare" : "sign-in"} className="animate-page-in">
          {session ? <Compare /> : <SignIn onSignIn={signIn} />}
        </div>
      </main>
      <DemoFooter />
    </div>
  );
}

function SignIn({ onSignIn }: { onSignIn: () => void }) {
  return (
    <div className="mx-auto max-w-md px-4 py-10 sm:py-16">
      <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">Compare waits before you refer</h1>
      <p className="mt-2 text-slate-600">
        See how long a child referred today would likely wait for a first speech-language assessment at each clinic, worked out from the clinic's own records.
      </p>
      <Card className="mt-6">
        <CardHeading icon={Stethoscope}>Referrer sign-in</CardHeading>
        <p className="mt-2 text-sm text-slate-700">
          Clinics share these numbers with the clinicians who refer to them, not with the public. In the real service you sign in with your clinician account.
        </p>
        <button type="button" onClick={onSignIn} className={btn("primary", "mt-4 w-full py-2.5")}>
          <Stethoscope className="size-4" aria-hidden />
          Continue as demo referrer
        </button>
        <p className="mt-2 text-xs text-slate-500">
          {DEMO_REFERRER.name}, {DEMO_REFERRER.role.toLowerCase()}. Fictional clinics, synthetic data.
        </p>
      </Card>
    </div>
  );
}

function Compare() {
  const p = usePlatform();
  const [priority, setPriority] = useState<Priority>("standard");
  const [lang, setLang] = useState<ClinicianLanguage | "any">("any");

  // Rebuilt when this device's clinic data changes (an import or a staff change in the clinic portal).
  const views = useMemo(() => directoryViews((id) => p.view(id)), [p]);
  const all = useMemo(() => views.map(({ setup, view }) => directoryEntry(view, setup.referrer, priority)), [views, priority]);
  const shown = sortByWait(speaks(all, lang));
  const hidden = all.length - shown.length;
  const langs = [...new Set(all.flatMap((e) => e.languages))];

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-10">
      <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">Compare waits before you refer</h1>
      <p className="mt-2 max-w-2xl text-slate-600">
        Preschool speech-language assessment. The estimate is for a child referred today, from each clinic's own records, and checked against how long its past
        referrals really waited.
      </p>

      <Card className="mt-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <fieldset>
            <legend className="text-sm font-medium text-slate-800">Priority the clinic would likely give</legend>
            <div className="mt-2 inline-flex rounded-lg bg-slate-100 p-1" role="radiogroup">
              {PRIORITIES.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  role="radio"
                  aria-checked={priority === o.value}
                  onClick={() => setPriority(o.value)}
                  className={`rounded-md px-3 py-1.5 text-sm font-semibold transition-colors ${
                    priority === o.value ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-slate-500">{PRIORITIES.find((o) => o.value === priority)!.hint}</p>
          </fieldset>
          <label className="block text-sm">
            <span className="font-medium text-slate-800">Family's language</span>
            <span className="mt-2 flex items-center gap-2 rounded-lg py-1.5 ps-3 pe-2 ring-1 ring-inset ring-slate-300">
              <Languages className="size-4 shrink-0 text-slate-500" aria-hidden />
              <select value={lang} onChange={(e) => setLang(e.target.value as ClinicianLanguage | "any")} className="w-full bg-transparent font-medium text-slate-900 outline-none sm:w-40">
                <option value="any">Any language</option>
                {langs.map((l) => (
                  <option key={l} value={l}>
                    {LANG_NAME[l]}
                  </option>
                ))}
              </select>
            </span>
          </label>
        </div>
      </Card>

      <ol className="mt-6 space-y-4" aria-label="Clinics, shortest expected wait first">
        {shown.map((e) => (
          <li key={e.clinicId}>
            <ClinicCard e={e} />
          </li>
        ))}
      </ol>
      {hidden > 0 && (
        <p className="mt-3 text-sm text-slate-500">
          {hidden === 1 ? "1 clinic doesn't" : `${hidden} clinics don't`} list {LANG_NAME[lang as ClinicianLanguage]} and {hidden === 1 ? "is" : "are"} hidden.{" "}
          <button type="button" onClick={() => setLang("any")} className="font-medium text-teal-700 underline underline-offset-2">
            Show all
          </button>
        </p>
      )}

      <Card className="mt-8">
        <CardHeading icon={Info}>Before you choose</CardHeading>
        <ul className="mt-3 list-disc space-y-2 ps-5 text-sm text-slate-700">
          <li>Check that the family is eligible. Many publicly funded programs only take children from their own area.</li>
          <li>These are estimates, updated with each clinic's data. If many referrals go to one clinic, its estimate goes up at the next update.</li>
          <li>"No estimate yet" says nothing about a clinic's quality. Its history is just too short for us to check an estimate against.</li>
          <li>Only clinic-wide totals are shared here. No child's information leaves the clinic.</li>
        </ul>
      </Card>
    </div>
  );
}

function ClinicCard({ e }: { e: DirectoryEntry }) {
  return (
    <Card>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-slate-900">{e.name}</h2>
          <p className="text-sm text-slate-600">
            {e.city} · {e.serves}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {e.languages.map((l) => (
              <Chip key={l} tone="slate">
                {LANG_NAME[l]}
              </Chip>
            ))}
          </div>
        </div>
        <Wait e={e} />
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-slate-100 pt-4 text-sm sm:grid-cols-4">
        <Fact kind="count" icon={<Users className="size-4" aria-hidden />} label="Waiting now" value={`${e.waitingNow} children`} />
        <Fact kind="count" icon={<CalendarClock className="size-4" aria-hidden />} label="First assessments" value={`${e.perWeek} a week`} />
        <Fact kind="wait" icon={<Info className="size-4" aria-hidden />} label="Intake usually takes" value={`${e.intakeDays} days`} />
        <Fact
          kind={e.coverage === null ? "count" : "quality"}
          icon={<Info className="size-4" aria-hidden />}
          label="Past estimates held"
          value={e.coverage === null ? "Not checked yet" : `${Math.round(e.coverage * 100)}% of the time`}
        />
      </dl>

      <div className="mt-4 flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-center gap-1.5 text-slate-700">
          <Send className="size-4 shrink-0 text-slate-500" aria-hidden />
          <span>
            <span className="font-medium">How to refer:</span> {e.howToRefer}
          </span>
        </p>
        <p className="text-xs text-slate-500">Clinic data from {fmtLong(e.asOf)}</p>
      </div>
    </Card>
  );
}

function Wait({ e }: { e: DirectoryEntry }) {
  if (e.wait.kind === "range")
    return (
      <div className="shrink-0 rounded-xl bg-indigo-50 px-4 py-3 ring-1 ring-inset ring-indigo-100 sm:text-end">
        <p className="text-xs font-medium uppercase tracking-wide text-indigo-700">Expected wait</p>
        <p className={`text-2xl font-bold tabular-nums ${METRIC.estimate.value}`}>
          {e.wait.lower}–{e.wait.upper} weeks
        </p>
        <p className="text-xs text-indigo-700">to a first assessment</p>
      </div>
    );
  return (
    <div className="shrink-0 rounded-xl bg-slate-100 px-4 py-3 sm:max-w-60 sm:text-end">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-600">Expected wait</p>
      <p className="text-lg font-bold text-slate-800">{e.wait.kind === "too_long" ? "Longer than we can estimate" : "No estimate yet"}</p>
      <p className="text-xs text-slate-600">
        {e.wait.kind === "too_long" ? "Call intake for their current wait." : "Not enough history to check an estimate. Call intake to ask."}
      </p>
    </div>
  );
}

function Fact({ icon, label, value, kind }: { icon: ReactNode; label: string; value: string; kind: MetricKind }) {
  return (
    <div>
      <dt className="flex items-center gap-1 text-xs text-slate-500">
        {icon}
        {label}
      </dt>
      <dd className={`mt-0.5 font-semibold tabular-nums ${METRIC[kind].value}`}>{value}</dd>
    </div>
  );
}
