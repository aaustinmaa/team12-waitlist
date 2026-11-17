// Light, dark, or follow the device. The choice is a per-browser preference.
// index.html applies the saved choice before the first paint, so the page
// never flashes the wrong colours.

import { useEffect, useState } from "react";

export type ThemeChoice = "system" | "light" | "dark";
export const THEME_KEY = "team12-theme";
const ORDER: ThemeChoice[] = ["system", "light", "dark"];

function saved(): ThemeChoice {
  try {
    const v = localStorage.getItem(THEME_KEY);
    if (v === "light" || v === "dark") return v;
  } catch {
    /* storage blocked */
  }
  return "system";
}

const media = () => window.matchMedia("(prefers-color-scheme: dark)");

function apply(choice: ThemeChoice) {
  const dark = choice === "dark" || (choice === "system" && media().matches);
  document.documentElement.classList.toggle("dark", dark);
}

export function useTheme() {
  const [choice, setChoice] = useState<ThemeChoice>(saved);

  useEffect(() => {
    apply(choice);
    if (choice !== "system") return;
    const m = media();
    const onChange = () => apply("system");
    m.addEventListener("change", onChange);
    return () => m.removeEventListener("change", onChange);
  }, [choice]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => e.key === THEME_KEY && setChoice(saved());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const set = (c: ThemeChoice) => {
    setChoice(c);
    try {
      if (c === "system") localStorage.removeItem(THEME_KEY);
      else localStorage.setItem(THEME_KEY, c);
    } catch {
      /* storage blocked: applies to this visit only */
    }
  };

  return { choice, set, next: () => set(ORDER[(ORDER.indexOf(choice) + 1) % ORDER.length]) };
}
