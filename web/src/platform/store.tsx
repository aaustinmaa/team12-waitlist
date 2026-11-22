// The platform's data in one place: each clinic's imported records and working
// state, saved mapping recipes, the import history, the audit log, sign-in
// sessions and the demo inbox.
//
// In this prototype it all lives in the browser (localStorage) so the demo runs
// with no server. Every change goes through the actions below, which is the
// seam where the hosted version calls Supabase instead (see docs/platform.md
// and supabase/migrations). Data from all three clinics is kept apart by
// clinic id, the same way row-level security keeps it apart on the server.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { buildModel, estimateAll, newReferralRanges, type EngineModel } from "../engine/model";
import type { ReferralRecord } from "../engine/types";
import { analyse, convert, type AiSettings } from "../ingest/importer";
import type { Recipe } from "../ingest/recipe";
import { proposeByRules } from "../ingest/rules";
import type { ImportDiff } from "../ingest/validate";
import { contactKey, effectiveRecords, listQueue, referralsForContact, type ClinicView } from "../lib/api";
import { DEFAULT_GEMINI_MODEL } from "../ingest/gemini";
import { MAX_NOTICES, diffNotices, toldByAll } from "../lib/notifications";
import type { Channel, DemoState, Priority } from "../lib/types";
import { CLINICS, DEMO_STAFF_PASSWORD, STAFF, clinicSetup, type StaffAccount } from "./clinics";

const KEY = "early-birds-platform-v1";
const today = () => new Date().toISOString().slice(0, 10);

export interface ClinicData {
  records: ReferralRecord[];
  asOf: string;
  importedAt: string;
  fileName: string;
  via: "seed" | "upload" | "sync";
}

export interface ImportLog {
  id: string;
  clinicId: string;
  at: string;
  by: string;
  fileName: string;
  via: ClinicData["via"];
  asOf: string;
  rows: number;
  records: number;
  errors: number;
  warnings: number;
  diff: ImportDiff | null;
  recipeBy: Recipe["proposed_by"];
}

export interface AuditEntry {
  id: string;
  at: string;
  clinicId: string | null;
  actor: string;
  action: string;
  detail: string;
  referral_id?: string;
}

export interface InboxMessage {
  id: string;
  at: string;
  to: string;
  subject: string;
  body: string;
}

interface PlatformState {
  data: Record<string, ClinicData>;
  recipes: Record<string, Recipe>;
  imports: ImportLog[];
  audit: AuditEntry[];
  ops: Record<string, DemoState>;
  ai: AiSettings;
  staffSession: { email: string } | null;
  familySession: { contact: string } | null;
  otp: { contact: string; code: string; at: string } | null;
  inbox: InboxMessage[];
  toursSeen: string[];
}

const blankOps = (): DemoState => ({ extraSlots: 0, intakeCompleted: [], priority: {}, notifyPrefs: {}, notices: [], told: {}, toursSeen: [], contacts: {}, priorityLog: [] });

let seq = 0;
const uid = () => `${Date.now().toString(36)}-${(seq++).toString(36)}`;

function initial(): PlatformState {
  const s: PlatformState = {
    data: {},
    recipes: {},
    imports: [],
    audit: [],
    ops: Object.fromEntries(CLINICS.map((c) => [c.id, blankOps()])),
    ai: { geminiKey: "", geminiModel: DEFAULT_GEMINI_MODEL },
    staffSession: null,
    familySession: null,
    otp: null,
    inbox: [],
    toursSeen: [],
  };
  // The demo opens with Maple Grove's Nov 13 export already imported.
  for (const c of CLINICS) {
    if (!c.seed) continue;
    const a = analyse(c.seed.name, c.seed.text);
    const recipe = proposeByRules(a.profile);
    const conv = convert(a, recipe, { today: today() });
    const now = new Date().toISOString();
    s.data[c.id] = { records: conv.records, asOf: conv.validation.asOf, importedAt: now, fileName: c.seed.name, via: "seed" };
    s.recipes[c.id] = recipe;
    s.imports.push({
      id: uid(),
      clinicId: c.id,
      at: now,
      by: "nightly sync",
      fileName: c.seed.name,
      via: "seed",
      asOf: conv.validation.asOf,
      rows: a.table.rows.length,
      records: conv.records.length,
      errors: conv.issues.filter((i) => i.level === "error").length,
      warnings: conv.issues.filter((i) => i.level === "warning").length,
      diff: null,
      recipeBy: recipe.proposed_by,
    });
  }
  return s;
}

