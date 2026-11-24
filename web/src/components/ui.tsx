import { useEffect, useState, type ReactNode, type RefObject } from "react";
import { ArrowDownRight, ArrowUpRight, CheckCircle2, ChevronsUp, ChevronUp, Minus, type LucideIcon } from "lucide-react";
import type { Priority, ReferralStatus, UnavailableReason } from "../lib/types";

/** A soft two-layer shadow: enough to lift a white card off the grey page without looking heavy. */
export const CARD_SHADOW = "shadow-[0_1px_2px_0_rgb(15_23_42/0.04),0_1px_3px_0_rgb(15_23_42/0.06)]";

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
      className={`rounded-2xl p-5 sm:p-6 ${CARD_SHADOW} ${
        // "dashed" marks an estimate (never a confirmed fact): a periwinkle tint and edge instead of a draft-looking dashed line.
        dashed ? "border border-indigo-200 bg-indigo-50/50" : "border border-slate-200 bg-white"
      } ${className}`}
    >
      {children}
    </section>
  );
}

/** The small square that holds a section's icon. Brand-tinted unless a tone says otherwise. */
export function IconBadge({ icon: Icon, tone = "brand", size = "md" }: { icon: LucideIcon; tone?: keyof typeof METRIC | "brand"; size?: "sm" | "md" }) {
  const color = tone === "brand" ? "bg-teal-50 text-teal-700 ring-teal-100" : METRIC[tone].icon;
  return (
    <span className={`grid shrink-0 place-items-center rounded-lg ring-1 ring-inset ${color} ${size === "sm" ? "size-6" : "size-8"}`} aria-hidden>
      <Icon className={size === "sm" ? "size-3.5" : "size-4"} />
    </span>
  );
}

/** Section heading at the top of a card, with an optional icon. Letter-spacing is dropped in right-to-left scripts, where it breaks joined letters. */
export function CardHeading({ children, id, icon }: { children: ReactNode; id?: string; icon?: LucideIcon }) {
  return (
    <h2 id={id} tabIndex={id ? -1 : undefined} className="flex items-center gap-2.5 text-[0.9375rem] font-semibold text-slate-900 outline-none">
      {icon && <IconBadge icon={icon} size="sm" />}
      <span className="min-w-0">{children}</span>
    </h2>
  );
}

/**
 * What kind of number a figure is. The same kind has the same colour on every
 * staff page, so the colour itself says "this is a wait" or "this is an estimate".
 */
export const METRIC = {
  count: { label: "Children", value: "text-slate-900", icon: "bg-slate-100 text-slate-600 ring-slate-200", dot: "bg-slate-500" },
  wait: { label: "Time waited", value: "text-teal-800", icon: "bg-teal-50 text-teal-700 ring-teal-100", dot: "bg-teal-600" },
  estimate: { label: "Estimated range", value: "text-indigo-800", icon: "bg-indigo-50 text-indigo-700 ring-indigo-100", dot: "bg-indigo-500" },
  quality: { label: "Estimates that held", value: "text-emerald-800", icon: "bg-emerald-50 text-emerald-700 ring-emerald-100", dot: "bg-emerald-600" },
  attention: { label: "Needs attention", value: "text-amber-800", icon: "bg-amber-50 text-amber-800 ring-amber-100", dot: "bg-amber-500" },
} as const;
export type MetricKind = keyof typeof METRIC;

/** A one-line key for the number colours, shown once near the top of a staff page. */
export function MetricKey({ kinds = ["count", "wait", "estimate", "quality"] }: { kinds?: MetricKind[] }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500" aria-label="Number colours">
      {kinds.map((k) => (
        <li key={k} className="flex items-center gap-1.5">
          <span className={`size-2 rounded-full ${METRIC[k].dot}`} aria-hidden />
          {METRIC[k].label}
        </li>
      ))}
    </ul>
  );
}

/**
 * A headline number. `kind` colours the figure; `accent` colours the icon when it
 * should match a status instead (an "On hold" count gets the on-hold colour).
 * `trend` adds an arrow; `good` says whether that direction is good news.
 */
export function StatCard({
  icon,
  label,
  value,
  sub,
  note,
  kind = "count",
  accent,
  trend,
  good,
  className = "",
}: {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  note?: ReactNode;
  kind?: MetricKind;
  accent?: MetricKind;
  trend?: "up" | "down" | "flat";
  good?: boolean | null;
  className?: string;
}) {
  const TrendIcon = trend === "up" ? ArrowUpRight : trend === "down" ? ArrowDownRight : Minus;
  const trendColor = good == null ? "text-slate-500" : good ? "text-emerald-700" : "text-rose-700";
  return (
    <div className={`flex flex-col rounded-2xl border border-slate-200 bg-white p-4 break-inside-avoid ${CARD_SHADOW} ${className}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-slate-600">{label}</p>
        <IconBadge icon={icon} tone={accent ?? kind} />
      </div>
      <p className={`mt-1 text-[1.75rem] font-semibold leading-tight tracking-tight tabular-nums ${METRIC[kind].value}`}>{value}</p>
      {sub && (
        <p className={`mt-1 flex items-center gap-1 text-xs ${trend ? trendColor : "text-slate-500"}`}>
          {trend && <TrendIcon className="size-3.5 shrink-0" aria-hidden />}
          <span>{sub}</span>
        </p>
      )}
      {note && (
        <div className="mt-auto pt-2">
          <p className="border-t border-slate-100 pt-2 text-xs text-slate-600">{note}</p>
        </div>
      )}
    </div>
  );
}

/** Shown where a list or page has nothing in it yet. */
export function EmptyState({ icon: Icon, title, children, action }: { icon: LucideIcon; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-slate-100 text-slate-500 ring-8 ring-slate-50" aria-hidden>
        <Icon className="size-6" />
      </span>
      <p className="mt-4 font-semibold text-slate-900">{title}</p>
      {children && <p className="mt-1 max-w-md text-sm text-slate-500">{children}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/** Grey placeholder blocks while data loads. */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-slate-200/70 ${className}`} aria-hidden />;
}

export function PageSkeleton() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6" role="status" aria-label="Loading">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="mt-3 h-8 w-72" />
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="mt-6 h-64 rounded-2xl" />
    </div>
  );
}

