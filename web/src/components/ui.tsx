import type { ReactNode } from "react";
import type { Priority, ReferralStatus, UnavailableReason } from "../lib/types";

export function Card({
  children,
  className = "",
  dashed = false,
  id,
  tour,
}: {
  children: ReactNode;
  className?: string;
  dashed?: boolean;
  id?: string;
  /** name of the guided-tour step that points at this card */
  tour?: string;
}) {
  return (
    <section
      id={id}
      data-tour={tour}
      className={`rounded-2xl bg-white p-5 shadow-sm sm:p-6 ${
        dashed ? "border-2 border-dashed border-indigo-200" : "border border-slate-200"
      } ${className}`}
    >
      {children}
    </section>
  );
}

/** Small section heading used at the top of cards. Letter-spacing is dropped in right-to-left scripts, where it breaks joined letters. */
export function CardHeading({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <h2 id={id} tabIndex={id ? -1 : undefined} className="text-sm font-semibold uppercase tracking-wide text-slate-500 outline-none rtl:tracking-normal">
      {children}
    </h2>
  );
}

const tones = {
  teal: "bg-teal-50 text-teal-800 ring-teal-200",
  indigo: "bg-indigo-50 text-indigo-800 ring-indigo-200",
  amber: "bg-amber-50 text-amber-900 ring-amber-200",
  slate: "bg-slate-100 text-slate-700 ring-slate-200",
  rose: "bg-rose-50 text-rose-800 ring-rose-200",
  green: "bg-emerald-50 text-emerald-800 ring-emerald-200",
} as const;

export type Tone = keyof typeof tones;

/** A status badge. Colour carries the status; it is never a control. */
export function Chip({ tone = "slate", children, icon }: { tone?: Tone; children: ReactNode; icon?: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${tones[tone]}`}>
      {icon}
      {children}
    </span>
  );
}

/**
 * A plain grey label for information that is not a status and cannot be
 * clicked ("Confirmed by the clinic", "Estimate · may change"). Colour and a
 * pill shape are kept for things that are a status or a control.
 */
export function Tag({ children, icon }: { children: ReactNode; icon?: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500">
      {icon}
      {children}
    </span>
  );
}

const BTN = {
  primary: "bg-teal-700 text-white hover:bg-teal-800",
  dark: "bg-slate-900 text-white hover:bg-slate-800",
  outline: "bg-white text-slate-700 ring-1 ring-inset ring-slate-300 hover:bg-slate-50",
  soft: "bg-amber-100 text-amber-900 hover:bg-amber-200",
} as const;

/** A control that can't be used right now is grey, whatever colour it has when it can. */
export const DISABLED =
  "disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 disabled:ring-1 disabled:ring-inset disabled:ring-slate-200 disabled:hover:bg-slate-100";

/** Class names for a button or a link that looks like one. */
export function btn(variant: keyof typeof BTN = "primary", extra = "") {
  return `inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${BTN[variant]} ${DISABLED} ${extra}`;
}

export function Switch({ checked, onChange, label, disabled = false }: { checked: boolean; onChange: (on: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:bg-slate-200 ${
        checked ? "bg-teal-700" : "bg-slate-400"
      }`}
    >
      <span
        className={`inline-block size-5 rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-[22px] rtl:-translate-x-[22px]" : "translate-x-0.5 rtl:-translate-x-0.5"
        }`}
      />
    </button>
  );
}

export const STATUS_LABEL: Record<ReferralStatus, string> = {
  waiting_for_assessment: "Waiting for first assessment",
  on_hold: "On hold",
  assessment_booked: "Assessment booked",
};

export const STATUS_TONE: Record<ReferralStatus, Tone> = {
  waiting_for_assessment: "teal",
  on_hold: "amber",
  assessment_booked: "green",
};

export const REASON_LABEL: Record<UnavailableReason, string> = {
  intake_incomplete: "Intake info incomplete",
  on_hold: "On hold",
  booked: "Already booked",
  beyond_horizon: "Too far out to estimate",
};

export const PRIORITY_LABEL: Record<Priority, string> = {
  urgent: "Urgent",
  high: "High",
  standard: "Standard",
};

export const PRIORITY_TONE: Record<Priority, Tone> = {
  urgent: "rose",
  high: "amber",
  standard: "slate",
};

export function weeksLabel(days: number) {
  if (days < 7) return `${days} day${days === 1 ? "" : "s"}`;
  const w = Math.floor(days / 7);
  return `${w} week${w === 1 ? "" : "s"}`;
}

/** Scroll a section into view and move keyboard focus to it. Used instead of "#id" links, which the hash router would treat as a page. */
export function jumpTo(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  el.querySelector<HTMLElement>("h2[tabindex]")?.focus({ preventScroll: true });
}
