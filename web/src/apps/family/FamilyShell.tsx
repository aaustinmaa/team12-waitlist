import { useEffect, useState } from "react";
import { Link, Navigate, Outlet, useLocation } from "react-router";
import { Languages, LogOut, Mail, X } from "lucide-react";
import { Brand, DemoFooter, ThemeButton } from "../../components/ThemeButton";
import { PageSkeleton } from "../../components/ui";
import { LANGS, useI18n, type LangCode } from "../../lib/i18n";
import { maskContact, usePlatform } from "../../platform/store";
import { HOSTED } from "../../platform/hosted";
import { FAMILY_TEXT } from "./text";

export function useFamilyText() {
  const { lang } = useI18n();
  return FAMILY_TEXT[lang];
}

/** The family app: phone-first, signed in with a one-time code. */
export function FamilyShell() {
  const { pathname } = useLocation();
  const p = usePlatform();
  const ft = useFamilyText();
  const { lang, setLang, dir } = useI18n();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  const signedIn = !!p.state.familySession;
  if (HOSTED && p.state.sync?.loading) return <PageSkeleton />;
  if (!signedIn && pathname !== "/") return <Navigate to="/" replace />;
  if (signedIn && pathname === "/") return <Navigate to="/my" replace />;

  return (
    <div className="flex min-h-dvh flex-col bg-wash" dir={dir} lang={lang}>
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur print:hidden">
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-3.5 sm:px-6">
          <Link to={signedIn ? "/my" : "/"} className="shrink-0">
            <Brand sub={ft.appSub} />
          </Link>
          <div className="ms-auto flex items-center gap-1">
            <label data-tour="language" className="flex items-center gap-1.5 rounded-lg py-1 ps-2 pe-1 text-sm text-slate-600 ring-1 ring-inset ring-slate-300">
              <Languages className="hidden size-4 shrink-0 sm:block" aria-hidden />
              <span className="sr-only">Language</span>
              <select
                value={lang}
                onChange={(e) => setLang(e.target.value as LangCode)}
                className="max-w-28 rounded-md bg-white py-0.5 text-sm font-medium text-slate-900 outline-none"
              >
                {LANGS.map((l) => (
                  <option key={l.code} value={l.code} lang={l.code}>
                    {l.name}
                  </option>
                ))}
              </select>
            </label>
            <ThemeButton />
            {signedIn && (
              <button
                type="button"
                onClick={p.signOutFamily}
                title={ft.signOut}
                className="flex items-center whitespace-nowrap rounded-lg px-2 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
              >
                {/* Phones: an icon, so the header fits next to the language and colour switches. */}
                <LogOut className="size-4 sm:hidden" aria-hidden />
                <span className="sr-only sm:not-sr-only">
                  <span className="hidden sm:inline">{maskContact(p.state.familySession!.contact)} · </span>
                  {ft.signOut}
                </span>
              </button>
            )}
          </div>
        </div>
      </header>
      <main className="relative isolate flex-1">
        {/* The family app is warmer than the staff portal: a soft wash of brand blue fading into a plain, hue-free light grey behind the top of each page. */}
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-96 bg-linear-to-b from-teal-50/80 to-transparent print:hidden" />
        {/* Keyed by page so each new page fades in instead of popping. */}
        <div key={pathname} className="animate-page-in">
          <Outlet />
        </div>
      </main>
      <DemoFooter />
      {!HOSTED && <DemoInbox />}
    </div>
  );
}

/** Stand-in for the family's email or text messages in the demo. */
export function DemoInbox() {
  const p = usePlatform();
  const ft = useFamilyText();
  const [open, setOpen] = useState(false);
  const latest = p.state.inbox[0];
  // Open by itself when a new code arrives.
  useEffect(() => {
    if (latest && Date.now() - new Date(latest.at).getTime() < 3000) setOpen(true);
  }, [latest]);
  return (
    <div className="fixed bottom-4 end-4 z-40 print:hidden">
      {open ? (
        <div className="w-80 max-w-[calc(100vw-2rem)] rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-semibold text-slate-900">{ft.inbox.title}</p>
              <p className="text-xs text-slate-500">{ft.inbox.note}</p>
            </div>
            <button onClick={() => setOpen(false)} className="rounded-lg p-1 text-slate-500 hover:bg-slate-100" aria-label="Close inbox">
              <X className="size-4" />
            </button>
          </div>
          <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto">
            {p.state.inbox.length === 0 && <li className="text-sm text-slate-500">{ft.inbox.empty}</li>}
            {p.state.inbox.slice(0, 5).map((m) => (
              <li key={m.id} className="rounded-xl bg-slate-50 p-3 text-sm">
                <p className="text-xs text-slate-500">
                  To {m.to} · {new Date(m.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                </p>
                <p className="font-medium text-slate-900">{m.subject}</p>
                <p className="text-slate-700">{m.body}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <button onClick={() => setOpen(true)} className="flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-lg hover:-translate-y-0.5 hover:bg-slate-800 hover:shadow-xl">
          <Mail className="size-4" aria-hidden /> {ft.inbox.title}
          {p.state.inbox.length > 0 && <span className="rounded-full bg-teal-500 px-1.5 text-xs text-white dark:text-slate-950">{p.state.inbox.length}</span>}
        </button>
      )}
    </div>
  );
}