/** A short confirmation ("Downloaded …"), in the same style everywhere. */
export function SuccessNote({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex animate-fade-in items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-sm text-emerald-800 ring-1 ring-inset ring-emerald-200">
      <CheckCircle2 className="size-4 shrink-0" aria-hidden />
      <span>{children}</span>
    </span>
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

// In dark mode the brand button stays a muted blue with light text, rather than
// following the flipped tint scale to a bright, glowing colour.
const BTN = {
  primary:
    "bg-teal-700 text-white shadow-sm shadow-teal-900/10 hover:bg-teal-800 hover:shadow-md hover:shadow-teal-900/15 dark:bg-teal-300 dark:text-slate-950 dark:shadow-none dark:hover:bg-teal-400",
  dark: "bg-slate-900 text-white shadow-sm hover:bg-slate-800 hover:shadow-md",
  outline: "bg-white text-slate-700 shadow-xs ring-1 ring-inset ring-slate-300 hover:bg-slate-50 hover:text-slate-900 hover:ring-slate-400",
  soft: "bg-amber-100 text-amber-900 hover:bg-amber-200",
} as const;

/** A control that can't be used right now is grey, whatever colour it has when it can. */
export const DISABLED =
  "disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 disabled:ring-1 disabled:ring-inset disabled:ring-slate-200 disabled:hover:bg-slate-100";

/** Class names for a button or a link that looks like one. */
export function btn(variant: keyof typeof BTN = "primary", extra = "") {
  // Transitions come from the base layer in index.css; pressing gives a small, quick give.
  return `inline-flex select-none items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold active:scale-[0.98] disabled:active:scale-100 ${BTN[variant]} ${DISABLED} ${extra}`;
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
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full disabled:cursor-not-allowed disabled:bg-slate-200 ${
        checked ? "bg-teal-700 dark:bg-teal-400" : "bg-slate-400 hover:bg-slate-500 dark:bg-slate-300 dark:hover:bg-slate-400"
      }`}
    >
      <span
        className={`inline-block size-5 rounded-full bg-white shadow transition-transform duration-200 ease-[var(--ease-calm)] dark:bg-slate-900 ${
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
  insufficient_data: "Not enough history yet",
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

/** Two chevrons, one, or a level line: the shape says the order even without colour. */
export const PRIORITY_ICON: Record<Priority, LucideIcon> = {
  urgent: ChevronsUp,
  high: ChevronUp,
  standard: Minus,
};

/** Where each priority joins the line. */
export const PRIORITY_ORDER_NOTE: Record<Priority, string> = {
  urgent: "Seen first",
  high: "After urgent",
  standard: "After urgent and high",
};

/** Text and edge colours for a priority, for places that aren't a chip (a select, a column). */
export const PRIORITY_STYLE: Record<Priority, { field: string; edge: string; text: string }> = {
  urgent: { field: "border-rose-200 bg-rose-50 text-rose-800", edge: "border-rose-400", text: "text-rose-700" },
  high: { field: "border-amber-200 bg-amber-50 text-amber-900", edge: "border-amber-400", text: "text-amber-800" },
  standard: { field: "border-slate-300 bg-white text-slate-700", edge: "border-slate-300", text: "text-slate-600" },
};

export function PriorityBadge({ priority, suffix = "" }: { priority: Priority; suffix?: string }) {
  const Icon = PRIORITY_ICON[priority];
  return (
    <Chip tone={PRIORITY_TONE[priority]} icon={<Icon className="size-3.5" aria-hidden />}>
      {PRIORITY_LABEL[priority]}
      {suffix}
    </Chip>
  );
}

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

/** True once the page (or an inner scroll pane) has moved off the top, so sticky headers can show a crisp shadow. */
export function useScrolled(ref?: RefObject<HTMLElement | null>) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const el = ref?.current ?? null;
    const update = () => setScrolled((el ? el.scrollTop : 0) > 4 || window.scrollY > 4);
    update();
    window.addEventListener("scroll", update, { passive: true });
    el?.addEventListener("scroll", update, { passive: true });
    return () => {
      window.removeEventListener("scroll", update);
      el?.removeEventListener("scroll", update);
    };
  }, [ref]);
  return scrolled;
}

/** Prevents the page underneath from scrolling while a dialog or drawer is open. */
export function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [active]);
}

/** Keyboard-only jump over the header straight to main content (used on every portal). */
export function SkipLink({ target = "main-content", label = "Skip to main content" }: { target?: string; label?: string }) {
  return (
    <button
      type="button"
      onClick={() => {
        const el = document.getElementById(target);
        if (!el) return;
        el.focus({ preventScroll: true });
        el.scrollIntoView({ behavior: "auto", block: "start" });
      }}
      className="sr-only fixed start-3 top-3 z-[60] rounded-lg bg-teal-700 px-3 py-2 text-sm font-semibold text-white shadow-lg focus:not-sr-only dark:bg-teal-300 dark:text-slate-950"
    >
      {label}
    </button>
  );
}
