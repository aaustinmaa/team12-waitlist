import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, NavLink, useParams } from "react-router";
import { Bell, Compass, Languages, RefreshCw, X } from "lucide-react";
import { FamilyReferralView } from "../components/FamilyReferralView";
import { browserNotifications, noticeText } from "../components/family/UpdatesCard";
import { Tour, type TourStep } from "../components/Tour";
import { CLINIC, getFamilyReferral } from "../lib/api";
import { useDemo } from "../lib/demoState";
import { LANGS, useI18n, type LangCode } from "../lib/i18n";
import { DEFAULT_PREFS } from "../lib/notifications";
import type { Notice } from "../lib/types";

export const FAMILY_CASES = [
  { id: "demo-001", label: "Estimate available", hint: "Waiting, with a wait range" },
  { id: "demo-002", label: "No estimate yet", hint: "Waiting, intake info still under review" },
  { id: "demo-003", label: "Assessment booked", hint: "Confirmed first-assessment date" },
];

const TOUR = "family";

export function FamilyPage() {
  const { id = "" } = useParams();
  const { state, isBaseline, reset, markTourSeen } = useDemo();
  const { t, lang, setLang, dir, fmt } = useI18n();
  const data = getFamilyReferral(id, state);
  const [touring, setTouring] = useState(false);
  const fresh = useNewNotices(id);

  // First visit in this browser: offer the tour once the page has been laid out.
  const seen = state.toursSeen.includes(TOUR);
  useEffect(() => {
    if (seen || !data) return;
    const timer = setTimeout(() => setTouring(true), 400);
    return () => clearTimeout(timer);
    // Only on arrival; switching demo cases must not restart it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const closeTour = useCallback(() => {
    setTouring(false);
    markTourSeen(TOUR);
  }, [markTourSeen]);

  const steps = useMemo<TourStep[]>(
    () => [
      { target: "status", ...t.tour.status },
      { target: "estimate", ...t.tour.estimate },
      { target: "appointment", ...t.tour.appointment },
      { target: "notify", ...t.tour.notify },
      { target: "steps", ...t.tour.steps },
      { target: "contact", ...t.tour.contact },
      { target: "wait", ...t.tour.wait },
      { target: "language", ...t.tour.language },
    ],
    [t],
  );

  if (!data) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center" dir={dir} lang={lang}>
        <h1 className="text-2xl font-semibold text-slate-900">{t.page.notFoundTitle}</h1>
        <p className="mt-2 text-slate-600">{t.page.notFoundBody(CLINIC.contact)}</p>
        <Link to="/family/demo-001" className="mt-6 inline-block font-medium text-teal-700 underline">
          {t.page.notFoundLink}
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between" dir={dir} lang={lang}>
        <div>
          <p className="text-sm font-medium text-slate-600">{t.page.portal(CLINIC.name)}</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl rtl:tracking-normal">{t.page.title}</h1>
          <p className="mt-1 text-slate-600">{t.page.service}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label data-tour="language" className="flex items-center gap-2 rounded-lg bg-white py-1 ps-3 pe-1 text-sm text-slate-600 ring-1 ring-inset ring-slate-300">
            <Languages className="size-4 shrink-0" aria-hidden />
            <span>{t.page.language}</span>
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value as LangCode)}
              className="rounded-md bg-white py-1 pe-1 ps-1 text-sm font-medium text-slate-900 outline-none focus-visible:outline-2 focus-visible:outline-teal-500"
            >
              {LANGS.map((l) => (
                <option key={l.code} value={l.code} lang={l.code}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => setTouring(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-sm font-medium text-slate-700 ring-1 ring-inset ring-slate-300 hover:bg-slate-50"
          >
            <Compass className="size-4" aria-hidden />
            {t.page.tour}
          </button>
        </div>
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

      {/* A new update arrived while this page was open (for example, staff just completed intake in another tab). */}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-4 print:hidden">
        {fresh.notice && (
          <div dir={dir} lang={lang} className="pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-2xl bg-slate-900 p-4 text-white shadow-2xl">
            <Bell className="mt-0.5 size-5 shrink-0" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-slate-300">
                {t.notify.newUpdate} · {fmt.stamp(fresh.notice.at)}
              </p>
              <p className="font-semibold">{noticeText(t, fresh.notice).title}</p>
              <p className="text-sm text-slate-200">{noticeText(t, fresh.notice).body}</p>
            </div>
            <button type="button" onClick={fresh.dismiss} aria-label={t.notify.dismiss} className="rounded-lg p-1 text-slate-300 hover:bg-white/10 hover:text-white">
              <X className="size-5" aria-hidden />
            </button>
          </div>
        )}
      </div>

      {touring && <Tour steps={steps} labels={t.tour} onClose={closeTour} dir={dir} lang={lang} />}
    </div>
  );
}

/**
 * Watches for updates that arrive for this referral while the page is open.
 * Shows the newest one on the page and, when the family switched on device
 * notifications, as a system notification too.
 */
function useNewNotices(referralId: string) {
  const { state } = useDemo();
  const { t } = useI18n();
  const known = useRef<Set<string> | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  useEffect(() => {
    const mine = state.notices.filter((n) => n.referral_id === referralId);
    // What was already there when the page opened (or the case was switched) is not news.
    if (known.current === null) {
      known.current = new Set(mine.map((n) => n.id));
      return;
    }
    const fresh = mine.filter((n) => !known.current!.has(n.id));
    if (fresh.length === 0) return;
    fresh.forEach((n) => known.current!.add(n.id));
    const newest = fresh[0];
    setNotice(newest);
    const prefs = state.notifyPrefs[referralId] ?? DEFAULT_PREFS;
    if (prefs.browser && browserNotifications.permission() === "granted") {
      const { title, body } = noticeText(t, newest);
      try {
        new Notification(title, { body, tag: newest.id });
      } catch {
        /* some mobile browsers only allow notifications from a service worker; the page banner still shows */
      }
    }
  }, [state.notices, state.notifyPrefs, referralId, t]);

  // A different referral has its own history.
  useEffect(() => {
    known.current = null;
    setNotice(null);
  }, [referralId]);

  return { notice, dismiss: () => setNotice(null) };
}
