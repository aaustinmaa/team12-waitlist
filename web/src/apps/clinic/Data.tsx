import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { CheckCircle2, CloudDownload, FileUp, Loader2, Sparkles, TriangleAlert } from "lucide-react";
import { btn, Card, CardHeading, Chip } from "../../components/ui";
import { PRIORITIES, RECORD_FIELDS, type RecordField } from "../../engine/types";
import { DATE_FORMATS, type DateFormat } from "../../ingest/dates";
import { analyse, convert, proposeRecipe, recipeFits, type Analysis } from "../../ingest/importer";
import { EVENT_KINDS, IDENTITY_FIELDS, type EventKind, type Recipe } from "../../ingest/recipe";
import { fmtLong } from "../../lib/dates";
import { CAN, clinicSetup, type SampleFile } from "../../platform/clinics";
import { HOSTED, proposeMappingOnServer } from "../../platform/hosted";
import { directTransport } from "../../ingest/gemini";
import { useClinicId, usePlatform } from "../../platform/store";

const FIELD_LABEL: Record<RecordField, string> = {
  referral_id: "Referral ID",
  service: "Service",
  priority: "Priority",
  received_on: "Referral received",
  intake_completed_on: "Intake complete",
  hold_start: "Hold start",
  hold_end: "Hold end",
  hold_reason: "Hold reason",
  booked_for: "Booked assessment date",
  booked_time: "Booked time",
  clinician: "Clinician",
  closed_on: "Left the waitlist on",
  close_reason: "Why it left",
  withdrawn_reason: "Withdrawal reason",
  age_group: "Age group",
  referral_source: "Referral source",
  family_email: "Family email (sign-in only)",
  family_phone: "Family phone (sign-in only)",
};

const KIND_LABEL: Record<EventKind, string> = {
  received: "Referral received",
  intake_complete: "Intake complete",
  hold_start: "Hold starts",
  hold_end: "Hold ends",
  booked: "Assessment booked",
  missed: "Appointment missed",
  assessed: "First assessment done",
  withdrawn: "Withdrawn",
  ignore: "Ignore",
};

const today = () => new Date().toISOString().slice(0, 10);

