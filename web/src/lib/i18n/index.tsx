// Language support for the family portal. The choice is a per-browser
// preference: it starts from the browser's own language and is remembered.
// To add a language, add a file next to en.ts that satisfies `Dict` and list
// it in LANGS.

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { parseDay } from "../dates";
import en, { type Dict } from "./en";
import fr from "./fr";
import zh from "./zh";
import es from "./es";
import ar from "./ar";

export type { Dict };

export const LANGS = [
  { code: "en", name: "English", locale: "en-CA", dir: "ltr", dict: en },
  { code: "fr", name: "Français", locale: "fr-CA", dir: "ltr", dict: fr },
  { code: "zh", name: "简体中文", locale: "zh-CN", dir: "ltr", dict: zh },
  { code: "es", name: "Español", locale: "es-US", dir: "ltr", dict: es },
  // Western digits, so numbers match the ones written inside the sentences.
  { code: "ar", name: "العربية", locale: "ar-u-nu-latn", dir: "rtl", dict: ar },
] as const satisfies readonly { code: string; name: string; locale: string; dir: "ltr" | "rtl"; dict: Dict }[];

export type LangCode = (typeof LANGS)[number]["code"];

const KEY = "team12-lang";

function find(code: string | null | undefined) {
  return LANGS.find((l) => l.code === code);
}

function initial(): LangCode {
  try {
    const saved = find(localStorage.getItem(KEY));
    if (saved) return saved.code;
  } catch {
    /* storage blocked */
  }
  for (const tag of typeof navigator === "undefined" ? [] : (navigator.languages ?? [navigator.language])) {
    const match = find(tag.toLowerCase().split("-")[0]);
    if (match) return match.code;
  }
  return "en";
}

export interface Formatters {
  long: (d: string | Date) => string;
  short: (d: string | Date) => string;
  weekday: (d: string | Date) => string;
  /** "10:30" clinic time -> the locale's way of writing it */
  time: (hhmm: string) => string;
  /** an ISO timestamp, in the viewer's own time zone */
  stamp: (iso: string) => string;
}

function formatters(locale: string): Formatters {
  const day = (d: string | Date) => (typeof d === "string" ? parseDay(d) : d);
  const long = new Intl.DateTimeFormat(locale, { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
  const short = new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", timeZone: "UTC" });
  const weekday = new Intl.DateTimeFormat(locale, { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
  const time = new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit", timeZone: "UTC" });
  const stamp = new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  return {
    long: (d) => long.format(day(d)),
    short: (d) => short.format(day(d)),
    weekday: (d) => weekday.format(day(d)),
    time: (hhmm) => time.format(new Date(`2000-01-01T${hhmm}:00Z`)),
    stamp: (iso) => stamp.format(new Date(iso)),
  };
}

interface Ctx {
  lang: LangCode;
  setLang: (code: LangCode) => void;
  t: Dict;
  dir: "ltr" | "rtl";
  fmt: Formatters;
}

const I18nContext = createContext<Ctx | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<LangCode>(initial);

  // Two open tabs follow the same choice.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      const next = e.key === KEY ? find(e.newValue) : undefined;
      if (next) setLangState(next.code);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const value = useMemo<Ctx>(() => {
    const l = find(lang)!;
    return {
      lang,
      setLang: (code) => {
        setLangState(code);
        try {
          localStorage.setItem(KEY, code);
        } catch {
          /* storage blocked: keep for this visit only */
        }
      },
      t: l.dict,
      dir: l.dir,
      fmt: formatters(l.locale),
    };
  }, [lang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside I18nProvider");
  return ctx;
}

/** A length of time in the family's language: days under a week, whole weeks after. */
export function duration(t: Dict, days: number) {
  return days < 7 ? t.units.days(days) : t.units.weeks(Math.floor(days / 7));
}
