import { useState } from "react";
import { Bell, Mail, MessageSquare, MonitorSmartphone } from "lucide-react";
import { useDemo } from "../../lib/demoState";
import { useI18n, type Dict } from "../../lib/i18n";
import { CHANNELS, DEFAULT_PREFS } from "../../lib/notifications";
import type { Channel, FamilyReferralResponse, Notice } from "../../lib/types";
import { Card, CardHeading, Switch } from "../ui";

const ICON = { email: Mail, sms: MessageSquare, browser: MonitorSmartphone } as const;

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

/**
 * How the family hears about changes, and the updates sent so far. Email and
 * text go to the contact details the clinic has on file; nothing is typed in.
 */
export function UpdatesCard({ data, id, readOnly = false }: { data: FamilyReferralResponse; id?: string; readOnly?: boolean }) {
  const { t, fmt } = useI18n();
  const { state, setNotifyPref } = useDemo();
  const [problem, setProblem] = useState<"unsupported" | "blocked" | null>(null);
  const rid = data.referral.id;
  const prefs = state.notifyPrefs[rid] ?? DEFAULT_PREFS;
  const mine = state.notices.filter((n) => n.referral_id === rid).slice(0, 5);
  const detail: Record<Channel, string | undefined> = { email: data.contact_on_file?.email, sms: data.contact_on_file?.phone, browser: undefined };

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
      <CardHeading id={id ? `${id}-heading` : undefined}>{t.notify.heading}</CardHeading>
      <p className="mt-3 text-sm text-slate-700">{t.notify.weTell}</p>
      <ul className="mt-1 list-disc space-y-0.5 ps-5 text-sm text-slate-600">
        {t.notify.events.map((e) => (
          <li key={e}>{e}</li>
        ))}
      </ul>

      <p className="mt-4 text-sm font-medium text-slate-900">{t.notify.how}</p>
      <ul className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-200">
        {CHANNELS.map((c) => {
          const Icon = ICON[c];
          return (
            <li key={c} className="flex items-center gap-3 px-3 py-2.5">
              <Icon className="size-5 shrink-0 text-slate-500" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-slate-900">{t.notify.channel[c]}</span>
                {detail[c] && (
                  <span className="block text-sm text-slate-500" dir="ltr">
                    {detail[c]}
                  </span>
                )}
              </span>
              <span className="text-xs text-slate-500" aria-hidden>
                {prefs[c] ? t.notify.on : t.notify.off}
              </span>
              <Switch checked={prefs[c]} onChange={(on) => void toggle(c, on)} label={t.notify.channel[c]} disabled={readOnly} />
            </li>
          );
        })}
      </ul>
      {problem && (
        <p role="alert" className="mt-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-950 ring-1 ring-amber-200">
          {problem === "unsupported" ? t.notify.unsupported : t.notify.blocked}
        </p>
      )}
      <p className="mt-2 text-xs text-slate-500">{readOnly ? t.notify.staffPreview : t.notify.onFile}</p>

      <h3 className="mt-5 text-sm font-medium text-slate-900">{t.notify.recent}</h3>
      {mine.length === 0 ? (
        <p className="mt-1 text-sm text-slate-500">{t.notify.empty}</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {mine.map((n) => {
            const { title, body } = noticeText(t, n);
            return (
              <li key={n.id} className="flex gap-3 rounded-xl bg-slate-50 p-3">
                <Bell className="mt-0.5 size-4 shrink-0 text-slate-500" aria-hidden />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900">{title}</p>
                  <p className="text-sm text-slate-600">{body}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {fmt.stamp(n.at)} · {n.channels.length ? t.notify.sentBy(t.units.list(n.channels.map((c) => t.notify.channelShort[c]))) : t.notify.pageOnly}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-3 text-xs text-slate-400">{t.notify.prototype}</p>
    </Card>
  );
}
