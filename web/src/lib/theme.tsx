// Light or dark. The choice is a per-browser preference; before anyone picks,
// the page starts in whichever the device uses. index.html applies the same
// rule before the first paint, so the page never flashes the wrong colours.

import { useEffect, useState } from "react";

export type ThemeChoice = "light" | "dark";
export const THEME_KEY = "team12-theme";

function saved(): ThemeChoice {
  try {
    const v = localStorage.getItem(THEME_KEY);
    if (v === "light" || v === "dark") return v;
  } catch {
    /* storage blocked */
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function apply(choice: ThemeChoice) {
  const dark = choice === "dark";
  const root = document.documentElement;
  if (root.classList.contains("dark") === dark) return;
  const swap = () => root.classList.toggle("dark", dark);
  // Cross-fade the whole page where the browser can, so the switch doesn't flash.
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!reduce && "startViewTransition" in document) document.startViewTransition(swap);
  else swap();
}

export function useTheme() {
  const [choice, setChoice] = useState<ThemeChoice>(saved);

  useEffect(() => apply(choice), [choice]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => e.key === THEME_KEY && setChoice(saved());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const set = (c: ThemeChoice) => {
    setChoice(c);
    try {
      localStorage.setItem(THEME_KEY, c);
    } catch {
      /* storage blocked: applies to this visit only */
    }
  };

  return { choice, set };
}
