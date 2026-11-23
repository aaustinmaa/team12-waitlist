import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import { ArrowLeft, Bell, Compass, X } from "lucide-react";
import { FamilyReferralView } from "../../components/FamilyReferralView";
import { browserNotifications, noticeText } from "../../components/family/UpdatesCard";
import { Tour, type TourStep } from "../../components/Tour";
import { Card, CardHeading } from "../../components/ui";
import { contactKey, getFamilyReferral, referralsForContact, type ClinicView } from "../../lib/api";
import { useDemo } from "../../lib/demoState";
import { useI18n } from "../../lib/i18n";
import { DEFAULT_PREFS } from "../../lib/notifications";
import type { Notice } from "../../lib/types";
import { ClinicScope, usePlatform } from "../../platform/store";
import { useFamilyText } from "./FamilyShell";

const TOUR = "family";

/** One referral, for the signed-in family only. */
export function FamilyReferralPage() {
  const { clinicId = "", refId = "" } = useParams();
  const p = usePlatform();
  const ft = useFamilyText();
  const v = p.view(clinicId);
  const contact = p.state.familySession?.contact ?? "";
  // A family may only open referrals linked to their own email or phone.
  const mine = !!v && referralsForContact(v, contact).some((r) => r.referral_id === refId) && contactKey(contact) !== "";
  if (!v || !mine) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <p className="text-slate-700">{ft.none}</p>
        <Link to="/my" className="mt-6 inline-block font-medium text-teal-700 underline">
          {ft.homeTitle}
        </Link>
      </div>
    );
  }
  return (
    <ClinicScope clinicId={clinicId}>
      <ReferralBody v={v} id={refId} />
    </ClinicScope>
  );
}

function ReferralBody({ v, id }: { v: ClinicView; id: string }) {
  const { state, markTourSeen } = useDemo();
  const p = usePlatform();
  const ft = useFamilyText();
  const { t, lang, dir, fmt } = useI18n();
  const data = getFamilyReferral(v, id);
  const opened = useRef(false);
  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    p.log(v.id, "Family viewed referral", id, id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
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
      // Same order as the page: down the main column, then down the side column (which follows it on a phone).
      { target: "steps", ...t.tour.steps },
      { target: "contact", ...t.tour.contact },
      { target: "notify", ...t.tour.notify },
      { target: "wait", ...t.tour.wait },
      { target: "language", ...t.tour.language },
    ],
    [t],
  );

  if (!data) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center" dir={dir} lang={lang}>
        <h1 className="text-2xl font-semibold text-slate-900">{t.page.notFoundTitle}</h1>
        <p className="mt-2 text-slate-600">{t.page.notFoundBody(v.info.contact)}</p>
        <Link to="/my" className="mt-6 inline-block font-medium text-teal-700 underline">
          {ft.homeTitle}
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between" dir={dir} lang={lang}>
        <div>
          <Link to="/my" className="inline-flex items-center gap-1 text-sm font-medium text-teal-700">
            <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden /> {ft.homeTitle}
          </Link>
          <p className="mt-3 text-sm font-medium text-slate-600">{t.page.portal(v.info.name)}</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl rtl:tracking-normal">{t.page.title}</h1>
          <p className="mt-1 text-slate-600">{v.info.service}</p>
          <p className="mt-1 text-xs text-slate-500">{ft.dataAsOf(fmt.long(v.asOf))}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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

      <HowEstimated v={v} />

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
/** Plain-language account of where the range comes from, with the clinic's own back-test result. */
function HowEstimated({ v }: { v: ClinicView }) {
  const ft = useFamilyText();
  const { dir, lang } = useI18n();
  const bt = v.model.backtest;
  return (
    <Card className="mt-6" id="how-estimated">
      <div dir={dir} lang={lang}>
        <CardHeading>{ft.how.title}</CardHeading>
        <p className="mt-2 text-slate-700">{ft.how.body(v.info.name)}</p>
        {v.model.gate.familyVisible && bt.coverage !== null && <p className="mt-2 text-slate-700">{ft.how.held(Math.round(bt.coverage * 100), bt.resolved)}</p>}
        <p className="mt-2 text-sm text-slate-500">{ft.how.gate}</p>
        <p className="mt-1 text-sm text-slate-500">{ft.how.notMedical}</p>
      </div>
    </Card>
  );
}

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