function load(): PlatformState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as PlatformState;
      if (p && p.data && p.ops) {
        for (const c of CLINICS) p.ops[c.id] ??= blankOps();
        return p;
      }
    }
  } catch {
    /* fall through to a fresh start */
  }
  return initial();
}

// ---------------------------------------------------------------- engine cache

const models = new Map<string, { key: string; model: EngineModel }>();

/** The engine model for a clinic's latest import; fitting and back-testing run once per import. */
function modelFor(clinicId: string, d: ClinicData) {
  const key = `${d.importedAt}|${d.asOf}|${d.records.length}`;
  const hit = models.get(clinicId);
  if (hit && hit.key === key) return hit.model;
  const model = buildModel(d.records, d.asOf);
  models.set(clinicId, { key, model });
  return model;
}

export function makeView(clinicId: string, d: ClinicData, ops: DemoState): ClinicView {
  const setup = clinicSetup(clinicId)!;
  const model = modelFor(clinicId, d);
  const records = effectiveRecords(d.records, ops, d.asOf);
  const scenario = { extraSlots: ops.extraSlots, fromWeek: 0 };
  return {
    id: clinicId,
    info: setup.info,
    asOf: d.asOf,
    records,
    model,
    estimates: estimateAll(records, model, scenario),
    newReferral: newReferralRanges(records, model, scenario),
    ops,
  };
}

// ---------------------------------------------------------------- context

interface Platform {
  state: PlatformState;
  staff: StaffAccount | null;
  /** null when the clinic has no data yet */
  view: (clinicId: string) => ClinicView | null;
  signInStaff: (email: string, password: string) => string | null;
  signOutStaff: () => void;
  requestCode: (contact: string) => void;
  verifyCode: (contact: string, code: string) => boolean;
  signOutFamily: () => void;
  familyReferrals: () => { clinicId: string; referralId: string }[];
  commitImport: (clinicId: string, args: { fileName: string; via: ClinicData["via"]; rows: number; records: ReferralRecord[]; asOf: string; errors: number; warnings: number; diff: ImportDiff | null; recipe: Recipe; by: string }) => void;
  setAi: (ai: Partial<AiSettings>) => void;
  log: (clinicId: string | null, action: string, detail: string, referral_id?: string) => void;
  ops: (clinicId: string) => ClinicOps;
  resetDemo: () => void;
  markTourSeen: (name: string) => void;
}

export interface ClinicOps {
  state: DemoState;
  setExtraSlots: (n: number) => void;
  completeIntake: (id: string) => void;
  setPriority: (id: string, p: Priority, reason: string) => void;
  setNotifyPref: (id: string, channel: Channel, on: boolean) => void;
  setContact: (id: string, field: "email" | "phone", value: string) => void;
}

const Ctx = createContext<Platform | null>(null);

/** After the last staff change, wait this long before telling families, so dragging a slider sends one update. */
const NOTIFY_DELAY_MS = 900;

