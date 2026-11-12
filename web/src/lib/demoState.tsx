import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { DEFAULT_SLOTS } from "./api";
import {
  DEFAULT_CLINIC_ID, MAX_SLOTS, minimumLocalSlots, updateNetwork, type NetworkAction,
} from "../../../backend/api/network";
import type { DemoState } from "./types";

const KEY = "team12-demo-state-v1";
const initial: DemoState = { slotsPerWeek: DEFAULT_SLOTS, intakeCompleted: [] };

function load(fallback = initial): DemoState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<DemoState>;
    return {
      slotsPerWeek: typeof parsed.slotsPerWeek === "number" ? parsed.slotsPerWeek : DEFAULT_SLOTS,
      intakeCompleted: Array.isArray(parsed.intakeCompleted) ? parsed.intakeCompleted : [],
      clinicSlots: parsed.clinicSlots,
      connections: Array.isArray(parsed.connections) ? parsed.connections : [],
      sharedSlots: Array.isArray(parsed.sharedSlots) ? parsed.sharedSlots : [],
    };
  } catch {
    return fallback;
  }
}

interface Ctx {
  state: DemoState;
  setSlots: (n: number, clinicId?: string) => void;
  completeIntake: (id: string) => void;
  changeNetwork: (clinicId: string, action: NetworkAction) => Promise<void>;
  reset: () => void;
  isBaseline: boolean;
}

const DemoContext = createContext<Ctx | null>(null);

export function DemoProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DemoState>(load);
  const current = useRef(state);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== KEY) return;
      current.current = load();
      setState(current.current);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const value = useMemo<Ctx>(() => {
    function update(change: (s: DemoState) => DemoState) {
      const apply = () => {
        const next = change(load(current.current));
        current.current = next;
        try {
          localStorage.setItem(KEY, JSON.stringify(next));
        } catch {
          // The demo also works in memory when browser storage is unavailable.
        }
        setState(next);
      };
      // Serialize updates across demo tabs when the browser supports Web Locks.
      return navigator.locks ? navigator.locks.request(KEY, apply) : Promise.resolve().then(apply);
    }

    return {
      state,
      setSlots: (n, clinicId = DEFAULT_CLINIC_ID) => {
        void update((s) => {
          const slots = Math.min(MAX_SLOTS, Math.max(minimumLocalSlots(s, clinicId), n));
          return clinicId === DEFAULT_CLINIC_ID
            ? { ...s, slotsPerWeek: slots }
            : { ...s, clinicSlots: { ...s.clinicSlots, [clinicId]: slots } };
        });
      },
      completeIntake: (id) => {
        void update((s) => s.intakeCompleted.includes(id) ? s : { ...s, intakeCompleted: [...s.intakeCompleted, id] });
      },
      changeNetwork: (clinicId, action) => update((s) => updateNetwork(s, clinicId, action)),
      reset: () => { void update(() => initial); },
      isBaseline: state.slotsPerWeek === DEFAULT_SLOTS && state.intakeCompleted.length === 0
        && Object.keys(state.clinicSlots ?? {}).length === 0 && !state.connections?.length && !state.sharedSlots?.length,
    };
  }, [state]);

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}

export function useDemo() {
  const ctx = useContext(DemoContext);
  if (!ctx) throw new Error("useDemo must be used inside DemoProvider");
  return ctx;
}
