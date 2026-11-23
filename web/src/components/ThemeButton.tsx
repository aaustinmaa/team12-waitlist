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

/** The product mark, shared by both apps. */
export function Brand({ sub, onDark = false }: { sub: string; /** on the staff sidebar's dark background */ onDark?: boolean }) {
  return (
    <span className={`flex items-center gap-2.5 font-semibold ${onDark ? "text-nav-fg" : "text-slate-900"}`}>
      <span
        className={`grid size-8 shrink-0 place-items-center rounded-lg text-sm font-bold tracking-tight shadow-sm ring-1 ring-inset ${
          onDark ? "bg-nav-accent text-nav ring-white/10" : "bg-teal-700 text-white ring-black/5 dark:bg-teal-300 dark:text-slate-950 dark:ring-white/10"
        }`}
        aria-hidden
      >
        EB
      </span>
      <span className="min-w-0 leading-tight">
        Early Birds
        <span className={`block truncate text-xs font-medium ${onDark ? "text-nav-fg/60" : "text-slate-500"}`}>{sub}</span>
      </span>
    </span>
  );
}

/** Footer line shared by both apps: what this build is and isn't. */
export function DemoFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white print:hidden">
      <div className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-4 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>CS 497 Team 12 (Early Birds) · Fictional clinics, synthetic referrals only</p>
        <p>Wait estimates are statistical ranges, not appointments or medical advice.</p>
      </div>
    </footer>
  );
}
