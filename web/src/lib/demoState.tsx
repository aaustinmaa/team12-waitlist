// Demo state shared by the staff dashboard and the family view, so a capacity
// change on one screen shows up on the other. Saved per browser as a
// convenience; the page works the same when storage is unavailable.

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { DEFAULT_SLOTS } from "./api";
import type { DemoState } from "./types";

const KEY = "team12-demo-state-v1";
const initial: DemoState = { slotsPerWeek: DEFAULT_SLOTS, intakeCompleted: [] };

function load(): DemoState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return initial;
    const parsed = JSON.parse(raw) as Partial<DemoState>;
    return {
      slotsPerWeek: typeof parsed.slotsPerWeek === "number" ? parsed.slotsPerWeek : DEFAULT_SLOTS,
      intakeCompleted: Array.isArray(parsed.intakeCompleted) ? parsed.intakeCompleted : [],
    };
  } catch {
    return initial;
  }
}

interface Ctx {
  state: DemoState;
  setSlots: (n: number) => void;
  completeIntake: (id: string) => void;
  reset: () => void;
  isBaseline: boolean;
}

const DemoContext = createContext<Ctx | null>(null);

export function DemoProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DemoState>(load);

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

  const value = useMemo<Ctx>(
    () => ({
      state,
      setSlots: (n) => setState((s) => ({ ...s, slotsPerWeek: Math.min(10, Math.max(1, n)) })),
      completeIntake: (id) =>
        setState((s) => (s.intakeCompleted.includes(id) ? s : { ...s, intakeCompleted: [...s.intakeCompleted, id] })),
      reset: () => setState(initial),
      isBaseline: state.slotsPerWeek === DEFAULT_SLOTS && state.intakeCompleted.length === 0,
    }),
    [state],
  );

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}

export function useDemo() {
  const ctx = useContext(DemoContext);
  if (!ctx) throw new Error("useDemo must be used inside DemoProvider");
  return ctx;
}
