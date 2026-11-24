import { useEffect, useId, useState } from "react";
import { Bell, CheckCircle2, ChevronDown, Mail, MessageSquare, MonitorSmartphone } from "lucide-react";
import { contactDetails, normalize, type ContactField } from "../../lib/contact";
import { useDemo } from "../../lib/demoState";
import { useI18n, type Dict } from "../../lib/i18n";
import { CHANNELS, DEFAULT_PREFS } from "../../lib/notifications";
import type { Channel, FamilyReferralResponse, Notice } from "../../lib/types";
import { btn, Card, CardHeading, Switch } from "../ui";

const ICON = { email: Mail, sms: MessageSquare, browser: MonitorSmartphone } as const;
const FIELD: Partial<Record<Channel, ContactField>> = { email: "email", sms: "phone" };

/** Other parts of the page (the estimate card) ask this card to open its settings. */
export const OPEN_NOTIFY_SETTINGS = "team12:open-notify-settings";

/** Title and one-line body of an update, in the family's language. */
export function noticeText(t: Dict, n: Notice) {
  const body =
    n.kind === "estimate_ready" && n.range
      ? t.notify.bodyReady(n.range)
      : n.kind === "estimate_changed" && n.range && n.previous
        ? t.notify.bodyChanged(n.range, n.previous)
        : t.notify.bodyPaused;
  return { title: t.notify.title[n.kind], body };
}

export const browserNotifications = {
  supported: () => typeof window !== "undefined" && "Notification" in window,
  permission: () => (typeof window !== "undefined" && "Notification" in window ? Notification.permission : "denied"),
};

/** The switched-on channels for a referral, each with where it goes. */
export function useActiveChannels(data: FamilyReferralResponse) {
  const { state } = useDemo();
  const prefs = state.notifyPrefs[data.referral.id] ?? DEFAULT_PREFS;
  const details = contactDetails(data.contact_on_file, state.contacts[data.referral.id]);
  const to: Record<Channel, string> = { email: details.email.value, sms: details.phone.value, browser: "" };
  return CHANNELS.filter((c) => prefs[c]).map((c) => ({ channel: c, to: to[c] }));
}

/**
 * How the family hears about changes. Closed, it is one line per channel that
 * is on; opened, the family switches channels on or off and can replace the
 * clinic's email or mobile number with their own.
 */
