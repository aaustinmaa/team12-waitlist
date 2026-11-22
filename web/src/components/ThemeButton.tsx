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
      className="flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
    >
      <Icon className="size-4" aria-hidden />
      <span className="hidden lg:inline">{THEME[theme.choice].label}</span>
    </button>
  );
}

/** The product mark, shared by both apps. */
export function Brand({ sub }: { sub: string }) {
  return (
    <span className="flex items-center gap-2 font-semibold text-slate-900">
      <span className="grid size-8 place-items-center rounded-lg bg-teal-700 text-sm font-bold text-white" aria-hidden>
        EB
      </span>
      <span className="leading-tight">
        Early Birds
        <span className="block text-xs font-medium text-slate-500">{sub}</span>
      </span>
    </span>
  );
}

/** Footer line shared by both apps: what this build is and isn't. */
export function DemoFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white print:hidden">
      <div className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-4 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>CS 497 Team 12 (Early Birds) · Fictional clinics, synthetic referrals only · <a href="#/demo" className="underline underline-offset-2">How to try the demo</a></p>
        <p>Wait estimates are statistical ranges, not appointments or medical advice.</p>
      </div>
    </footer>
  );
}
