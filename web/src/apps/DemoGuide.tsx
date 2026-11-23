import { useState } from "react";
import { PUBLIC_BASE } from "../boot";
import { QrCode } from "../components/QrCode";
import { Brand, DemoFooter, ThemeButton } from "../components/ThemeButton";
import { btn, Card } from "../components/ui";
import { CLINICS, DEMO_FAMILIES, DEMO_STAFF_PASSWORD, ROLE_LABEL, STAFF } from "../platform/clinics";

const STEPS = [
  {
    title: "1 · A parent checks the wait",
    who: "Family app",
    steps: [
      `Sign in as ${DEMO_FAMILIES[0].contact}. The code arrives in the demo inbox (bottom corner).`,
      "See both children at Maple Grove: one waiting with a range, one waiting to be booked.",
      "Open one: confirmed status, the wait range, and How this estimate works with the clinic's back-test result.",
    ],
  },
  {
    title: "2 · The clinic's nightly data arrives",
    who: "Clinic portal · admin@maplegrove.example",
    steps: [
      "Data → Run tonight's sync now. The Nov 20 export is imported with the saved mapping.",
      "One referral vanished from the export: it is kept and flagged for review instead of dropped.",
      "Back in the family app, the second child now shows a booked first assessment.",
    ],
  },
  {
    title: "3 · A new clinic connects a different system",
    who: "Clinic portal · admin@lakeshore.example or admin@riviere-est.example",
    steps: [
      "Data → Sample export. Lakeshore's is an event log with day-first dates; Rivière-Est's is French with semicolons.",
      "Check the proposed column match (AI if a Gemini key is set in Settings, rules otherwise), then import.",
      "Estimates: Rivière-Est passes the back-test; small Lakeshore doesn't, so its families are told there isn't enough data yet.",
    ],
  },
  {
    title: "4 · Staff work the line",
    who: "Clinic portal · intake@maplegrove.example",
    steps: [
      "Waitlist: change a priority (a reason is required and logged), mark intake done, try a capacity scenario.",
      "Families whose range moves by 2 weeks or more get an update.",
      "Audit log (admin) shows who viewed or changed what.",
    ],
  },
];

/** Where the QR codes point. The public site by default; a laptop's address on the same Wi-Fi works too (npm run dev -- --host). */
function QrCards() {
  const [base, setBase] = useState(PUBLIC_BASE);
  const root = base.endsWith("/") ? base : `${base}/`;
  const apps = [
    { key: "family", title: "Family app", sub: "Scan to check a child's referral", url: root },
    { key: "clinic", title: "Clinic portal", sub: "Scan to sign in as clinic staff", url: `${root}clinic/` },
  ];
  const download = (key: string) => {
    const svg = document.getElementById(`qr-${key}`)?.outerHTML;
    if (!svg) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    a.download = `early-birds-${key}-qr.svg`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  return (
    <section className="mt-10">
      <div className="grid gap-4 sm:grid-cols-2">
        {apps.map((a) => (
          <Card key={a.key} className="flex flex-col items-center text-center">
            <h2 className="text-xl font-bold text-slate-900">{a.title}</h2>
            <p className="text-sm text-slate-500">{a.sub}</p>
            <div id={`qr-${a.key}`} className="mt-4 w-56 max-w-full">
              <QrCode text={a.url} label={`QR code for the ${a.title}: ${a.url}`} className="h-auto w-full" />
            </div>
            <p className="mt-3 break-all font-mono text-xs text-slate-500">{a.url}</p>
            <button onClick={() => download(a.key)} className={btn("outline", "mt-3 print:hidden")}>
              Download QR (SVG, for the poster)
            </button>
          </Card>
        ))}
      </div>
      <label className="mt-4 flex flex-col gap-1 text-sm text-slate-600 sm:flex-row sm:items-center sm:gap-3 print:hidden">
        <span className="shrink-0">QR codes point to</span>
        <input value={base} onChange={(e) => setBase(e.target.value.trim())} className="w-full rounded-lg border border-slate-300 px-3 py-1.5 font-mono text-xs outline-none focus:border-teal-500 sm:max-w-md" />
        {base !== PUBLIC_BASE && (
          <button onClick={() => setBase(PUBLIC_BASE)} className="shrink-0 font-medium text-teal-700 underline">
            Back to the public site
          </button>
        )}
      </label>
      <p className="mt-1 text-xs text-slate-500 print:hidden">
        The public site shows a new version a few minutes after it is merged into main. Each phone keeps its own copy of the demo data until the shared database (Supabase) is connected.
      </p>
    </section>
  );
}

export function DemoGuide() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5 sm:px-6">
          <Brand sub="Demo guide" />
          <div className="ms-auto">
            <ThemeButton />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
        <p className="text-sm font-semibold text-teal-700">CS 497 · Early Birds · Prototype V.1</p>
        <h1 className="mt-2 max-w-3xl text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Wait-time estimates for children's therapy waitlists, learned from each clinic's own data</h1>
        <p className="mt-3 max-w-3xl text-slate-600">
          Two separate apps. Families sign in with a one-time code and see every referral linked to them. Clinic staff sign in to their own clinic's portal, bring in exports from whatever system they use, and see how the estimates were made and checked.
        </p>
        <div className="mt-6 flex flex-wrap gap-3 print:hidden">
          <a href="../" className={btn("primary")}>
            Open the family app
          </a>
          <a href="../clinic/" className={btn("dark")}>
            Open the clinic portal
          </a>
        </div>

        <QrCards />

        <div className="mt-10 grid gap-4 md:grid-cols-2">
          {STEPS.map((s) => (
            <Card key={s.title}>
              <h2 className="font-semibold text-slate-900">{s.title}</h2>
              <p className="text-sm text-slate-500">{s.who}</p>
              <ol className="mt-3 list-decimal space-y-1.5 ps-5 text-sm text-slate-700">
                {s.steps.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ol>
            </Card>
          ))}
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-2">
          <Card>
            <h2 className="font-semibold text-slate-900">Demo families</h2>
            <ul className="mt-2 space-y-2 text-sm">
              {DEMO_FAMILIES.map((f) => (
                <li key={f.contact}>
                  <span className="font-mono text-slate-900">{f.contact}</span>
                  <span className="block text-slate-500">{f.note}</span>
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <h2 className="font-semibold text-slate-900">Demo staff · password {DEMO_STAFF_PASSWORD}</h2>
            <ul className="mt-2 space-y-1.5 text-sm">
              {STAFF.map((s) => (
                <li key={s.email}>
                  <span className="font-mono text-slate-900">{s.email}</span>
                  <span className="block text-slate-500">
                    {CLINICS.find((c) => c.id === s.clinicId)!.info.name} · {ROLE_LABEL[s.role]}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
        <p className="mt-8 text-sm text-slate-500">
          Everything here is synthetic: three fictional clinics whose exports were generated to behave like real ones (their wait levels were tuned against public Ontario and NHS figures). No real patient data is used. This prototype stores data in your browser; the hosted
          version keeps it on a Canadian server.
        </p>
      </main>
      <DemoFooter />
    </div>
  );
}
