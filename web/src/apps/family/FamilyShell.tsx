import { useEffect, useState } from "react";
import { Link, Navigate, Outlet, useLocation } from "react-router";
import { Check, Copy, Languages, Mail, X } from "lucide-react";
import { Brand, DemoFooter, ThemeButton } from "../../components/ThemeButton";
import { PageSkeleton, SkipLink, useScrolled } from "../../components/ui";
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
  const scrolled = useScrolled();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  const signedIn = !!p.state.familySession;
  if (HOSTED && p.state.sync?.loading) return <PageSkeleton />;
  if (!signedIn && pathname !== "/") return <Navigate to="/" replace />;
  if (signedIn && pathname === "/") return <Navigate to="/my" replace />;

  return (
    <div className="flex min-h-dvh flex-col bg-wash" dir={dir} lang={lang}>
      <SkipLink />
      <header
        className={`sticky top-0 z-30 border-b border-slate-200 backdrop-blur-md transition-[box-shadow,background-color] duration-200 print:hidden ${
          scrolled ? "bg-white/95 shadow-xs" : "bg-white/90"
        }`}
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-4 sm:px-6">
          <Link to={signedIn ? "/my" : "/"} className="shrink-0">
            <Brand sub={ft.appSub} />
          </Link>
          <div className="ms-auto flex items-center gap-1.5">
            <label
              data-tour="language"
              className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white py-1 pe-1.5 ps-2 text-sm text-slate-600 transition-[border-color,box-shadow] focus-within:border-teal-500 focus-within:ring-2 focus-within:ring-teal-500/25"
            >
              <Languages className="size-4 shrink-0" aria-hidden />
              <span className="sr-only">Language</span>
              <select
                value={lang}
                onChange={(e) => setLang(e.target.value as LangCode)}
                className="no-field-focus max-w-28 rounded-md bg-transparent py-0.5 text-sm font-medium text-slate-900 outline-none"
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
              <button type="button" onClick={p.signOutFamily} className="whitespace-nowrap rounded-lg px-2.5 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900">
                <span className="hidden sm:inline">{maskContact(p.state.familySession!.contact)} · </span>
                {ft.signOut}
              </button>
            )}
          </div>
        </div>
      </header>
      <main id="main-content" tabIndex={-1} className="relative isolate flex-1 outline-none">
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
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const latest = p.state.inbox[0];
  // Open by itself when a new code arrives.
  useEffect(() => {
    if (latest && Date.now() - new Date(latest.at).getTime() < 3000) setOpen(true);
  }, [latest]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const copyCode = async (id: string, code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedId(id);
      setTimeout(() => setCopiedId((cur) => (cur === id ? null : cur)), 1800);
    } catch {
      /* clipboard blocked */
    }
  };

  return (
    <div className="fixed bottom-4 end-4 z-40 print:hidden">
      {open ? (
        <div className="w-80 max-w-[calc(100vw-2rem)] animate-dialog-in rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-semibold text-slate-900">{ft.inbox.title}</p>
              <p className="text-xs text-slate-500">{ft.inbox.note}</p>
            </div>
            <button onClick={() => setOpen(false)} className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900" aria-label="Close inbox">
              <X className="size-4" />
            </button>
          </div>
          <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto overscroll-contain">
            {p.state.inbox.length === 0 && <li className="text-sm text-slate-500">{ft.inbox.empty}</li>}
            {p.state.inbox.slice(0, 5).map((m) => {
              const code = m.body.match(/\b\d{6}\b/)?.[0];
              return (
                <li key={m.id} className="rounded-xl bg-slate-50 p-3 text-sm ring-1 ring-inset ring-slate-200/70">
                  <p className="text-xs text-slate-500">
                    To {m.to} · {new Date(m.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                  </p>
                  <p className="font-medium text-slate-900">{m.subject}</p>
                  <p className="text-slate-700">{m.body}</p>
                  {code && (
                    <button
                      type="button"
                      onClick={() => void copyCode(m.id, code)}
                      className="mt-2 inline-flex items-center gap-1 rounded-md bg-white px-2 py-1 text-xs font-medium text-teal-700 ring-1 ring-inset ring-slate-200 hover:bg-teal-50"
                    >
                      {copiedId === m.id ? (
                        <>
                          <Check className="size-3.5 text-emerald-700" aria-hidden /> Copied {code}
                        </>
                      ) : (
                        <>
                          <Copy className="size-3.5" aria-hidden /> Copy {code}
                        </>
                      )}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 rounded-full bg-nav px-4 py-2.5 text-sm font-medium text-nav-fg shadow-lg ring-1 ring-white/10 hover:-translate-y-0.5 hover:shadow-xl active:translate-y-0"
        >
          <Mail className="size-4" aria-hidden /> {ft.inbox.title}
          {p.state.inbox.length > 0 && <span className="rounded-full bg-teal-600 px-1.5 py-0.5 text-xs font-semibold leading-none text-white dark:bg-teal-300 dark:text-slate-950">{p.state.inbox.length}</span>}
        </button>
      )}
    </div>
  );
}
