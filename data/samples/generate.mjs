// Generates the sample clinic exports in data/samples/: three fictional
// clinics, each exporting from a different (fictional) clinic system in its own
// format. No real patient data exists in this repo; these are synthetic.
//
// Run from the repo root:  node data/samples/generate.mjs
// The seeds are fixed, so the files come out the same every time.
//
// How the clinics behave is simulated week by week: referrals arrive (with a
// September rise and a summer and December dip), intake takes a few weeks,
// clinicians offer a number of first-assessment slots a week (booked about two
// weeks ahead), some families miss the appointment and are rebooked, some go on
// hold, some withdraw. The levels were tuned so the outputs land near public
// figures, not copied from them:
// - Ontario community-based children's rehab waits averaged about 151 days in
//   2022–23 (Financial Accountability Office of Ontario, 2023). Maple Grove is
//   set near that.
// - NHS England's community health statistics show about half of children
//   waiting more than 18 weeks for community services; Lakeshore (small, rural)
//   is set slower than Maple Grove.
// - About one in five outpatient appointments is missed in the widely used
//   "Medical Appointment No Shows" dataset (Vitória, Brazil); the clinics here
//   use 10–14%, which is closer to booked paediatric therapy.
// - Rivière-Est is large and its referrals grow faster than its capacity, so its
//   wait gets longer over the period (a clinic where the line is speeding up or
//   slowing down is what the back-test is for).

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = dirname(fileURLToPath(import.meta.url));
const DAY = 86_400_000;
const toDate = (s) => new Date(`${s}T00:00:00Z`);
const toStr = (d) => d.toISOString().slice(0, 10);
const addDays = (s, n) => toStr(new Date(toDate(s).getTime() + n * DAY));
const daysBetween = (a, b) => Math.round((toDate(b) - toDate(a)) / DAY);
const weekday = (s) => toDate(s).getUTCDay();
const nextWeekday = (s) => {
  let d = s;
  while (weekday(d) === 0 || weekday(d) === 6) d = addDays(d, 1);
  return d;
};

