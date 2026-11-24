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
import type { LiveEstimate } from "../engine/model";
import * as hosted from "./hosted";
import { HOSTED, getAppKind, type ClinicSummary, type PublishedEstimate, type StaffMember } from "./hosted";
import type { Recipe } from "../ingest/recipe";
import { proposeByRules } from "../ingest/rules";
import type { ImportDiff } from "../ingest/validate";
import { contactKey, effectiveRecords, intakeTiming, listQueue, referralsForContact, type ClinicView } from "../lib/api";
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
  /** hosted: the signed-in staff member, from the clinic's team table */
  staffAccount?: StaffMember | null;
  /** hosted family app: what each clinic published for this family */
  published?: Record<string, { summary: ClinicSummary | null; estimates: Record<string, PublishedEstimate> }>;
  /** hosted: loading from or saving to the server */
  sync?: { loading: boolean; error: string | null };
}

export const blankOps = (): DemoState => ({ extraSlots: 0, intakeCompleted: [], priority: {}, notifyPrefs: {}, notices: [], told: {}, toursSeen: [], contacts: {}, priorityLog: [] });

let seq = 0;
const uid = () => `${Date.now().toString(36)}-${(seq++).toString(36)}`;

function empty(): PlatformState {
  return {
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
    staffAccount: null,
    published: {},
    sync: { loading: true, error: null },
  };
}

/** The seed import for a clinic (Maple Grove's first export), as the store records it. */
export function seedImport(clinicId: string) {
  const c = clinicSetup(clinicId);
  if (!c?.seed) return null;
  const a = analyse(c.seed.name, c.seed.text);
  const recipe = proposeByRules(a.profile);
  const conv = convert(a, recipe, { today: today() });
  return { a, recipe, conv, file: c.seed };
}

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
  if (HOSTED) return empty();
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

/**
 * Hosted family app: a view built only from what the clinic published for this
 * family (their own referrals, their estimates, the clinic summary). The
 * family never receives the rest of the waitlist.
 */
function familyView(clinicId: string, d: ClinicData, pub: { summary: ClinicSummary | null; estimates: Record<string, PublishedEstimate> }, ops: DemoState): ClinicView {
  const setup = clinicSetup(clinicId)!;
  const s = pub.summary;
  const estimates = new Map<string, LiveEstimate>(
    Object.values(pub.estimates).map((e) => [
      e.referral_id,
      {
        status: e.status as LiveEstimate["status"],
        position: e.position,
        raw: null,
        range: e.lower_weeks !== null && e.upper_weeks !== null ? { lower: e.lower_weeks, upper: e.upper_weeks } : null,
        reason: (e.reason ?? null) as LiveEstimate["reason"],
      },
    ]),
  );
  const model = {
    asOf: s?.asOf ?? d.asOf,
    gate: { familyVisible: !!s?.familyVisible, failed: [] },
    backtest: { cases: [], calibration: { speed: 1, k: 1 }, coverageRaw: null, coverage: s?.coverage ?? null, resolved: s?.resolved ?? 0, medianWidth: null },
  } as unknown as EngineModel;
  return { id: clinicId, info: setup.info, asOf: s?.asOf ?? d.asOf, records: d.records, model, estimates, newReferral: { urgent: null, high: null, standard: null }, ops, ...(s ? { intake: s.intake } : {}) };
}

/** What the clinic publishes for families after any change. */
function toPublished(v: ClinicView): { rows: PublishedEstimate[]; summary: ClinicSummary } {
  const rows: PublishedEstimate[] = [];
  for (const r of v.records) {
    if (r.closed_on !== null && r.closed_on <= v.asOf) continue;
    const e = v.estimates.get(r.referral_id);
    if (!e) continue;
    const shown = e.reason === null && e.range;
    rows.push({ clinic_id: v.id, referral_id: r.referral_id, status: e.status, position: e.position, lower_weeks: shown ? e.range!.lower : null, upper_weeks: shown ? e.range!.upper : null, reason: e.reason });
  }
  const bt = v.model.backtest;
  return { rows, summary: { asOf: v.asOf, familyVisible: v.model.gate.familyVisible, coverage: bt.coverage, resolved: bt.resolved, intake: intakeTiming(v) } };
}

