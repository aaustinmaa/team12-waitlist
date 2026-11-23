// The hosted backend (Supabase). When a project URL and its public anon key
// are configured, the apps sign in with real accounts and keep their data in
// Postgres, so a family's phone and a clinic's laptop see the same thing.
// Without them, everything stays in the browser (the local demo).
//
// The anon key is meant to be public: row-level security in
// supabase/migrations decides what each signed-in person can read or change.
// No secret (service key, Gemini key) is ever in this file or the browser.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { ReferralRecord } from "../engine/types";
import type { Recipe } from "../ingest/recipe";
import type { ImportDiff } from "../ingest/validate";
import type { DemoState, Notice, NotifyPrefs } from "../lib/types";
import type { Role } from "./clinics";

// Public settings of the team's Supabase project. Can be overridden with
// VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY (e.g. in web/.env.local).
const PROJECT = {
  url: "",
  anonKey: "",
};

const env = import.meta.env as Record<string, string | undefined>;
const URL_ = env.VITE_SUPABASE_URL || PROJECT.url;
const KEY = env.VITE_SUPABASE_ANON_KEY || PROJECT.anonKey;
const forcedLocal = typeof location !== "undefined" && /[?&]local\b/.test(location.search);

/** True when the apps run against Supabase rather than browser storage. */
export const HOSTED = !!(URL_ && KEY) && !forcedLocal && env.MODE !== "test";

export type AppKind = "family" | "clinic" | "demo";
let appKind: AppKind = "family";
let client: SupabaseClient | null = null;

/** Called once by each entry page; families and staff keep separate sign-ins on the same device. */
export function setAppKind(kind: AppKind) {
  appKind = kind;
}
export const getAppKind = () => appKind;

export function sb() {
  if (!HOSTED) throw new Error("Supabase is not configured");
  client ??= createClient(URL_, KEY, { auth: { storageKey: `early-birds-${appKind}-auth`, persistSession: true, autoRefreshToken: true } });
  return client;
}

/** A demo-only family account with a shared password, so visitors can try the family app without their own referral. */
export const DEMO_FAMILY = { email: "demo.family@example.com", password: "early-birds-demo" };

// ---------------------------------------------------------------- staff

export interface StaffMember {
  email: string;
  name: string;
  role: Role;
  clinicId: string;
}

export interface StaffLoad {
  member: StaffMember;
  records: ReferralRecord[];
  state: { ops: Partial<DemoState>; recipe: Recipe | null; data_as_of: string | null; file_name: string | null; via: string | null; imported_at: string | null } | null;
  imports: ImportRow[];
  audit: AuditRow[];
  notices: Notice[];
}

export interface ImportRow {
  id: number;
  clinic_id: string;
  at: string;
  by_email: string;
  via: string;
  file_name: string;
  data_as_of: string;
  rows: number;
  records: number;
  errors: number;
  warnings: number;
  diff: ImportDiff | null;
  recipe_by: string;
}

export interface AuditRow {
  id: number;
  at: string;
  clinic_id: string | null;
  actor: string;
  action: string;
  detail: string;
  referral_id: string | null;
}

/** Postgres returns at most 1000 rows per request; page through larger tables. */
async function all<T>(q: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>) {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await q(from, from + 999);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) return out;
  }
}

const RECORD_COLUMNS =
  "referral_id,service,priority,received_on,intake_completed_on,hold_start,hold_end,hold_reason,booked_for,booked_time,clinician,closed_on,close_reason,withdrawn_reason,age_group,referral_source,family_email,family_phone,needs_review";

export async function staffSignIn(email: string, password: string) {
  const { error } = await sb().auth.signInWithPassword({ email: email.trim(), password });
  return error ? "That email and password don't match a clinic account." : null;
}

export async function loadStaff(): Promise<StaffLoad | null> {
  const { data: u } = await sb().auth.getUser();
  if (!u.user) return null;
  const { data: m, error } = await sb().from("staff_members").select("email,name,role,clinic_id").eq("user_id", u.user.id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!m) throw new Error(`${u.user.email} is signed in but isn't on any clinic's team. Ask the clinic admin to invite this email.`);
  const member: StaffMember = { email: m.email, name: m.name, role: m.role as Role, clinicId: m.clinic_id };
  const c = member.clinicId;
  const [records, st, imports, audit, notices] = await Promise.all([
    all<ReferralRecord>((f, t) => sb().from("referrals").select(RECORD_COLUMNS).eq("clinic_id", c).order("referral_id").range(f, t)),
    sb().from("clinic_state").select("ops,recipe,data_as_of,file_name,via,imported_at").eq("clinic_id", c).maybeSingle(),
    sb().from("imports").select("*").eq("clinic_id", c).order("at", { ascending: false }).limit(200),
    member.role === "admin" ? sb().from("audit_log").select("*").eq("clinic_id", c).order("at", { ascending: false }).limit(500) : Promise.resolve({ data: [] as AuditRow[] }),
    sb().from("notices").select("notice").eq("clinic_id", c).order("at", { ascending: false }).limit(300),
  ]);
  return {
    member,
    records,
    state: st.data ?? null,
    imports: (imports.data ?? []) as ImportRow[],
    audit: (audit.data ?? []) as AuditRow[],
    notices: ((notices.data ?? []) as { notice: Notice }[]).map((n) => n.notice),
  };
}

