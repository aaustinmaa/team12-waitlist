import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { ArrowRight, HeartHandshake, Loader2 } from "lucide-react";
import { btn, Card } from "../../components/ui";
import { DEMO_FAMILIES } from "../../platform/clinics";
import { usePlatform } from "../../platform/store";
import { DEMO_FAMILY, HOSTED } from "../../platform/hosted";
import { useFamilyText } from "./FamilyShell";

/** Families sign in with a one-time code sent to the email or mobile the clinic has on file. */
export function FamilySignIn() {
  const p = usePlatform();
  const ft = useFamilyText();
  const nav = useNavigate();
  const [contact, setContact] = useState("");
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);
  const send = async (e?: FormEvent, to = contact) => {
    e?.preventDefault();
    if (!to.trim()) return;
    setContact(to);
    setBusy(true);
    const err = await p.requestCode(to);
    setBusy(false);
    setError(err);
    if (err) return;
    setSent(true);
    setCode("");
  };
  const verify = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const ok = await p.verifyCode(contact, code);
    setBusy(false);
    if (ok) nav("/my");
    else setError(ft.wrongCode);
  };
  const tryDemo = async () => {
    setBusy(true);
    const err = await p.demoFamily();
    setBusy(false);
    if (err) setError(err);
    else nav("/my");
  };
  const latestCode = p.state.inbox[0]?.body.match(/\b\d{6}\b/)?.[0];

  return (
    <div className="mx-auto max-w-md px-4 py-10 sm:py-16">
      <span className="mb-5 grid size-12 place-items-center rounded-2xl bg-white text-teal-700 shadow-sm ring-1 ring-teal-100" aria-hidden>
        <HeartHandshake className="size-6" />
      </span>
      <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{ft.signInTitle}</h1>
      <p className="mt-2 text-slate-600">{ft.signInLead}</p>
      <Card className="mt-6">
        {!sent ? (
          <form onSubmit={send} className="space-y-4">
            <label className="block">
              <span className="text-sm font-medium text-slate-800">{ft.contactLabel}</span>
              <input
                value={contact}
                onChange={(e) => {
                  setContact(e.target.value);
                  if (error) setError(null);
                }}
                autoComplete="email"
                inputMode="email"
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none focus:border-teal-500"
              />
              <span className="mt-1 block text-xs text-slate-500">{ft.contactHint}</span>
            </label>
            {error && (
              <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800 ring-1 ring-inset ring-rose-200">
                {error}
              </p>
            )}
            <button type="submit" disabled={!contact.trim() || busy} className={btn("primary", "w-full py-2.5")}>
              {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
              {ft.sendCode}
            </button>
          </form>
        ) : (
          <form onSubmit={verify} className="space-y-4">
            <p className="text-sm text-slate-700">{ft.codeSent(contact)}</p>
            <label className="block">
              <span className="text-sm font-medium text-slate-800">{ft.codeLabel}</span>
              <input
                autoFocus
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.replace(/\D/g, "").slice(0, 8));
                  if (error) setError(null);
                }}
                inputMode="numeric"
                autoComplete="one-time-code"
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-center font-mono text-2xl tracking-[0.4em] text-slate-900 outline-none focus:border-teal-500"
              />
            </label>
            {error && (
              <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800 ring-1 ring-inset ring-rose-200">
                {error}
              </p>
            )}
            <button type="submit" disabled={code.length < 6 || busy} className={btn("primary", "w-full py-2.5")}>
              {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
              {ft.verify}
            </button>
            <div className="flex flex-wrap justify-between gap-2 text-sm">
              <button
                type="button"
                onClick={() => {
                  setSent(false);
                  setError(null);
                }}
                className="font-medium text-teal-700 underline underline-offset-2"
              >
                {ft.useOther}
              </button>
              {!HOSTED && latestCode && (
                <button
                  type="button"
                  onClick={() => {
                    setCode(latestCode);
                    setError(null);
                  }}
                  className="text-slate-500 underline underline-offset-2 hover:text-slate-800"
                >
                  Demo: fill code from inbox
                </button>
              )}
            </div>
          </form>
        )}
        <p className="mt-4 text-xs text-slate-500">{ft.privacy}</p>
      </Card>

      {HOSTED ? (
        <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white/60 p-4 text-sm">
          <p className="font-medium text-slate-600">No referral of your own? Try a demo family</p>
          <p className="mt-1 text-xs text-slate-500">Synthetic data: two children at Maple Grove and one at Lakeshore ({DEMO_FAMILY.email}).</p>
          <button type="button" onClick={tryDemo} disabled={busy} className={btn("outline", "mt-3 w-full")}>
            {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
            Open the demo family
          </button>
        </div>
      ) : (
        <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white/60 p-4 text-sm">
          <p className="font-medium text-slate-600">{ft.demoTry}</p>
          <ul className="mt-2.5 space-y-1">
            {DEMO_FAMILIES.map((f) => (
              <li key={f.contact}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => send(undefined, f.contact)}
                  className="group flex w-full items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-left hover:bg-slate-100 disabled:opacity-60"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-mono font-medium text-teal-700 group-hover:underline group-hover:underline-offset-2">{f.contact}</span>
                    <span className="block text-xs text-slate-500">{f.note}</span>
                  </span>
                  <ArrowRight className="size-4 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:text-teal-700" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