export function DataPage() {
  const clinicId = useClinicId();
  const p = usePlatform();
  const setup = clinicSetup(clinicId)!;
  const data = p.state.data[clinicId];
  const canImport = !!p.staff && CAN.importData(p.staff.role);
  const [file, setFile] = useState<{ name: string; text: string; via: "upload" | "sync" } | null>(null);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const history = p.state.imports.filter((i) => i.clinicId === clinicId);

  const onPick = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!/\.(csv|tsv|txt)$/i.test(f.name)) {
      setSyncMsg("Save the export as CSV first (in Excel: File → Save As → CSV UTF-8). Excel files aren't read directly yet.");
      return;
    }
    setSyncMsg(null);
    setFile({ name: f.name, text: await f.text(), via: "upload" });
  };

  /** Demo stand-in for the nightly automatic export: pick up the next file and import it with the saved recipe. */
  const runSync = () => {
    const feed = setup.syncFeed;
    const at = feed.findIndex((s) => s.name === data?.fileName);
    const next = feed[at + 1];
    if (!next) {
      setSyncMsg("No new export from the clinic system since the last sync. Already up to date.");
      return;
    }
    const a = analyse(next.name, next.text);
    const recipe = p.state.recipes[clinicId];
    if (!recipe || !recipeFits(recipe, a.table)) {
      setSyncMsg("The export's columns have changed since the mapping was saved, so this sync needs a person to check the mapping.");
      setFile({ name: next.name, text: next.text, via: "sync" });
      return;
    }
    const conv = convert(a, recipe, { today: today(), previous: data?.records });
    const errors = conv.issues.filter((i) => i.level === "error").length;
    const warnings = conv.issues.filter((i) => i.level === "warning").length;
    p.commitImport(clinicId, {
      fileName: next.name,
      via: "sync",
      rows: a.table.rows.length,
      records: conv.records,
      asOf: conv.validation.asOf,
      errors,
      warnings,
      diff: conv.validation.diff,
      recipe,
      by: "nightly sync",
    });
    const d = conv.validation.diff;
    setSyncMsg(
      `Synced ${next.name}: data now as of ${fmtLong(conv.validation.asOf)}.` +
        (d ? ` ${d.added} new referrals, ${d.closed} left the waitlist, ${d.booked} newly booked, ${d.changed} updated${d.vanished.length ? `, ${d.vanished.length} missing from the export (marked for review)` : ""}.` : "") +
        (errors ? ` ${errors} rows had errors and were skipped.` : ""),
    );
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Data</h1>
      <p className="mt-1 text-slate-600">
        Where {setup.info.name}'s waitlist data comes from. Clinic system: <span className="font-medium text-slate-800">{setup.system}</span>.
      </p>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeading>Current data</CardHeading>
          {data ? (
            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <Item label="Data as of" value={fmtLong(data.asOf)} />
              <Item label="Referrals" value={`${data.records.length} (${data.records.filter((r) => !r.closed_on).length} open)`} />
              <Item label="Last file" value={data.fileName} mono />
              <Item label="Came in by" value={data.via === "upload" ? "Manual upload" : "Automatic sync"} />
            </dl>
          ) : (
            <p className="mt-3 text-sm text-slate-600">No data yet. Upload an export below.</p>
          )}
        </Card>
        <Card>
          <CardHeading>Automatic sync</CardHeading>
          {setup.syncFeed.length ? (
            <>
              <p className="mt-3 text-sm text-slate-700">
                <Chip tone="green">Connected · simulated</Chip> ClinicFlow drops an export every night; it is imported with this clinic's saved mapping, so families see changes the next morning without anyone uploading anything.
              </p>
              <button onClick={runSync} disabled={!canImport || !data} className={btn("outline", "mt-4")}>
                <CloudDownload className="size-4" aria-hidden /> Run tonight's sync now
              </button>
            </>
          ) : (
            <p className="mt-3 text-sm text-slate-700">
              <Chip tone="slate">Not connected</Chip> Upload exports by hand for now. Once the mapping is saved, IT can schedule the clinic system to deliver the same export every night (secure file drop), or connect through its API where the vendor offers one (FHIR).
            </p>
          )}
          {syncMsg && <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{syncMsg}</p>}
        </Card>
      </div>

      {file ? (
        <ImportWizard key={file.name + file.via} file={file} onDone={() => setFile(null)} />
      ) : (
        <Card className="mt-6">
          <CardHeading>Import an export</CardHeading>
          {canImport ? (
            <>
              <p className="mt-2 text-sm text-slate-600">
                Any CSV your clinic system exports: one row per referral or one row per event, any column names, English or French. The first time, the columns are matched to ours (with AI if it's switched on in Settings) and you check the match. Later exports reuse it.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <label className={btn("primary", "cursor-pointer")}>
                  <FileUp className="size-4" aria-hidden /> Choose a file
                  <input type="file" accept=".csv,.tsv,.txt,text/csv" onChange={onPick} className="sr-only" />
                </label>
                {setup.samples.map((s: SampleFile) => (
                  <button key={s.name} onClick={() => setFile({ name: s.name, text: s.text, via: "upload" })} className={btn("outline")}>
                    Sample: {s.note}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <p className="mt-2 text-sm text-slate-600">Only the clinic admin can import data.</p>
          )}
        </Card>
      )}

      <Card className="mt-6">
        <CardHeading>Import history</CardHeading>
        {history.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No imports yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="py-2 pr-3 font-medium">When</th>
                  <th className="py-2 pr-3 font-medium">File</th>
                  <th className="py-2 pr-3 font-medium">How</th>
                  <th className="py-2 pr-3 font-medium">Data as of</th>
                  <th className="py-2 pr-3 font-medium">Referrals</th>
                  <th className="py-2 pr-3 font-medium">Changes</th>
                  <th className="py-2 pr-3 font-medium">Issues</th>
                  <th className="py-2 font-medium">Mapping by</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {history.map((h) => (
                  <tr key={h.id}>
                    <td className="whitespace-nowrap py-2 pr-3 text-slate-600">{new Date(h.at).toLocaleString("en-CA", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</td>
                    <td className="py-2 pr-3 font-mono text-xs">{h.fileName}</td>
                    <td className="py-2 pr-3">{h.via === "upload" ? `Upload · ${h.by}` : "Nightly sync"}</td>
                    <td className="whitespace-nowrap py-2 pr-3">{fmtLong(h.asOf)}</td>
                    <td className="py-2 pr-3 tabular-nums">{h.records}</td>
                    <td className="py-2 pr-3 text-slate-600">
                      {h.diff ? `+${h.diff.added} new, ${h.diff.closed} left, ${h.diff.booked} booked${h.diff.vanished.length ? `, ${h.diff.vanished.length} to review` : ""}` : "First import"}
                    </td>
                    <td className="py-2 pr-3">
                      {h.errors} errors · {h.warnings} warnings
                    </td>
                    <td className="py-2">{h.recipeBy === "gemini" ? "AI (Gemini)" : h.recipeBy === "staff" ? "Staff" : "Rules"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function Item({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className={`font-medium text-slate-900 ${mono ? "break-all font-mono text-xs" : ""}`}>{value}</dd>
    </div>
  );
}

// ---------------------------------------------------------------- import wizard

function ImportWizard({ file, onDone }: { file: { name: string; text: string; via: "upload" | "sync" }; onDone: () => void }) {
  const clinicId = useClinicId();
  const p = usePlatform();
  const analysis = useMemo<Analysis>(() => analyse(file.name, file.text), [file]);
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [origin, setOrigin] = useState<"saved" | "proposed">("proposed");
  const [aiError, setAiError] = useState<string | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const previous = p.state.data[clinicId]?.records;

  useEffect(() => {
    let live = true;
    const saved = p.state.recipes[clinicId];
    if (saved && recipeFits(saved, analysis.table)) {
      setRecipe(saved);
      setOrigin("saved");
      return;
    }
    const transport = HOSTED ? proposeMappingOnServer : p.state.ai.geminiKey ? directTransport(p.state.ai.geminiKey, p.state.ai.geminiModel) : null;
    proposeRecipe(analysis, transport).then((r) => {
      if (!live) return;
      setRecipe(r.recipe);
      setAiError(r.aiError);
      setOrigin("proposed");
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analysis]);

  const conv = useMemo(() => (recipe ? convert(analysis, recipe, { today: today(), previous }) : null), [analysis, recipe, previous]);

  if (!recipe || !conv) {
    return (
      <Card className="mt-6">
        <p className="flex items-center gap-2 text-slate-700">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Reading {file.name} and matching its columns{HOSTED || p.state.ai.geminiKey ? " with AI" : ""}…
        </p>
      </Card>
    );
  }

  const markEdited = (f: (r: Recipe) => Recipe) => setRecipe((r) => ({ ...f(r!), proposed_by: "staff" }));
  const errors = conv.issues.filter((i) => i.level === "error");
  const warnings = conv.issues.filter((i) => i.level === "warning");
  const headers = analysis.table.header;
  const fieldsShown = recipe.shape === "per_event" ? IDENTITY_FIELDS : RECORD_FIELDS;
  const kindValues = recipe.event ? analysis.profile.columns.find((c) => c.name === recipe.event!.kind_column)?.values ?? Object.keys(recipe.event.kinds) : [];
  const priorityValues = analysis.profile.columns.find((c) => c.name === recipe.columns.priority)?.values ?? Object.keys(recipe.priority_values);
  const closeValues = analysis.profile.columns.find((c) => c.name === recipe.columns.close_reason)?.values ?? Object.keys(recipe.close_values);
  const blocking = conv.records.length === 0 || !recipe.columns.referral_id;

  const commit = () => {
    p.commitImport(clinicId, {
      fileName: file.name,
      via: file.via,
      rows: analysis.table.rows.length,
      records: conv.records,
      asOf: conv.validation.asOf,
      errors: errors.length,
      warnings: warnings.length,
      diff: conv.validation.diff,
      recipe,
      by: p.staff?.email ?? "staff",
    });
    onDone();
  };

  return (
    <div className="mt-6 space-y-6">
      <Card>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardHeading>Step 1 · Check how the columns were matched</CardHeading>
            <p className="mt-2 text-sm text-slate-700">
              <span className="font-mono">{file.name}</span> · {analysis.table.rows.length} rows · {headers.length} columns ·{" "}
              {recipe.shape === "per_event" ? "one row per event" : "one row per referral"} · dates {recipe.date_format}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {origin === "saved" ? (
              <Chip tone="green">Using this clinic's saved mapping</Chip>
            ) : recipe.proposed_by === "gemini" ? (
              <Chip tone="indigo" icon={<Sparkles className="size-3.5" aria-hidden />}>Proposed by AI (Gemini)</Chip>
            ) : recipe.proposed_by === "staff" ? (
              <Chip tone="teal">Edited by staff</Chip>
            ) : (
              <Chip tone="slate">Proposed by matching rules</Chip>
            )}
          </div>
        </div>
        {aiError && (
          <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
            The AI couldn't be reached ({aiError.slice(0, 160)}), so the matching rules proposed this instead. Check it the same way.
          </p>
        )}
        {recipe.questions.length > 0 && (
          <div className="mt-3 rounded-lg bg-indigo-50 p-3 text-sm text-indigo-900">
            <p className="font-medium">Please check:</p>
            <ul className="mt-1 list-disc ps-5">
              {recipe.questions.slice(0, 8).map((q) => (
                <li key={q}>{q}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-4 grid gap-6 xl:grid-cols-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">{recipe.shape === "per_event" ? "Columns that describe the referral" : "Our field ← your column"}</h3>
            <div className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-200">
              {fieldsShown.map((f) => (
                <label key={f} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                  <span className="text-slate-700">
                    {FIELD_LABEL[f]}
                    {(f === "referral_id" || f === "received_on") && <span className="text-rose-700"> *</span>}
                  </span>
                  <span className="flex items-center gap-2">
                    {recipe.columns[f] && <Confidence c={recipe.confidence[f]} />}
                    <select
                      value={recipe.columns[f] ?? ""}
                      onChange={(e) => markEdited((r) => ({ ...r, columns: { ...r.columns, [f]: e.target.value || undefined } }))}
                      className="max-w-48 rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs"
                    >
                      <option value="">— not in this file —</option>
                      {headers.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-5">
            <label className="flex items-center justify-between gap-3 text-sm">
              <span className="font-semibold text-slate-800">Date format</span>
              <select value={recipe.date_format} onChange={(e) => markEdited((r) => ({ ...r, date_format: e.target.value as DateFormat }))} className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs">
                {DATE_FORMATS.map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
            </label>

            {recipe.event && (
              <ValueMap
                title={`Event types in “${recipe.event.kind_column}” (dates from “${recipe.event.date_column}”${recipe.event.appointment_column ? `, appointment dates from “${recipe.event.appointment_column}”` : ""})`}
                values={kindValues}
                current={recipe.event.kinds}
                options={EVENT_KINDS.map((k) => ({ value: k, label: KIND_LABEL[k] }))}
                onChange={(from, to) => markEdited((r) => ({ ...r, event: { ...r.event!, kinds: { ...r.event!.kinds, [from]: to as EventKind } } }))}
              />
            )}
            {recipe.columns.priority && (
              <ValueMap
                title={`Priority values in “${recipe.columns.priority}”`}
                values={priorityValues}
                current={recipe.priority_values}
                options={PRIORITIES.map((x) => ({ value: x, label: x[0].toUpperCase() + x.slice(1) }))}
                onChange={(from, to) => markEdited((r) => ({ ...r, priority_values: { ...r.priority_values, [from]: to as Recipe["priority_values"][string] } }))}
              />
            )}
            {recipe.columns.close_reason && (
              <ValueMap
                title={`Why a referral left, in “${recipe.columns.close_reason}”`}
                values={closeValues}
                current={recipe.close_values}
                options={[
                  { value: "assessed", label: "First assessment done" },
                  { value: "withdrawn", label: "Withdrawn" },
                ]}
                onChange={(from, to) => markEdited((r) => ({ ...r, close_values: { ...r.close_values, [from]: to as "assessed" | "withdrawn" } }))}
              />
            )}
            {recipe.ignored_columns.length > 0 && (
              <p className="text-xs text-slate-500">
                Not used: {recipe.ignored_columns.join(", ")}. Columns we don't need are never stored.
              </p>
            )}
          </div>
        </div>

        <button type="button" onClick={() => setShowProfile(!showProfile)} className="mt-4 text-sm font-medium text-teal-700 underline underline-offset-2">
          {showProfile ? "Hide" : "Show"} exactly what the AI is sent
        </button>
        {showProfile && (
          <div className="mt-2">
            <p className="text-xs text-slate-500">
              Column names, value types and a few examples per column, with emails, phone numbers and names replaced. The rows themselves never leave this browser.
            </p>
            <pre className="mt-2 max-h-72 overflow-auto rounded-lg bg-slate-50 p-3 text-xs text-slate-700">{JSON.stringify(analysis.profile, null, 1)}</pre>
          </div>
        )}
      </Card>

      <Card>
        <CardHeading>Step 2 · Check the result</CardHeading>
        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          <Chip tone={conv.records.length ? "green" : "rose"} icon={<CheckCircle2 className="size-3.5" aria-hidden />}>
            {conv.records.length} referrals read
          </Chip>
          <Chip tone="slate">Data as of {fmtLong(conv.validation.asOf)}</Chip>
          <Chip tone={errors.length ? "rose" : "slate"}>{errors.length} rows skipped (errors)</Chip>
          <Chip tone={warnings.length ? "amber" : "slate"}>{warnings.length} warnings</Chip>
          {conv.validation.diff && (
            <Chip tone="indigo">
              vs current: +{conv.validation.diff.added} new · {conv.validation.diff.closed} left · {conv.validation.diff.booked} booked · {conv.validation.diff.changed} updated
              {conv.validation.diff.vanished.length ? ` · ${conv.validation.diff.vanished.length} missing → review` : ""}
            </Chip>
          )}
        </div>
        {(errors.length > 0 || warnings.length > 0) && (
          <ul className="mt-3 max-h-48 space-y-1 overflow-y-auto rounded-lg bg-slate-50 p-3 text-xs">
            {[...errors, ...warnings].slice(0, 30).map((i, n) => (
              <li key={n} className={i.level === "error" ? "text-rose-800" : "text-amber-900"}>
                <TriangleAlert className="me-1 inline size-3.5" aria-hidden />
                {i.row ? `Row ${i.row}: ` : ""}
                {i.message}
              </li>
            ))}
            {errors.length + warnings.length > 30 && <li className="text-slate-500">…and {errors.length + warnings.length - 30} more</li>}
          </ul>
        )}
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-slate-500">
              <tr>
                {["ID", "Priority", "Received", "Intake", "Hold", "Booked for", "Left on", "Outcome"].map((h) => (
                  <th key={h} className="py-1.5 pr-3 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {[...conv.records].sort((a, b) => b.received_on.localeCompare(a.received_on)).slice(0, 8).map((r) => (
                <tr key={r.referral_id}>
                  <td className="py-1.5 pr-3">{r.referral_id}</td>
                  <td className="py-1.5 pr-3">{r.priority}</td>
                  <td className="py-1.5 pr-3">{r.received_on}</td>
                  <td className="py-1.5 pr-3">{r.intake_completed_on ?? "–"}</td>
                  <td className="py-1.5 pr-3">{r.hold_start ? `${r.hold_start}→${r.hold_end ?? "open"}` : "–"}</td>
                  <td className="py-1.5 pr-3">{r.booked_for ?? "–"}</td>
                  <td className="py-1.5 pr-3">{r.closed_on ?? "–"}</td>
                  <td className="py-1.5 pr-3">{r.close_reason ?? "open"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-1 text-xs text-slate-500">Newest 8 referrals, as they will be stored. Family contact details are kept only for sign-in and updates.</p>
        </div>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button onClick={onDone} className={btn("outline")}>
            Cancel
          </button>
          <button onClick={commit} disabled={blocking} className={btn("primary")}>
            Import {conv.records.length} referrals and save this mapping
          </button>
        </div>
      </Card>
    </div>
  );
}

function Confidence({ c }: { c: number | undefined }) {
  if (c === undefined) return null;
  const tone = c >= 0.85 ? "text-emerald-700" : c >= 0.6 ? "text-amber-700" : "text-rose-700";
  return <span className={`text-xs tabular-nums ${tone}`} title="How sure the matcher was">{Math.round(c * 100)}%</span>;
}

function ValueMap({
  title,
  values,
  current,
  options,
  onChange,
}: {
  title: string;
  values: string[];
  current: Record<string, string>;
  options: { value: string; label: string }[];
  onChange: (from: string, to: string) => void;
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      <div className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-200">
        {values.map((v) => (
          <label key={v} className="flex items-center justify-between gap-3 px-3 py-1.5 text-sm">
            <span className="font-mono text-xs text-slate-700">{v}</span>
            <select
              value={current[v] ?? ""}
              onChange={(e) => onChange(v, e.target.value)}
              className={`rounded-lg border bg-white px-2 py-1 text-xs ${current[v] ? "border-slate-300" : "border-rose-300"}`}
            >
              <option value="">— choose —</option>
              {options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
    </div>
  );
}