export async function saveImport(clinicId: string, a: { records: ReferralRecord[]; asOf: string; fileName: string; via: string; importedAt: string; recipe: Recipe; log: Omit<ImportRow, "id" | "clinic_id"> }) {
  const rows = a.records.map((r) => ({ ...r, clinic_id: clinicId, needs_review: !!r.needs_review }));
  const { error } = await sb().rpc("replace_referrals", { p_clinic: clinicId, p_rows: rows });
  if (error) throw new Error(error.message);
  const st = await sb()
    .from("clinic_state")
    .upsert({ clinic_id: clinicId, recipe: a.recipe, data_as_of: a.asOf, file_name: a.fileName, via: a.via, imported_at: a.importedAt }, { onConflict: "clinic_id" });
  if (st.error) throw new Error(st.error.message);
  const im = await sb().from("imports").insert({ clinic_id: clinicId, ...a.log });
  if (im.error) throw new Error(im.error.message);
}

export async function saveOps(clinicId: string, ops: DemoState) {
  // Notices go to their own table; the tour flags are per device.
  const { notices: _n, toursSeen: _t, notifyPrefs: _p, contacts: _c, ...rest } = ops;
  void _n, _t, _p, _c;
  const { error } = await sb().from("clinic_state").upsert({ clinic_id: clinicId, ops: rest }, { onConflict: "clinic_id" });
  if (error) throw new Error(error.message);
}

export interface PublishedEstimate {
  clinic_id: string;
  referral_id: string;
  status: string;
  position: number | null;
  lower_weeks: number | null;
  upper_weeks: number | null;
  reason: string | null;
}

export interface ClinicSummary {
  asOf: string;
  familyVisible: boolean;
  coverage: number | null;
  resolved: number;
  intake: { typical_days: number; most_within_days: number };
}

export async function publish(clinicId: string, rows: PublishedEstimate[], summary: ClinicSummary) {
  const { error } = await sb().rpc("publish_estimates", { p_clinic: clinicId, p_rows: rows, p_summary: summary });
  if (error) throw new Error(error.message);
}

export async function sendNotices(clinicId: string, notices: Notice[]) {
  if (!notices.length) return;
  const { error } = await sb()
    .from("notices")
    .upsert(notices.map((n) => ({ id: `${clinicId}:${n.id}`, clinic_id: clinicId, referral_id: n.referral_id, notice: n, at: n.at })), { onConflict: "id", ignoreDuplicates: true });
  if (error) throw new Error(error.message);
}

export async function addAudit(entries: { at: string; clinicId: string | null; actor: string; action: string; detail: string; referral_id?: string }[]) {
  if (!entries.length) return;
  await sb()
    .from("audit_log")
    .insert(entries.map((e) => ({ at: e.at, clinic_id: e.clinicId, actor: e.actor, action: e.action, detail: e.detail, referral_id: e.referral_id ?? null })));
}

// ---------------------------------------------------------------- families

export async function sendFamilyCode(email: string) {
  const { error } = await sb().auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: true } });
  return error ? error.message : null;
}

export async function verifyFamilyCode(email: string, code: string) {
  const { error } = await sb().auth.verifyOtp({ email: email.trim(), token: code.trim(), type: "email" });
  return error ? error.message : null;
}

export async function demoFamilySignIn() {
  const { error } = await sb().auth.signInWithPassword(DEMO_FAMILY);
  return error ? error.message : null;
}

export interface FamilyLoad {
  email: string;
  records: (ReferralRecord & { clinic_id: string })[];
  estimates: PublishedEstimate[];
  summaries: Record<string, ClinicSummary>;
  notices: { clinic_id: string; notice: Notice }[];
  prefs: { clinic_id: string; referral_id: string; notify: NotifyPrefs | null; contacts: { email?: string; phone?: string } | null }[];
}

export async function loadFamily(): Promise<FamilyLoad | null> {
  const { data: u } = await sb().auth.getUser();
  if (!u.user?.email) return null;
  const [refs, est, sums, notes, prefs] = await Promise.all([
    sb().from("referrals").select(`clinic_id,${RECORD_COLUMNS}`),
    sb().from("estimates").select("*"),
    sb().from("clinic_summary").select("clinic_id,summary"),
    sb().from("notices").select("clinic_id,notice").order("at", { ascending: false }).limit(100),
    sb().from("family_prefs").select("*"),
  ]);
  for (const r of [refs, est, sums, notes, prefs]) if (r.error) throw new Error(r.error.message);
  return {
    email: u.user.email,
    records: (refs.data ?? []) as FamilyLoad["records"],
    estimates: (est.data ?? []) as PublishedEstimate[],
    summaries: Object.fromEntries((sums.data ?? []).map((s: { clinic_id: string; summary: ClinicSummary }) => [s.clinic_id, s.summary])),
    notices: (notes.data ?? []) as FamilyLoad["notices"],
    prefs: (prefs.data ?? []) as FamilyLoad["prefs"],
  };
}

export async function saveFamilyPrefs(clinicId: string, referralId: string, notify: NotifyPrefs | undefined, contacts: { email?: string; phone?: string } | undefined) {
  await sb()
    .from("family_prefs")
    .upsert({ clinic_id: clinicId, referral_id: referralId, notify: notify ?? null, contacts: contacts ?? null }, { onConflict: "clinic_id,referral_id" });
}

/** Call `onChange` when anything a signed-in family can see changes. Returns an unsubscribe function. */
export function watchFamily(onChange: () => void) {
  const ch = sb()
    .channel("family")
    .on("postgres_changes", { event: "*", schema: "public", table: "estimates" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "notices" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "clinic_summary" }, onChange)
    .subscribe();
  return () => void sb().removeChannel(ch);
}

/** AI column matching through the server function, which holds the Gemini key. */
export async function proposeMappingOnServer(body: unknown) {
  const { data, error } = await sb().functions.invoke("propose-mapping", { body: body as Record<string, unknown> });
  if (error) throw new Error(error.message);
  return data;
}

export async function signOut() {
  await sb().auth.signOut();
}