const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));

// ---------------------------------------------------------------- context

interface Platform {
  state: PlatformState;
  staff: StaffAccount | null;
  /** null when the clinic has no data yet */
  view: (clinicId: string) => ClinicView | null;
  signInStaff: (email: string, password: string) => Promise<string | null>;
  signOutStaff: () => void;
  /** returns an error message, or null when the code was sent */
  requestCode: (contact: string) => Promise<string | null>;
  verifyCode: (contact: string, code: string) => Promise<boolean>;
  /** hosted only: sign in as the shared demo family */
  demoFamily: () => Promise<string | null>;
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
    if (HOSTED) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* storage full or blocked: keep in memory */
    }
  }, [state]);

  // Keep two open tabs (family on one, staff on another) in step during a demo.
  useEffect(() => {
    if (HOSTED) return;
    const onStorage = (e: StorageEvent) => e.key === KEY && setState(load());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const staff = useMemo(
    () => (HOSTED ? state.staffAccount ?? null : state.staffSession ? STAFF.find((s) => s.email === state.staffSession!.email) ?? null : null),
    [state.staffSession, state.staffAccount],
  );
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

  // ------------------------------------------------------------ hosted: load from and save to Supabase

  /** What the server already has, so only real changes are sent. */
  const pushed = useRef({ importedAt: {} as Record<string, string | undefined>, ops: {} as Record<string, string>, published: {} as Record<string, string>, notices: new Set<string>(), audit: new Set<string>(), prefs: {} as Record<string, string> });
  const stateRef = useRef(state);
  stateRef.current = state;
  const fail = useCallback((e: unknown) => setState((s) => ({ ...s, sync: { loading: false, error: errText(e) } })), []);

  const hydrateStaff = useCallback(async () => {
    try {
      const l = await hosted.loadStaff();
      if (!l) {
        setState((s) => ({ ...s, staffAccount: null, staffSession: null, sync: { loading: false, error: null } }));
        return;
      }
      const c = l.member.clinicId;
      const ops: DemoState = { ...blankOps(), ...(l.state?.ops ?? {}), notices: l.notices, toursSeen: [] };
      const data: ClinicData | null =
        l.records.length && l.state?.data_as_of
          ? { records: l.records, asOf: l.state.data_as_of, importedAt: l.state.imported_at ?? "server", fileName: l.state.file_name ?? "", via: (l.state.via as ClinicData["via"]) ?? "upload" }
          : null;
      const P = pushed.current;
      P.importedAt[c] = data?.importedAt;
      P.ops[c] = JSON.stringify(opsForServer(ops));
      for (const n of l.notices) P.notices.add(n.id);
      const audit: AuditEntry[] = l.audit.map((a) => ({ id: `db-${a.id}`, at: a.at, clinicId: a.clinic_id, actor: a.actor, action: a.action, detail: a.detail, ...(a.referral_id ? { referral_id: a.referral_id } : {}) }));
      for (const a of audit) P.audit.add(a.id);
      const imports: ImportLog[] = l.imports.map((i) => ({
        id: `db-${i.id}`,
        clinicId: i.clinic_id,
        at: i.at,
        by: i.by_email,
        fileName: i.file_name,
        via: i.via as ClinicData["via"],
        asOf: i.data_as_of,
        rows: i.rows,
        records: i.records,
        errors: i.errors,
        warnings: i.warnings,
        diff: i.diff,
        recipeBy: i.recipe_by as Recipe["proposed_by"],
      }));
      setState((s) => ({
        ...s,
        staffAccount: l.member,
        staffSession: { email: l.member.email },
        data: data ? { ...s.data, [c]: data } : s.data,
        recipes: l.state?.recipe ? { ...s.recipes, [c]: l.state.recipe } : s.recipes,
        imports,
        audit,
        ops: { ...s.ops, [c]: ops },
        sync: { loading: false, error: null },
      }));
      // An admin's first sign-in at a clinic whose first export ships with the demo: import it.
      if (!data && l.member.role === "admin") {
        const seed = seedImport(c);
        if (seed) {
          const now = new Date().toISOString();
          setState((s) => ({
            ...s,
            data: { ...s.data, [c]: { records: seed.conv.records, asOf: seed.conv.validation.asOf, importedAt: now, fileName: seed.file.name, via: "sync" } },
            recipes: { ...s.recipes, [c]: seed.recipe },
            ops: { ...s.ops, [c]: { ...s.ops[c], told: toldByAll(listQueue(makeView(c, { records: seed.conv.records, asOf: seed.conv.validation.asOf, importedAt: now, fileName: seed.file.name, via: "sync" }, s.ops[c]))) } },
            imports: [
              { id: uid(), clinicId: c, at: now, by: "nightly sync", fileName: seed.file.name, via: "sync", asOf: seed.conv.validation.asOf, rows: seed.a.table.rows.length, records: seed.conv.records.length, errors: 0, warnings: seed.conv.issues.filter((i) => i.level === "warning").length, diff: null, recipeBy: seed.recipe.proposed_by },
              ...s.imports,
            ],
          }));
        }
      }
    } catch (e) {
      fail(e);
    }
  }, [fail]);

  const hydrateFamily = useCallback(async () => {
    try {
      const l = await hosted.loadFamily();
      if (!l) {
        setState((s) => ({ ...s, familySession: null, sync: { loading: false, error: null } }));
        return;
      }
      const P = pushed.current;
      setState((s) => {
        const data: PlatformState["data"] = {};
        const published: NonNullable<PlatformState["published"]> = {};
        const ops: PlatformState["ops"] = { ...s.ops };
        for (const c of CLINICS) {
          const records = l.records.filter((r) => r.clinic_id === c.id).map(({ clinic_id: _c, ...r }) => (void _c, r as ReferralRecord));
          if (!records.length) continue;
          const summary = l.summaries[c.id] ?? null;
          const latest = records.reduce((m, r) => [r.received_on, r.closed_on ?? "", r.intake_completed_on ?? ""].reduce((a, b) => (b > a ? b : a), m), "");
          data[c.id] = { records, asOf: summary?.asOf ?? latest, importedAt: "server", fileName: "", via: "sync" };
          published[c.id] = { summary, estimates: Object.fromEntries(l.estimates.filter((e) => e.clinic_id === c.id).map((e) => [e.referral_id, e])) };
          const prefs = l.prefs.filter((x) => x.clinic_id === c.id);
          const notifyPrefs = Object.fromEntries(prefs.filter((x) => x.notify).map((x) => [x.referral_id, x.notify!]));
          const contacts = Object.fromEntries(prefs.filter((x) => x.contacts).map((x) => [x.referral_id, x.contacts!]));
          for (const x of prefs) P.prefs[`${c.id}/${x.referral_id}`] = JSON.stringify({ n: x.notify ?? undefined, c: x.contacts ?? undefined });
          ops[c.id] = { ...(s.ops[c.id] ?? blankOps()), notices: l.notices.filter((n) => n.clinic_id === c.id).map((n) => n.notice), notifyPrefs, contacts };
        }
        return { ...s, data, published, ops, familySession: { contact: l.email }, sync: { loading: false, error: null } };
      });
    } catch (e) {
      fail(e);
    }
  }, [fail]);

  // Sign-in state comes from Supabase Auth; load the right data for this app.
  useEffect(() => {
    if (!HOSTED) return;
    const kind = getAppKind();
    let unwatch: (() => void) | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const { data: sub } = hosted.sb().auth.onAuthStateChange((event, session) => {
      // Supabase asks not to call it from inside this callback; do it right after.
      setTimeout(() => {
        if (!session) {
          unwatch?.();
          unwatch = null;
          setState((s) => ({ ...empty(), toursSeen: s.toursSeen, sync: { loading: false, error: null } }));
          return;
        }
        if (event !== "INITIAL_SESSION" && event !== "SIGNED_IN") return;
        if (kind === "clinic") void hydrateStaff();
        else if (kind === "family") {
          void hydrateFamily();
          unwatch ??= hosted.watchFamily(() => {
            clearTimeout(timer);
            timer = setTimeout(() => void hydrateFamily(), 800);
          });
        } else setState((s) => ({ ...s, sync: { loading: false, error: null } }));
      }, 0);
    });
    return () => {
      sub.subscription.unsubscribe();
      unwatch?.();
    };
  }, [hydrateStaff, hydrateFamily]);

  // Clinic portal: send imports, staff changes, notices and estimates to the server.
  const publishTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const opsTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => {
    if (!HOSTED || state.sync?.loading) return;
    const P = pushed.current;
    const newAudit = state.audit.filter((a) => !P.audit.has(a.id));
    if (newAudit.length) {
      newAudit.forEach((a) => P.audit.add(a.id));
      void hosted.addAudit(newAudit).catch(() => {});
    }
    const member = state.staffAccount;
    if (getAppKind() === "clinic" && member) {
      const c = member.clinicId;
      const d = state.data[c];
      const ops = state.ops[c];
      if (d && P.importedAt[c] !== d.importedAt && member.role === "admin") {
        P.importedAt[c] = d.importedAt;
        const log = state.imports.find((i) => i.clinicId === c);
        void hosted
          .saveImport(c, {
            records: d.records,
            asOf: d.asOf,
            fileName: d.fileName,
            via: d.via === "upload" ? "upload" : "sync",
            importedAt: d.importedAt,
            recipe: state.recipes[c],
            log: {
              at: log?.at ?? d.importedAt,
              by_email: log?.by ?? member.email,
              via: d.via === "upload" ? "upload" : "sync",
              file_name: d.fileName,
              data_as_of: d.asOf,
              rows: log?.rows ?? d.records.length,
              records: d.records.length,
              errors: log?.errors ?? 0,
              warnings: log?.warnings ?? 0,
              diff: log?.diff ?? null,
              recipe_by: log?.recipeBy ?? "rules",
            },
          })
          .catch(fail);
      }
      if (ops && member.role !== "manager") {
        const json = JSON.stringify(opsForServer(ops));
        if (P.ops[c] !== json) {
          P.ops[c] = json;
          clearTimeout(opsTimer.current);
          opsTimer.current = setTimeout(() => void hosted.saveOps(c, stateRef.current.ops[c]).catch(fail), 500);
        }
        const fresh = ops.notices.filter((n) => !P.notices.has(n.id));
        if (fresh.length) {
          fresh.forEach((n) => P.notices.add(n.id));
          void hosted.sendNotices(c, fresh).catch(fail);
        }
      }
      if (d && ops && member.role !== "manager") {
        const key = `${d.importedAt}|${JSON.stringify({ p: ops.priority, i: ops.intakeCompleted, x: ops.extraSlots })}`;
        if (P.published[c] !== key) {
          P.published[c] = key;
          clearTimeout(publishTimer.current);
          publishTimer.current = setTimeout(() => {
            const s = stateRef.current;
            const dd = s.data[c];
            if (!dd) return;
            const pub = toPublished(makeView(c, dd, s.ops[c]));
            void hosted.publish(c, pub.rows, pub.summary).catch(fail);
          }, 1200);
        }
      }
    }
    // Family app: the family's own notification choices.
    if (getAppKind() === "family" && state.familySession) {
      for (const [c, o] of Object.entries(state.ops)) {
        const ids = new Set([...Object.keys(o.notifyPrefs), ...Object.keys(o.contacts)]);
        for (const id of ids) {
          const key = `${c}/${id}`;
          const json = JSON.stringify({ n: o.notifyPrefs[id], c: o.contacts[id] });
          if (P.prefs[key] === json) continue;
          P.prefs[key] = json;
          void hosted.saveFamilyPrefs(c, id, o.notifyPrefs[id], o.contacts[id]).catch(fail);
        }
      }
    }
  }, [state, fail]);

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
        if (HOSTED && getAppKind() === "family") {
          const pub = state.published?.[clinicId];
          return pub ? familyView(clinicId, d, pub, ops) : null;
        }
        const hit = views.current.get(clinicId);
        if (hit && hit.data === d && hit.ops === ops) return hit.view;
        const view = makeView(clinicId, d, ops);
        views.current.set(clinicId, { data: d, ops, view });
        return view;
      },
      signInStaff: async (email, password) => {
        if (HOSTED) {
          setState((s) => ({ ...s, sync: { loading: true, error: null } }));
          const err = await hosted.staffSignIn(email, password);
          if (err) setState((s) => ({ ...s, sync: { loading: false, error: null } }));
          return err;
        }
        const acct = STAFF.find((s) => s.email.toLowerCase() === email.trim().toLowerCase());
        if (!acct || password !== DEMO_STAFF_PASSWORD) return "That email and password don't match a clinic account.";
        setState((s) => addAudit({ ...s, staffSession: { email: acct.email } }, acct.clinicId, "Signed in", "Clinic portal", acct.email));
        return null;
      },
      signOutStaff: () => {
        if (HOSTED) {
          void hosted.signOut();
          return;
        }
        setState((s) => (s.staffSession ? addAudit({ ...s, staffSession: null }, STAFF.find((x) => x.email === s.staffSession!.email)?.clinicId ?? null, "Signed out", "Clinic portal", s.staffSession.email) : s));
      },
      requestCode: async (contact) => {
        const to = contact.trim();
        if (HOSTED) {
          if (!to.includes("@")) return "Sign-in by text message isn't switched on yet. Please use your email.";
          return hosted.sendFamilyCode(to);
        }
        const code = String(Math.floor(100000 + Math.random() * 900000));
        setState((s) => ({
          ...s,
          otp: { contact: contactKey(to), code, at: new Date().toISOString() },
          inbox: [
            {
              id: uid(),
              at: new Date().toISOString(),
              to,
              subject: "Your ClearWait sign-in code",
              body: `Your code is ${code}. It works for 10 minutes. If you didn't ask for it, you can ignore this message.`,
            },
            ...s.inbox,
          ].slice(0, 20),
        }));
        return null;
      },
      verifyCode: async (contact, code) => {
        if (HOSTED) {
          const err = await hosted.verifyFamilyCode(contact, code);
          if (!err) setState((s) => addAudit(s, null, "Family signed in", "One-time code", `family ${maskContact(contact)}`));
          return !err;
        }
        const o = state.otp;
        const fresh = o && Date.now() - new Date(o.at).getTime() < 10 * 60 * 1000;
        if (!o || !fresh || o.contact !== contactKey(contact) || o.code !== code.trim()) return false;
        setState((s) => addAudit({ ...s, otp: null, familySession: { contact: contact.trim() } }, null, "Family signed in", "One-time code", `family ${maskContact(contact)}`));
        return true;
      },
      demoFamily: async () => (HOSTED ? hosted.demoFamilySignIn() : "Only in the hosted version"),
      signOutFamily: () => {
        if (HOSTED) void hosted.signOut();
        else setState((s) => ({ ...s, familySession: null }));
      },
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
        if (HOSTED) {
          const c = staff?.clinicId;
          if (!c) return;
          const seed = seedImport(c);
          const now = new Date().toISOString();
          setState((s) => {
            const ops = blankOps();
            const data = seed ? { records: seed.conv.records, asOf: seed.conv.validation.asOf, importedAt: now, fileName: seed.file.name, via: "sync" as const } : null;
            if (data) ops.told = toldByAll(listQueue(makeView(c, data, ops)));
            const next = { ...s, ops: { ...s.ops, [c]: ops }, data: data ? { ...s.data, [c]: data } : Object.fromEntries(Object.entries(s.data).filter(([k]) => k !== c)) };
            return addAudit(next, c, "Demo data reset", seed ? `Back to ${seed.file.name}` : "Referrals cleared", actor);
          });
          if (!seed) void hosted.saveImport(c, { records: [], asOf: today(), fileName: "", via: "upload", importedAt: now, recipe: state.recipes[c], log: { at: now, by_email: actor, via: "upload", file_name: "(reset)", data_as_of: today(), rows: 0, records: 0, errors: 0, warnings: 0, diff: null, recipe_by: "staff" } }).then(() => hosted.publish(c, [], { asOf: today(), familyVisible: false, coverage: null, resolved: 0, intake: { typical_days: 21, most_within_days: 42 } })).catch(() => {});
          return;
        }
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

/** The part of a clinic's working state that is shared through the server. */
function opsForServer(o: DemoState) {
  return { extraSlots: o.extraSlots, intakeCompleted: o.intakeCompleted, priority: o.priority, told: o.told, priorityLog: o.priorityLog };
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
