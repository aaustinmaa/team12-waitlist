// The three fictional clinics in the demo, their staff accounts and the sample
// exports each one's system produces. Clinic details (name, address, staff)
// are set up once per clinic; referral data only ever comes in through an
// import or a sync.

import mapleNov13 from "../../../data/samples/maple-grove/clinicflow-export-2026-11-13.csv?raw";
import mapleNov20 from "../../../data/samples/maple-grove/clinicflow-export-2026-11-20.csv?raw";
import lakeshoreNov20 from "../../../data/samples/lakeshore/theratrack-events-2026-11-20.csv?raw";
import riviereNov20 from "../../../data/samples/riviere-est/dossierplus-2026-11-20.csv?raw";
import type { Clinic } from "../lib/types";

export type Role = "admin" | "intake" | "manager";

export const ROLE_LABEL: Record<Role, string> = {
  admin: "Clinic admin",
  intake: "Intake staff",
  manager: "Manager (reports only)",
};

/** What each role may do. */
export const CAN = {
  editWaitlist: (r: Role) => r === "admin" || r === "intake",
  importData: (r: Role) => r === "admin",
  manageSettings: (r: Role) => r === "admin",
};

export interface StaffAccount {
  email: string;
  name: string;
  role: Role;
  clinicId: string;
}

export interface SampleFile {
  name: string;
  text: string;
  /** what the file stands for in the demo */
  note: string;
}

export interface ClinicSetup {
  id: string;
  /** the clinic system it exports from, for the Data page */
  system: string;
  info: Clinic;
  samples: SampleFile[];
  /**
   * Demo stand-in for a nightly automatic export: each "sync" picks up the
   * next file in this list after the one last imported.
   */
  syncFeed: SampleFile[];
  /** imported on first load, so the demo opens with data */
  seed?: SampleFile;
}

const PORTALS = [
  { id: "ocean", name: "Ocean eReferral", url: "https://www.oceanhealthbase.com/" },
];

export const CLINICS: ClinicSetup[] = [
  {
    id: "maple-grove",
    system: "ClinicFlow (one row per referral, CSV)",
    info: {
      name: "Maple Grove Children's Centre",
      service: "Speech-language therapy (preschool)",
      contact: "Intake team, 519-555-0142",
      phone: "519-555-0142",
      hours: "Mon–Fri, 8:30–4:30",
      address: "120 Maple Grove Rd, Waterloo, ON",
      timezone: "America/Toronto",
      clinicians: [
        { id: "Priya Natarajan", name: "Priya Natarajan", role: "slp", registration: "CASLPO #F1234", languages: ["en", "fr"] },
        { id: "Daniel Okafor", name: "Daniel Okafor", role: "slp", registration: "CASLPO #F2345", languages: ["en"] },
        { id: "Marie Tremblay", name: "Marie Tremblay", role: "slp", registration: "CASLPO #F3456", languages: ["fr", "en"] },
        { id: "Wei Chen", name: "Wei Chen", role: "slp", registration: "CASLPO #F4567", languages: ["en", "cmn", "yue"] },
      ],
      portals: PORTALS,
    },
    samples: [
      { name: "clinicflow-export-2026-11-13.csv", text: mapleNov13, note: "Export from Nov 13" },
      { name: "clinicflow-export-2026-11-20.csv", text: mapleNov20, note: "Export from Nov 20" },
    ],
    syncFeed: [
      { name: "clinicflow-export-2026-11-13.csv", text: mapleNov13, note: "Nightly export, Nov 13" },
      { name: "clinicflow-export-2026-11-20.csv", text: mapleNov20, note: "Nightly export, Nov 20" },
    ],
    seed: { name: "clinicflow-export-2026-11-13.csv", text: mapleNov13, note: "Nightly export, Nov 13" },
  },
  {
    id: "lakeshore",
    system: "TheraTrack (one row per event, CSV, day-first dates)",
    info: {
      name: "Lakeshore Rural Therapy Services",
      service: "Speech-language therapy (preschool)",
      contact: "Intake line, 519-555-0177",
      phone: "519-555-0177",
      hours: "Tue–Fri, 9:00–4:00",
      address: "8 Harbour St, Goderich, ON",
      timezone: "America/Toronto",
      clinicians: [{ id: "Sam Whitfield", name: "Sam Whitfield", role: "slp", registration: "CASLPO #F5678", languages: ["en"] }],
      portals: PORTALS,
    },
    samples: [{ name: "theratrack-events-2026-11-20.csv", text: lakeshoreNov20, note: "Event log export, Nov 20" }],
    syncFeed: [],
  },
  {
    id: "riviere-est",
    system: "DossierPlus (French, semicolon-separated, YYYYMMDD dates)",
    info: {
      name: "Centre de réadaptation Rivière-Est",
      service: "Orthophonie préscolaire / Preschool speech-language",
      contact: "Accueil / Intake, 613-555-0188",
      phone: "613-555-0188",
      hours: "lun.–ven. / Mon–Fri, 8:00–4:00",
      address: "450 rue de la Rivière, Ottawa, ON",
      timezone: "America/Toronto",
      clinicians: [],
      portals: PORTALS,
    },
    samples: [{ name: "dossierplus-2026-11-20.csv", text: riviereNov20, note: "Export du 20 nov. / Nov 20 export" }],
    syncFeed: [],
  },
];

export const clinicSetup = (id: string) => CLINICS.find((c) => c.id === id);

/**
 * Demo staff accounts. In the hosted version these are real accounts created
 * by each clinic's admin (invite only) with two-step sign-in; here the
 * password is shared and written on the sign-in page.
 */
export const DEMO_STAFF_PASSWORD = "early-birds-demo";

export const STAFF: StaffAccount[] = [
  { email: "admin@maplegrove.example", name: "Alex Rivera", role: "admin", clinicId: "maple-grove" },
  { email: "intake@maplegrove.example", name: "Jordan Lee", role: "intake", clinicId: "maple-grove" },
  { email: "manager@maplegrove.example", name: "Sam Patel", role: "manager", clinicId: "maple-grove" },
  { email: "admin@lakeshore.example", name: "Casey Morgan", role: "admin", clinicId: "lakeshore" },
  { email: "admin@riviere-est.example", name: "Camille Gagnon", role: "admin", clinicId: "riviere-est" },
];

/** Demo families (their referrals come from the sample exports). */
export const DEMO_FAMILIES = [
  { contact: "demo.family@example.com", note: "Two children at Maple Grove, one at Lakeshore (after Lakeshore imports its data)" },
  { contact: "new.family@example.com", note: "Referral still in intake: no estimate yet" },
];