function mulberry32(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const START = "2024-06-03"; // a Monday
const SNAPSHOTS = ["2026-11-13", "2026-11-20"];
const FINAL = SNAPSHOTS[SNAPSHOTS.length - 1];

const SEASON = { 1: 1.05, 2: 1.05, 3: 1.05, 4: 1.0, 5: 1.0, 6: 0.9, 7: 0.7, 8: 0.75, 9: 1.3, 10: 1.2, 11: 1.1, 12: 0.75 };

const CLINICS = {
  "maple-grove": {
    seed: 11,
    arrivals: 5.6, // referrals a week at the start
    growth: 0.06, // per year
    slots: (week, day) => (day >= "2026-03-02" && day < "2026-07-06" ? 4.3 : 5.3), // one clinician on leave for a term
    noShow: 0.12,
    withdraw: 0.004,
  },
  lakeshore: {
    seed: 22,
    arrivals: 1.8,
    growth: 0.04,
    slots: (week) => (week % 5 === 4 ? 0.6 : 1.85), // one part-time SLP, travels to satellite sites one week in five
    noShow: 0.14,
    withdraw: 0.005,
  },
  "riviere-est": {
    seed: 33,
    arrivals: 12.5,
    growth: 0.2,
    slots: (week, day) => (day >= "2025-09-01" ? 13.2 : 12.9),
    noShow: 0.1,
    withdraw: 0.003,
  },
};

const AGE = [
  ["0–2 years", 3],
  ["2–3 years", 5],
  ["3–4 years", 5],
  ["4–5 years", 3],
];
const SOURCE = [
  ["Family physician", 5],
  ["Paediatrician", 3],
  ["Child care centre", 2],
  ["Parent self-referral", 2],
  ["Public health nurse", 1],
];
const HOLD_REASONS = ["Family request", "Hearing test pending", "Child unwell", "Family travelling"];
const WD_REASONS = ["Family request", "Moved out of area", "Started private therapy", "No longer needed"];

function simulate(name, cfg) {
  const rand = mulberry32(cfg.seed);
  const pick = (weighted) => {
    const total = weighted.reduce((s, [, w]) => s + w, 0);
    let r = rand() * total;
    for (const [v, w] of weighted) if ((r -= w) < 0) return v;
    return weighted[weighted.length - 1][0];
  };
  const poisson = (mean) => {
    const L = Math.exp(-mean);
    let k = 0;
    let p = rand();
    while (p > L) {
      k++;
      p *= rand();
    }
    return k;
  };
  const refs = [];
  let n = 0;
  const totalWeeks = Math.ceil(daysBetween(START, addDays(FINAL, 28)) / 7);
  for (let w = 0; w < totalWeeks; w++) {
    const monday = addDays(START, 7 * w);
    const years = w / 52;
    const month = Number(monday.slice(5, 7));
    const lambda = cfg.arrivals * (1 + cfg.growth * years) * SEASON[month];

    // New referrals this week.
    for (let i = poisson(lambda); i > 0; i--) {
      n++;
      const received = nextWeekday(addDays(monday, Math.floor(rand() * 5)));
      const pr = rand();
      const priority = pr < 0.05 ? "urgent" : pr < 0.2 ? "high" : "standard";
      // Intake: most within 2–4 weeks; a few wait on missing forms much longer.
      const intakeDays = rand() < 0.1 ? 35 + Math.floor(rand() * 50) : 6 + Math.floor(rand() * 22);
      const r = {
        id: n,
        received,
        priority,
        intake: nextWeekday(addDays(received, priority === "urgent" ? Math.min(intakeDays, 7) : intakeDays)),
        age: pick(AGE),
        source: pick(SOURCE),
        hold: null,
        bookings: [],
        booked: null, // current booking {made, for}
        closed: null,
        closeReason: null,
        wdReason: null,
      };
      if (rand() < 0.08) {
        const start = nextWeekday(addDays(r.intake, 7 + Math.floor(rand() * 60)));
        r.hold = { start, end: nextWeekday(addDays(start, 14 + Math.floor(rand() * 56))), reason: HOLD_REASONS[Math.floor(rand() * HOLD_REASONS.length)] };
      }
      refs.push(r);
    }

    const open = refs.filter((r) => !r.closed);
    // Appointments that fall in this week happen (or are missed).
    for (const r of open) {
      if (r.booked && r.booked.for < addDays(monday, 7)) {
        if (rand() < cfg.noShow) {
          r.bookings.push({ ...r.booked, outcome: "missed" });
          r.booked = null;
        } else {
          r.bookings.push({ ...r.booked, outcome: "attended" });
          r.closed = r.booked.for;
          r.closeReason = "assessed";
          r.booked = null;
        }
      }
    }
    // Withdrawals among those still waiting (not booked).
    for (const r of refs) {
      if (r.closed || r.booked || r.received > monday) continue;
      if (rand() < cfg.withdraw * (r.intake <= monday ? 1 : 0.5)) {
        r.closed = nextWeekday(addDays(monday, Math.floor(rand() * 5)));
        r.closeReason = "withdrawn";
        r.wdReason = WD_REASONS[Math.floor(rand() * WD_REASONS.length)];
      }
    }
    // Book this week's slots, about two weeks ahead, in priority then date order.
    const slotsMean = cfg.slots(w, monday);
    let slots = Math.max(0, Math.round(slotsMean + (rand() - 0.5) * 2 * Math.min(1.5, slotsMean * 0.4)));
    const onHold = (r) => r.hold && r.hold.start <= monday && r.hold.end > monday;
    const rank = { urgent: 0, high: 1, standard: 2 };
    const ready = refs
      .filter((r) => !r.closed && !r.booked && r.intake <= monday && !onHold(r))
      .sort((a, b) => rank[a.priority] - rank[b.priority] || a.received.localeCompare(b.received) || a.id - b.id);
    for (const r of ready) {
      if (slots <= 0) break;
      const lead = r.priority === "urgent" ? 7 : 10 + Math.floor(rand() * 10);
      r.booked = { made: monday, for: nextWeekday(addDays(monday, lead)), time: `${String(9 + Math.floor(rand() * 7)).padStart(2, "0")}:${rand() < 0.5 ? "00" : "30"}`, clinician: Math.floor(rand() * 4) };
      slots--;
    }
  }
  return refs;
}

/** The referral as the clinic's system would export it on `asOf`. */
function snapshot(r, asOf) {
  if (r.received > asOf) return null;
  const closed = r.closed && r.closed <= asOf ? r.closed : null;
  // The latest booking known on asOf.
  let booked = null;
  if (!closed) {
    const all = [...r.bookings, ...(r.booked ? [{ ...r.booked, outcome: null }] : [])];
    const known = all.filter((b) => b.made <= asOf && (b.outcome === null || b.for > asOf));
    const last = known[known.length - 1];
    if (last && last.for >= asOf) booked = last;
  }
  const hold = r.hold && r.hold.start <= asOf ? { start: r.hold.start, end: r.hold.end <= asOf ? r.hold.end : null, reason: r.hold.reason } : null;
  return {
    id: r.id,
    received: r.received,
    intake: r.intake <= asOf ? r.intake : null,
    priority: r.priority,
    hold,
    booked,
    closed,
    closeReason: closed ? r.closeReason : null,
    wdReason: closed && r.closeReason === "withdrawn" ? r.wdReason : null,
    age: r.age,
    source: r.source,
    bookings: r.bookings.filter((b) => b.for <= asOf),
  };
}

// Only 100 phone numbers (555-0100 to 555-0199) are reserved as fictional, too few
// to give every family its own, so other families have an email only. The demo
// families have both, so phone sign-in can be tried.
function contact(prefix, id) {
  return { email: `parent.${prefix}${String(id).padStart(4, "0")}@example.com`, phone: "" };
}

const csv = (rows, sep = ",") =>
  rows.map((row) => row.map((v) => (v === null || v === undefined ? "" : /[",;\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v))).join(sep)).join("\n") + "\n";

const DEMO = {
  // the same family has children at two clinics, so their app shows both once both clinics have imported
  family: { email: "demo.family@example.com", phone: "519-555-0100" },
  newFamily: { email: "new.family@example.com", phone: "519-555-0199" },
};

function stats(name, refs) {
  const yearAgo = addDays(FINAL, -365);
  const assessed = refs.filter((r) => r.closeReason === "assessed" && r.closed > yearAgo && r.closed <= FINAL);
  const waits = assessed.map((r) => daysBetween(r.received, r.closed)).sort((a, b) => a - b);
  const mean = waits.reduce((s, x) => s + x, 0) / waits.length;
  const open = refs.filter((r) => r.received <= FINAL && (!r.closed || r.closed > FINAL));
  const over18 = open.filter((r) => daysBetween(r.received, FINAL) > 126).length;
  const noShows = refs.flatMap((r) => r.bookings).filter((b) => b.for <= FINAL);
  console.log(
    `${name}: ${refs.filter((r) => r.received <= FINAL).length} referrals, ${open.length} open on ${FINAL}, ` +
      `mean wait (last year) ${Math.round(mean)} days, median ${waits[Math.floor(waits.length / 2)]}, ` +
      `${Math.round((100 * over18) / open.length)}% of open waiting >18 weeks, ` +
      `missed ${Math.round((100 * noShows.filter((b) => b.outcome === "missed").length) / noShows.length)}%`,
  );
}

// ---------- Maple Grove: "ClinicFlow" per-referral CSV, English headers, ISO dates ----------
{
  const refs = simulate("maple-grove", CLINICS["maple-grove"]);
  stats("Maple Grove", refs);
  const clinicians = ["Priya Natarajan", "Daniel Okafor", "Marie Tremblay", "Wei Chen"];
  const final = refs.map((r) => snapshot(r, FINAL)).filter(Boolean);
  // Demo families: one child in line with a range, one booked, and a new family still in intake.
  const inLine = final.filter((s) => !s.closed && !s.booked && s.intake && s.intake <= "2026-10-15" && s.priority === "standard" && !s.hold);
  const demoWaiting = inLine[Math.floor(inLine.length * 0.45)]?.id;
  // booked during the week between the two exports, so the sync shows it change
  const demoBooked = final.find((s) => s.booked && s.booked.made > "2026-11-13" && s.bookings.length === 0 && s.priority === "standard")?.id;
  const demoNew = final.find((s) => !s.closed && !s.intake && s.received <= "2026-11-12")?.id;
  // A referral that is open in the Nov 13 export and silently missing from the Nov 20 one.
  const vanish = inLine[inLine.length - 3]?.id;
  const header = ["Referral ID", "Program", "Priority Level", "Date Referral Received", "Intake Complete Date", "Hold Start", "Hold End", "Hold Reason", "Appointment Date", "Appointment Time", "Clinician", "Discharge Date", "Discharge Reason", "Age Band", "Referral Source", "Guardian Email", "Guardian Phone"];
  const prio = { urgent: "Urgent", high: "High", standard: "Routine" };
  for (const asOf of SNAPSHOTS) {
    const rows = [header];
    for (const r of refs) {
      const s = snapshot(r, asOf);
      if (!s) continue;
      if (asOf === FINAL && s.id === vanish) continue;
      const c = s.id === demoWaiting || s.id === demoBooked ? DEMO.family : s.id === demoNew ? DEMO.newFamily : contact("mg", s.id);
      rows.push([
        `MG-${String(s.id).padStart(5, "0")}`,
        "Speech-Language Pathology (Preschool)",
        prio[s.priority],
        s.received,
        s.intake,
        s.hold?.start,
        s.hold?.end,
        s.hold?.reason,
        s.booked?.for,
        s.booked?.time,
        s.booked ? clinicians[s.booked.clinician] : null,
        s.closed,
        s.closeReason === "assessed" ? "Assessment completed" : s.closeReason === "withdrawn" ? `Withdrawn - ${s.wdReason}` : null,
        s.age,
        s.source,
        c.email,
        c.phone,
      ]);
    }
    mkdirSync(join(OUT, "maple-grove"), { recursive: true });
    writeFileSync(join(OUT, "maple-grove", `clinicflow-export-${asOf}.csv`), csv(rows));
  }
  console.log(`  demo family: MG-${String(demoWaiting).padStart(5, "0")} (waiting), MG-${String(demoBooked).padStart(5, "0")} (booked); new family MG-${String(demoNew).padStart(5, "0")}; vanishes Nov 20: MG-${String(vanish).padStart(5, "0")}`);
}

// ---------- Lakeshore: "TheraTrack" event log, one row per event, DD/MM/YYYY, P1–P3 codes ----------
{
  const refs = simulate("lakeshore", CLINICS.lakeshore);
  stats("Lakeshore", refs);
  const final = refs.map((r) => snapshot(r, FINAL)).filter(Boolean);
  const inLine = final.filter((s) => !s.closed && !s.booked && s.intake && !s.hold && s.priority === "standard");
  const demo = inLine[Math.floor(inLine.length * 0.3)]?.id;
  const dmy = (s) => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : "");
  const pcode = { urgent: "P1", high: "P2", standard: "P3" };
  const rows = [["client_ref", "svc_cd", "evt_cd", "evt_dt", "appt_dt", "prio_cd", "age_grp", "src_cd", "cg_email", "cg_phone", "note"]];
  for (const s of final) {
    const c = s.id === demo ? DEMO.family : contact("ls", s.id);
    const base = (evt, dt, extra = {}) => [`LS${String(s.id).padStart(4, "0")}`, "SLP-PRE", evt, dmy(dt), dmy(extra.appt), pcode[s.priority], s.age, s.source, c.email, c.phone, extra.note ?? ""];
    rows.push(base("REF", s.received));
    if (s.intake) rows.push(base("INT", s.intake));
    if (s.hold) {
      rows.push(base("HLD+", s.hold.start, { note: s.hold.reason }));
      if (s.hold.end) rows.push(base("HLD-", s.hold.end));
    }
    for (const b of s.bookings) {
      rows.push(base("BKD", b.made, { appt: b.for }));
      if (b.outcome === "missed") rows.push(base("DNA", b.for));
    }
    if (s.booked) rows.push(base("BKD", s.booked.made, { appt: s.booked.for }));
    if (s.closeReason === "assessed") rows.push(base("ATT", s.closed));
    if (s.closeReason === "withdrawn") rows.push(base("WDR", s.closed, { note: s.wdReason }));
  }
  mkdirSync(join(OUT, "lakeshore"), { recursive: true });
  writeFileSync(join(OUT, "lakeshore", `theratrack-events-${FINAL}.csv`), csv(rows));
  console.log(`  demo family: LS${String(demo).padStart(4, "0")}`);
}

// ---------- Rivière-Est: "DossierPlus" per-referral, French headers, semicolons, YYYYMMDD ----------
{
  const refs = simulate("riviere-est", CLINICS["riviere-est"]);
  stats("Rivière-Est", refs);
  const ymd = (s) => (s ? s.replaceAll("-", "") : "");
  const prio = { urgent: "Urgente", high: "Élevée", standard: "Normale" };
  const wd = { "Family request": "Retrait – demande de la famille", "Moved out of area": "Retrait – déménagement", "Started private therapy": "Retrait – service privé", "No longer needed": "Retrait – plus nécessaire" };
  const age = { "0–2 years": "0-2 ans", "2–3 years": "2-3 ans", "3–4 years": "3-4 ans", "4–5 years": "4-5 ans" };
  const rows = [["No_dossier", "Service", "Priorite", "Date_reception", "Date_fin_accueil", "Debut_suspension", "Fin_suspension", "Motif_suspension", "Date_RDV", "Date_fermeture", "Motif_fermeture", "Groupe_age", "Source", "Courriel_parent", "Tel_parent"]];
  for (const r of refs) {
    const s = snapshot(r, FINAL);
    if (!s) continue;
    const c = contact("re", s.id);
    rows.push([
      `RE${String(s.id).padStart(6, "0")}`,
      "Orthophonie préscolaire",
      prio[s.priority],
      ymd(s.received),
      ymd(s.intake),
      ymd(s.hold?.start),
      ymd(s.hold?.end),
      s.hold?.reason,
      ymd(s.booked?.for),
      ymd(s.closed),
      s.closeReason === "assessed" ? "Évaluation complétée" : s.closeReason === "withdrawn" ? wd[s.wdReason] : "",
      age[s.age],
      s.source,
      c.email,
      c.phone,
    ]);
  }
  mkdirSync(join(OUT, "riviere-est"), { recursive: true });
  writeFileSync(join(OUT, "riviere-est", `dossierplus-${FINAL}.csv`), csv(rows, ";"));
}
