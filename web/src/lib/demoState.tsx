// Demo state shared by the staff dashboard and the family view, so a capacity
// change on one screen shows up on the other. Saved per browser as a
// convenience; the page works the same when storage is unavailable.

import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { DEFAULT_SLOTS, listQueue } from "./api";
import { DEFAULT_PREFS, MAX_NOTICES, diffNotices, toldByAll } from "./notifications";
import { normalize, type ContactField } from "./contact";
import { PRIORITIES, type Channel, type DemoState, type Priority } from "./types";

const KEY = "team12-demo-state-v2";

/** After the last staff change, wait this long before telling families, so dragging the capacity slider sends one update. */
const NOTIFY_DELAY_MS = 900;

function baseline(): DemoState {
  const q = { slotsPerWeek: DEFAULT_SLOTS, intakeCompleted: [], priority: {} };
  return { ...q, notifyPrefs: {}, notices: [], told: toldByAll(listQueue(q)), toursSeen: [], contacts: {} };
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

function load(): DemoState {
  const initial = baseline();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return initial;
    const p = JSON.parse(raw) as Partial<DemoState>;
    const priority = isRecord(p.priority)
      ? Object.fromEntries(Object.entries(p.priority).filter(([, v]) => PRIORITIES.includes(v as Priority)))
      : {};
    return {
      slotsPerWeek: typeof p.slotsPerWeek === "number" ? p.slotsPerWeek : DEFAULT_SLOTS,
      intakeCompleted: Array.isArray(p.intakeCompleted) ? p.intakeCompleted : [],
      priority: priority as Record<string, Priority>,
      notifyPrefs: isRecord(p.notifyPrefs) ? (p.notifyPrefs as DemoState["notifyPrefs"]) : {},
      notices: Array.isArray(p.notices) ? p.notices : [],
      told: isRecord(p.told) ? { ...initial.told, ...(p.told as Record<string, string>) } : initial.told,
      toursSeen: Array.isArray(p.toursSeen) ? p.toursSeen : [],
      contacts: isRecord(p.contacts) ? cleanContacts(p.contacts) : {},
    };
  } catch {
    return initial;
  }
}

/** Keep only well-formed saved contact details. */
function cleanContacts(raw: Record<string, unknown>): DemoState["contacts"] {
  const out: DemoState["contacts"] = {};
  for (const [id, v] of Object.entries(raw)) {
    if (!isRecord(v)) continue;
    const email = typeof v.email === "string" ? normalize("email", v.email) : null;
    const phone = typeof v.phone === "string" ? normalize("phone", v.phone) : null;
    if (email || phone) out[id] = { ...(email ? { email } : {}), ...(phone ? { phone } : {}) };
  }
  return out;
}

interface Ctx {
  state: DemoState;
  setSlots: (n: number) => void;
  completeIntake: (id: string) => void;
  setPriority: (id: string, p: Priority) => void;
  setNotifyPref: (id: string, channel: Channel, on: boolean) => void;
  /** save a contact detail the family entered (already checked with normalize) */
  setContact: (id: string, field: ContactField, value: string) => void;
  markTourSeen: (name: string) => void;
  reset: () => void;
  /** capacity, intake and priorities are as in the fixture */
  isBaseline: boolean;
  /** nothing at all has been changed since the last reset */
  isPristine: boolean;
}

const DemoContext = createContext<Ctx | null>(null);

export function DemoProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DemoState>(load);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* storage blocked: keep in memory only */
    }
  }, [state]);

  // Keep two open tabs (staff + family) in sync during a demo.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => e.key === KEY && setState(load());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  const value = useMemo<Ctx>(() => {
    // Only the tab where staff made the change sends the updates, so two open tabs never send them twice.
    const notifyFamilies = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        const now = new Date();
        setState((s) => {
          const d = diffNotices(s.told, listQueue(s), s.notifyPrefs, now);
          return { ...s, told: d.told, notices: [...d.notices, ...s.notices].slice(0, MAX_NOTICES) };
        });
      }, NOTIFY_DELAY_MS);
    };
    return {
      state,
      setSlots: (n) => {
        setState((s) => ({ ...s, slotsPerWeek: Math.min(10, Math.max(1, n)) }));
        notifyFamilies();
      },
      completeIntake: (id) => {
        setState((s) => (s.intakeCompleted.includes(id) ? s : { ...s, intakeCompleted: [...s.intakeCompleted, id] }));
        notifyFamilies();
      },
      setPriority: (id, p) => {
        setState((s) => ({ ...s, priority: { ...s.priority, [id]: p } }));
        notifyFamilies();
      },
      setNotifyPref: (id, channel, on) =>
        setState((s) => ({ ...s, notifyPrefs: { ...s.notifyPrefs, [id]: { ...(s.notifyPrefs[id] ?? DEFAULT_PREFS), [channel]: on } } })),
      setContact: (id, field, value) =>
        setState((s) => ({ ...s, contacts: { ...s.contacts, [id]: { ...s.contacts[id], [field]: value } } })),
      markTourSeen: (name) => setState((s) => (s.toursSeen.includes(name) ? s : { ...s, toursSeen: [...s.toursSeen, name] })),
      reset: () => {
        if (timer.current) clearTimeout(timer.current);
        setState(baseline());
      },
      isBaseline: state.slotsPerWeek === DEFAULT_SLOTS && state.intakeCompleted.length === 0 && Object.keys(state.priority).length === 0,
      isPristine:
        state.slotsPerWeek === DEFAULT_SLOTS &&
        state.intakeCompleted.length === 0 &&
        Object.keys(state.priority).length === 0 &&
        state.notices.length === 0 &&
        Object.keys(state.notifyPrefs).length === 0 &&
        Object.keys(state.contacts).length === 0 &&
        state.toursSeen.length === 0,
    };
  }, [state]);

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}

export function useDemo() {
  const ctx = useContext(DemoContext);
  if (!ctx) throw new Error("useDemo must be used inside DemoProvider");
  return ctx;
}