export function PlatformProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PlatformState>(load);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* storage full or blocked: keep in memory */
    }
  }, [state]);

  // Keep two open tabs (family on one, staff on another) in step during a demo.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => e.key === KEY && setState(load());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const staff = useMemo(() => (state.staffSession ? STAFF.find((s) => s.email === state.staffSession!.email) ?? null : null), [state.staffSession]);
  const actor = staff?.email ?? (state.familySession ? `family ${maskContact(state.familySession.contact)}` : "system");

  const addAudit = useCallback(
    (s: PlatformState, clinicId: string | null, action: string, detail: string, who: string, referral_id?: string): PlatformState => ({
      ...s,
      audit: [{ id: uid(), at: new Date().toISOString(), clinicId, actor: who, action, detail, ...(referral_id ? { referral_id } : {}) }, ...s.audit].slice(0, 2000),
    }),
    [],
  );

  /** Work out which families should hear about a change, a moment after the last change. */
  const notifyFamilies = useCallback((clinicId: string) => {
    clearTimeout(timers.current[clinicId]);
    timers.current[clinicId] = setTimeout(() => {
      setState((s) => {
        const d = s.data[clinicId];
        if (!d) return s;
        const ops = s.ops[clinicId];
        const v = makeView(clinicId, d, ops);
        const diff = diffNotices(ops.told, listQueue(v), ops.notifyPrefs, new Date());
        return { ...s, ops: { ...s.ops, [clinicId]: { ...ops, told: diff.told, notices: [...diff.notices, ...ops.notices].slice(0, MAX_NOTICES) } } };
      });
    }, NOTIFY_DELAY_MS);
  }, []);

  const views = useRef(new Map<string, { data: ClinicData; ops: DemoState; view: ClinicView }>());

  const value = useMemo<Platform>(() => {
    const updateOps = (clinicId: string, f: (o: DemoState) => DemoState) => setState((s) => ({ ...s, ops: { ...s.ops, [clinicId]: f(s.ops[clinicId] ?? blankOps()) } }));
    return {
      state,
      staff,
      view: (clinicId) => {
        const d = state.data[clinicId];
        if (!d) return null;
        const ops = state.ops[clinicId] ?? blankOps();
        const hit = views.current.get(clinicId);
        if (hit && hit.data === d && hit.ops === ops) return hit.view;
        const view = makeView(clinicId, d, ops);
        views.current.set(clinicId, { data: d, ops, view });
        return view;
      },
      signInStaff: (email, password) => {
        const acct = STAFF.find((s) => s.email.toLowerCase() === email.trim().toLowerCase());
        if (!acct || password !== DEMO_STAFF_PASSWORD) return "That email and password don't match a clinic account.";
        setState((s) => addAudit({ ...s, staffSession: { email: acct.email } }, acct.clinicId, "Signed in", "Clinic portal", acct.email));
        return null;
      },
      signOutStaff: () => setState((s) => (s.staffSession ? addAudit({ ...s, staffSession: null }, STAFF.find((x) => x.email === s.staffSession!.email)?.clinicId ?? null, "Signed out", "Clinic portal", s.staffSession.email) : s)),
      requestCode: (contact) => {
        const code = String(Math.floor(100000 + Math.random() * 900000));
        const to = contact.trim();
        setState((s) => ({
          ...s,
          otp: { contact: contactKey(to), code, at: new Date().toISOString() },
          inbox: [
            {
              id: uid(),
              at: new Date().toISOString(),
              to,
              subject: "Your Early Birds sign-in code",
              body: `Your code is ${code}. It works for 10 minutes. If you didn't ask for it, you can ignore this message.`,
            },
            ...s.inbox,
          ].slice(0, 20),
        }));
      },
      verifyCode: (contact, code) => {
        const o = state.otp;
        const fresh = o && Date.now() - new Date(o.at).getTime() < 10 * 60 * 1000;
        if (!o || !fresh || o.contact !== contactKey(contact) || o.code !== code.trim()) return false;
        setState((s) => addAudit({ ...s, otp: null, familySession: { contact: contact.trim() } }, null, "Family signed in", "One-time code", `family ${maskContact(contact)}`));
        return true;
      },
      signOutFamily: () => setState((s) => ({ ...s, familySession: null })),
      familyReferrals: () => {
        const contact = state.familySession?.contact;
        if (!contact) return [];
        return CLINICS.flatMap((c) => {
          const d = state.data[c.id];
          if (!d) return [];
          return referralsForContact({ records: d.records, asOf: d.asOf }, contact).map((r) => ({ clinicId: c.id, referralId: r.referral_id }));
        });
      },
      commitImport: (clinicId, a) => {
        const now = new Date().toISOString();
        setState((s) => {
          const prevOps = s.ops[clinicId] ?? blankOps();
          const data: ClinicData = { records: a.records, asOf: a.asOf, importedAt: now, fileName: a.fileName, via: a.via };
          // Staff changes made on the old data stay only where the referral is still open and unchanged in the system.
          const stillOpen = new Set(a.records.filter((r) => !r.closed_on).map((r) => r.referral_id));
          const ops: DemoState = {
            ...prevOps,
            intakeCompleted: prevOps.intakeCompleted.filter((id) => stillOpen.has(id) && !a.records.find((r) => r.referral_id === id)?.intake_completed_on),
            priority: Object.fromEntries(Object.entries(prevOps.priority).filter(([id]) => stillOpen.has(id))),
          };
          // First data for this clinic: start "what families were told" from today's estimates.
          if (!s.data[clinicId]) ops.told = toldByAll(listQueue(makeView(clinicId, data, ops)));
          const log: ImportLog = {
            id: uid(),
            clinicId,
            at: now,
            by: a.by,
            fileName: a.fileName,
            via: a.via,
            asOf: a.asOf,
            rows: a.rows,
            records: a.records.length,
            errors: a.errors,
            warnings: a.warnings,
            diff: a.diff,
            recipeBy: a.recipe.proposed_by,
          };
          const next = { ...s, data: { ...s.data, [clinicId]: data }, recipes: { ...s.recipes, [clinicId]: a.recipe }, imports: [log, ...s.imports].slice(0, 200), ops: { ...s.ops, [clinicId]: ops } };
          return addAudit(next, clinicId, a.via === "sync" ? "Sync imported" : "Import confirmed", `${a.fileName}: ${a.records.length} referrals, data as of ${a.asOf}`, a.by);
        });
        notifyFamilies(clinicId);
      },
      setAi: (ai) => setState((s) => addAudit({ ...s, ai: { ...s.ai, ...ai } }, staff?.clinicId ?? null, "AI settings changed", ai.geminiKey !== undefined ? (ai.geminiKey ? "Gemini key set (kept in this browser)" : "Gemini key removed") : `Model: ${ai.geminiModel}`, actor)),
      log: (clinicId, action, detail, referral_id) => setState((s) => addAudit(s, clinicId, action, detail, actor, referral_id)),
      ops: (clinicId) => ({
        state: state.ops[clinicId] ?? blankOps(),
        setExtraSlots: (n) => {
          updateOps(clinicId, (o) => ({ ...o, extraSlots: Math.max(-5, Math.min(10, n)) }));
          notifyFamilies(clinicId);
        },
        completeIntake: (id) => {
          setState((s) => {
            const o = s.ops[clinicId];
            if (o.intakeCompleted.includes(id)) return s;
            return addAudit({ ...s, ops: { ...s.ops, [clinicId]: { ...o, intakeCompleted: [...o.intakeCompleted, id] } } }, clinicId, "Intake marked complete", id, actor, id);
          });
          notifyFamilies(clinicId);
        },
        setPriority: (id, p, reason) => {
          setState((s) => {
            const o = s.ops[clinicId];
            const d = s.data[clinicId];
            const from = (o.priority[id] ?? d?.records.find((r) => r.referral_id === id)?.priority ?? "standard") as Priority;
            if (from === p) return s;
            const change = { referral_id: id, from, to: p, reason, by: actor, at: new Date().toISOString() };
            return addAudit(
              { ...s, ops: { ...s.ops, [clinicId]: { ...o, priority: { ...o.priority, [id]: p }, priorityLog: [change, ...o.priorityLog].slice(0, 500) } } },
              clinicId,
              "Priority changed",
              `${id}: ${from} → ${p}. Reason: ${reason}`,
              actor,
              id,
            );
          });
          notifyFamilies(clinicId);
        },
        setNotifyPref: (id, channel, on) => updateOps(clinicId, (o) => ({ ...o, notifyPrefs: { ...o.notifyPrefs, [id]: { ...(o.notifyPrefs[id] ?? { email: true, sms: false, browser: false }), [channel]: on } } })),
        setContact: (id, field, v) => updateOps(clinicId, (o) => ({ ...o, contacts: { ...o.contacts, [id]: { ...o.contacts[id], [field]: v } } })),
      }),
      resetDemo: () => {
        models.clear();
        views.current.clear();
        const fresh = initial();
        setState({ ...fresh, staffSession: state.staffSession, familySession: state.familySession, ai: state.ai });
      },
      markTourSeen: (name) => setState((s) => (s.toursSeen.includes(name) ? s : { ...s, toursSeen: [...s.toursSeen, name] })),
    };
  }, [state, staff, actor, addAudit, notifyFamilies]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePlatform() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("usePlatform must be used inside PlatformProvider");
  return ctx;
}

export function maskContact(c: string) {
  const t = c.trim();
  if (t.includes("@")) return t.replace(/^(.)[^@]*(@.*)$/, "$1•••$2");
  const d = t.replace(/\D/g, "");
  return d.length >= 4 ? `•••${d.slice(-4)}` : "•••";
}

// ---------------------------------------------------------------- clinic scope

const ScopeCtx = createContext<string | null>(null);

/** Everything inside works on this clinic: the waitlist, a family's referral page. */
export function ClinicScope({ clinicId, children }: { clinicId: string; children: ReactNode }) {
  return <ScopeCtx.Provider value={clinicId}>{children}</ScopeCtx.Provider>;
}

export function useClinicId() {
  const id = useContext(ScopeCtx);
  if (!id) throw new Error("useClinicId must be used inside ClinicScope");
  return id;
}

export function useClinicView() {
  const p = usePlatform();
  const id = useClinicId();
  return p.view(id);
}
