import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme, type ThemeChoice } from "../lib/theme";

const THEME: Record<ThemeChoice, { icon: typeof Sun; label: string }> = {
  system: { icon: Monitor, label: "Same as device" },
  light: { icon: Sun, label: "Light" },
  dark: { icon: Moon, label: "Dark" },
};

/** Light, dark, or follow the device. */
export function ThemeButton() {
  const theme = useTheme();
  const Icon = THEME[theme.choice].icon;
  return (
    <button
      type="button"
      onClick={theme.next}
      title={`Colours: ${THEME[theme.choice].label}. Click to change.`}
      aria-label={`Colours: ${THEME[theme.choice].label}. Change colours`}
      className="group flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
    >
      <Icon className="size-4 transition-transform duration-300 group-hover:-rotate-12" aria-hidden />
      <span className="hidden lg:inline">{THEME[theme.choice].label}</span>
    </button>
  );
}

/** The product's name, in one place so every portal and page title can share it. */
export const PRODUCT_NAME = "ClearWait";

/**
 * The ClearWait mark: a dial whose answer is a highlighted arc (a range of weeks)
 * rather than one time, the way every estimate in the app is a range, not a date.
 * Its colours are fixed so the mark looks the same in light and dark mode; the
 * same drawing is in public/favicon.svg.
 */
export function ClearWaitMark({ className = "size-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={`shrink-0 ${className}`} aria-hidden focusable="false">
      <rect width="64" height="64" rx="15" fill="#33465f" />
      <circle cx="32" cy="32" r="18" fill="none" stroke="#dfe8f6" strokeWidth="3.4" opacity="0.35" />
      <path d="M48.91 25.84A18 18 0 0 1 43.57 45.79" fill="none" stroke="#e7c77c" strokeWidth="6" strokeLinecap="round" />
      <path d="M32 17V21" stroke="#dfe8f6" strokeWidth="3" strokeLinecap="round" />
      <path d="M32 32L42.6 34.8" stroke="#dfe8f6" strokeWidth="3.4" strokeLinecap="round" />
      <circle cx="32" cy="32" r="3.4" fill="#dfe8f6" />
    </svg>
  );
}

/** The product mark and name, shared by every portal. */
export function Brand({ sub, onDark = false }: { sub: string; /** on the staff sidebar's dark background */ onDark?: boolean }) {
  return (
    <span className={`flex items-center gap-3 font-semibold ${onDark ? "text-nav-fg" : "text-slate-900"}`}>
      <ClearWaitMark className={`size-9 rounded-[9px] shadow-sm ${onDark ? "ring-1 ring-white/15" : "dark:ring-1 dark:ring-white/10"}`} />
      {/* Name and portal label on two lines with a little air between them. */}
      <span className="flex min-w-0 flex-col gap-1 leading-none">
        <span className="text-base tracking-tight">{PRODUCT_NAME}</span>
        <span className={`truncate text-xs font-medium ${onDark ? "text-nav-fg/60" : "text-slate-500"}`}>{sub}</span>
      </span>
    </span>
  );
}

/** Footer line shared by both apps: what this build is and isn't. */
export function DemoFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white print:hidden">
      <div className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-4 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>CS 497 Team 12 ({PRODUCT_NAME}) · Fictional clinics, synthetic referrals only</p>
        <p>Wait estimates are statistical ranges, not appointments or medical advice.</p>
      </div>
    </footer>
  );
}
