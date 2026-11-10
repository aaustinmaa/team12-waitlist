import type { ReactNode } from "react";
import type { ReferralStatus, UnavailableReason } from "../lib/types";

export function Card({ children, className = "", dashed = false, id }: { children: ReactNode; className?: string; dashed?: boolean; id?: string }) {
  return (
    <section
      id={id}
      className={`rounded-2xl bg-white p-5 shadow-sm sm:p-6 ${
        dashed ? "border-2 border-dashed border-indigo-200" : "border border-slate-200"
      } ${className}`}
    >
      {children}
    </section>
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

export function Chip({ tone = "slate", children, icon }: { tone?: Tone; children: ReactNode; icon?: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${tones[tone]}`}>
      {icon}
      {children}
    </span>
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

export function weeksLabel(days: number) {
  if (days < 7) return `${days} day${days === 1 ? "" : "s"}`;
  const w = Math.floor(days / 7);
  return `${w} week${w === 1 ? "" : "s"}`;
}