export function UpdatesCard({ data, id, readOnly = false }: { data: FamilyReferralResponse; id?: string; readOnly?: boolean }) {
  const { t, fmt } = useI18n();
  const { state, setNotifyPref } = useDemo();
  const [open, setOpen] = useState(false);
  const [problem, setProblem] = useState<"unsupported" | "blocked" | null>(null);
  const [allNotices, setAllNotices] = useState(false);
  const panelId = useId();
  const rid = data.referral.id;
  const prefs = state.notifyPrefs[rid] ?? DEFAULT_PREFS;
  const details = contactDetails(data.contact_on_file, state.contacts[rid]);
  const active = useActiveChannels(data);
  const mine = state.notices.filter((n) => n.referral_id === rid);
  const shown = allNotices ? mine.slice(0, 10) : mine.slice(0, 1);

  useEffect(() => {
    if (readOnly) return;
    const onOpen = () => setOpen(true);
    window.addEventListener(OPEN_NOTIFY_SETTINGS, onOpen);
    return () => window.removeEventListener(OPEN_NOTIFY_SETTINGS, onOpen);
  }, [readOnly]);

  const toggle = async (channel: Channel, on: boolean) => {
    setProblem(null);
    if (channel === "browser" && on) {
      if (!browserNotifications.supported()) return setProblem("unsupported");
      const permission = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
      if (permission !== "granted") return setProblem("blocked");
    }
    setNotifyPref(rid, channel, on);
  };

  return (
    <Card id={id} tour="notify" className="scroll-mt-20">
      <CardHeading icon={Bell} id={id ? `${id}-heading` : undefined}>{t.notify.heading}</CardHeading>
      <p className="mt-2 text-sm text-slate-600">{t.notify.when}</p>

      {/* Closed: where updates go now. */}
      <p className="mt-3 text-xs font-medium text-slate-500">{t.notify.goesTo}</p>
      {active.length === 0 ? (
        <p className="mt-1 text-sm text-slate-700">{t.notify.noChannel}</p>
      ) : (
        <ul className="mt-1 space-y-1">
          {active.map(({ channel, to }) => {
            const Icon = ICON[channel];
            return (
              <li key={channel} className="flex min-w-0 items-center gap-2 text-sm text-slate-800">
                <Icon className="size-4 shrink-0 text-slate-500" aria-hidden />
                <span className="shrink-0">{t.notify.channel[channel]}</span>
                {to && (
                  <span className="min-w-0 truncate text-slate-500" dir="ltr">
                    {to}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {!readOnly && (
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen(!open)}
          className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-teal-700 underline underline-offset-2 hover:text-teal-800"
        >
          {open ? t.notify.done : t.notify.settings}
          <ChevronDown className={`size-4 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
        </button>
      )}

      {/* Open: the settings. */}
      {open && !readOnly && (
        <div id={panelId} className="mt-3">
          <p className="text-sm font-medium text-slate-900">{t.notify.how}</p>
          <ul className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-200">
            {CHANNELS.map((c) => (
              <ChannelRow
                key={c}
                referralId={rid}
                channel={c}
                on={prefs[c]}
                detail={FIELD[c] ? details[FIELD[c]!] : undefined}
                onToggle={(on) => void toggle(c, on)}
              />
            ))}
          </ul>
          {problem && (
            <p role="alert" className="mt-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-950 ring-1 ring-amber-200">
              {problem === "unsupported" ? t.notify.unsupported : t.notify.blocked}
            </p>
          )}
        </div>
      )}
      {readOnly && <p className="mt-2 text-xs text-slate-500">{t.notify.staffPreview}</p>}

      <div className="mt-4 border-t border-slate-100 pt-3">
        <h3 className="text-xs font-medium text-slate-500">{t.notify.recent}</h3>
        {mine.length === 0 ? (
          <p className="mt-1 text-sm text-slate-500">{t.notify.empty}</p>
        ) : (
          <>
            <ul className="mt-2 space-y-2">
              {shown.map((n) => {
                const { title, body } = noticeText(t, n);
                return (
                  <li key={n.id} className="flex gap-3 rounded-xl bg-slate-50 p-3">
                    <Bell className="mt-0.5 size-4 shrink-0 text-slate-500" aria-hidden />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900">{title}</p>
                      <p className="text-sm text-slate-600">{body}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {fmt.stamp(n.at)} ·{" "}
                        {n.channels.length ? t.notify.sentBy(t.units.list(n.channels.map((c) => t.notify.channelShort[c]))) : t.notify.pageOnly}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
            {mine.length > 1 && (
              <button type="button" onClick={() => setAllNotices(!allNotices)} className="mt-2 text-sm font-medium text-teal-700 underline underline-offset-2">
                {allNotices ? t.notify.showFewer : t.notify.showAll(mine.length)}
              </button>
            )}
          </>
        )}
      </div>
      <p className="mt-3 text-xs text-slate-400">{t.notify.prototype}</p>
    </Card>
  );
}

/** One channel: a switch, and for email and text the address it goes to, which the family can change. */
function ChannelRow({
  referralId,
  channel,
  on,
  detail,
  onToggle,
}: {
  referralId: string;
  channel: Channel;
  on: boolean;
  detail?: { value: string; entered: boolean };
  onToggle: (on: boolean) => void;
}) {
  const { t } = useI18n();
  const { setContact, setNotifyPref } = useDemo();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState(false);
  const [saved, setSaved] = useState(false);
  const inputId = useId();
  const errorId = useId();
  const field = FIELD[channel];
  const Icon = ICON[channel];

  const start = () => {
    setDraft(detail?.entered ? detail.value : "");
    setError(false);
    setSaved(false);
    setEditing(true);
  };
  const save = () => {
    const value = field ? normalize(field, draft) : null;
    if (!field || !value) return setError(true);
    setContact(referralId, field, value);
    // Giving a number or address means they want updates there.
    setNotifyPref(referralId, channel, true);
    setEditing(false);
    setSaved(true);
  };

  return (
    <li className="px-3 py-2.5">
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 size-5 shrink-0 text-slate-500" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-slate-900">{t.notify.channel[channel]}</p>
          {detail && !editing && (
            <>
              <p className="truncate text-sm text-slate-700" dir="ltr">
                {detail.value || "—"}
              </p>
              <p className="text-xs text-slate-500">
                {detail.entered ? t.notify.yours : t.notify.fromClinic} ·{" "}
                <button type="button" onClick={start} className="font-medium text-teal-700 underline underline-offset-2 hover:text-teal-800">
                  {detail.value ? t.notify.change : t.notify.add}
                </button>
              </p>
            </>
          )}
        </div>
        <Switch checked={on} onChange={onToggle} label={t.notify.channel[channel]} />
      </div>

      {editing && field && (
        <form
          className="mt-2 ps-8"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <label htmlFor={inputId} className="block text-xs font-medium text-slate-600">
            {field === "email" ? t.notify.emailLabel : t.notify.phoneLabel}
          </label>
          <input
            id={inputId}
            type={field === "email" ? "email" : "tel"}
            inputMode={field === "email" ? "email" : "tel"}
            autoComplete={field === "email" ? "email" : "tel-national"}
            dir="ltr"
            autoFocus
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              setError(false);
            }}
            placeholder={field === "email" ? "name@example.com" : "519-555-0123"}
            aria-invalid={error}
            aria-describedby={error ? errorId : undefined}
            className={`mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-teal-500 ${
              error ? "border-rose-500" : "border-slate-300"
            }`}
          />
          {error && (
            <p id={errorId} className="mt-1 text-xs font-medium text-rose-700">
              {field === "email" ? t.notify.invalidEmail : t.notify.invalidPhone}
            </p>
          )}
          <div className="mt-2 flex gap-2">
            <button type="submit" className={btn("primary", "px-3 py-1.5")}>
              {t.notify.save}
            </button>
            <button type="button" onClick={() => setEditing(false)} className={btn("outline", "px-3 py-1.5")}>
              {t.notify.cancel}
            </button>
          </div>
        </form>
      )}
      {saved && !editing && (
        <p role="status" className="mt-1 flex animate-fade-in items-center gap-1 ps-8 text-xs font-medium text-emerald-700">
          <CheckCircle2 className="size-3.5" aria-hidden />
          {t.notify.saved}
        </p>
      )}
    </li>
  );
}
