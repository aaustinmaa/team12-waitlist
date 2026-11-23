// The clinics a referrer can compare, and the data each comparison is worked
// out from.
//
// A clinic that has data on this device (the local demo, after an import or a
// staff change in the clinic portal) is shown from that. Otherwise the clinic's
// latest sample export stands in for what it would publish after its nightly
// sync, so the referrer page always shows every clinic that takes part. In the
// hosted version each clinic would publish this summary to the server, as it
// already does for families; no referral-level data is needed.

import { analyse, convert } from "../ingest/importer";
import { proposeByRules } from "../ingest/rules";
import type { ClinicView } from "../lib/api";
import { CLINICS, clinicSetup } from "./clinics";
import { blankOps, makeView, type ClinicData } from "./store";

const sampleData = new Map<string, ClinicData | null>();

/** The clinic's most recent sample export, imported with the matching rules. */
export function latestSampleData(clinicId: string): ClinicData | null {
  if (sampleData.has(clinicId)) return sampleData.get(clinicId)!;
  const c = clinicSetup(clinicId);
  const file = c && (c.syncFeed[c.syncFeed.length - 1] ?? c.samples[c.samples.length - 1]);
  let data: ClinicData | null = null;
  if (file) {
    const a = analyse(file.name, file.text);
    const conv = convert(a, proposeByRules(a.profile), { today: new Date().toISOString().slice(0, 10) });
    data = { records: conv.records, asOf: conv.validation.asOf, importedAt: `sample:${file.name}`, fileName: file.name, via: "sync" };
  }
  sampleData.set(clinicId, data);
  return data;
}

/** One view per taking-part clinic: this device's data when there is some, else its latest export. */
export function directoryViews(fromStore: (clinicId: string) => ClinicView | null) {
  return CLINICS.flatMap((c) => {
    const v = fromStore(c.id);
    if (v) return [{ setup: c, view: v }];
    const d = latestSampleData(c.id);
    return d ? [{ setup: c, view: makeView(c.id, d, blankOps()) }] : [];
  });
}
