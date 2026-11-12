import { useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router";
import { ShieldCheck } from "lucide-react";
import { CLINIC } from "../lib/api";
import { downloadCsv, toCsv } from "../lib/csv";
import { fmtLong, fmtShort } from "../lib/dates";
import {
  DEFAULT_QUARTER,
  QUARTERS,
  REPORT_AS_OF,
  breakdown,
  estimatePoints,
  monthlyFlow,
  previousQuarter,
  quarterTable,
  summarize,
  summaryTable,
  weeklyWaitlist,
  type Quarter,
} from "../lib/reports";
import { C, Legend, RangeChart, TableView, TimeChart, type TimePoint } from "../components/charts";
import { StaffTabs } from "../components/StaffTabs";
import { Card, Chip } from "../components/ui";

const wk = (n: number | null) => (n === null ? "–" : `${n.toFixed(1)} wk`);
const MONTH_YEAR = new Intl.DateTimeFormat("en-CA", { month: "long", year: "numeric", timeZone: "UTC" });

export function ReportsPage() {
  const [params, setParams] = useSearchParams();
  const quarter = QUARTERS.find((q) => q.key === params.get("q")) ?? DEFAULT_QUARTER;
  const setQuarter = (key: string) => setParams({ q: key }, { replace: true });

  const s = useMemo(() => summarize(quarter), [quarter]);
  const prevQ = previousQuarter(quarter);
  const prev = useMemo(() => (prevQ ? summarize(prevQ) : null), [prevQ]);
  const weekly = useMemo(weeklyWaitlist, []);
  const monthly = useMemo(monthlyFlow, []);
  const checks = useMemo(() => estimatePoints(quarter), [quarter]);
  const bySource = useMemo(() => breakdown(quarter, "referral_source"), [quarter]);
  const byAge = useMemo(() => breakdown(quarter, "age_group"), [quarter]);

  const band = { start: quarter.start, end: quarter.last };
  const insidePct = s.estimatesChecked ? Math.round((100 * s.estimatesInside) / s.estimatesChecked) : null;
  const vs = prevQ ? `vs ${prevQ.short}` : "";
  const countDelta = (now: number, before: number | undefined) => {
    if (quarter.partial) return "Quarter in progress";
    return before === undefined ? "" : `${signed(now - before)} ${vs}`;
  };

  const weeklyPoints: TimePoint[] = weekly.map((w) => ({ date: w.date, values: { total: w.waiting + w.onHold, onHold: w.onHold } }));
  const flowPoints: TimePoint[] = monthly.map((mm) => ({ date: mm.date, values: { referrals: mm.referrals, assessed: mm.assessed } }));
  const waitPoints: TimePoint[] = monthly.map((mm) => ({ date: mm.date, values: { median: mm.medianWait, p90: mm.p90Wait } }));
  const monthOf = (p: TimePoint) => MONTH_YEAR.format(new Date(`${p.date}T00:00:00Z`));

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      <StaffTabs />
      <div>
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <Chip tone="rose" icon={<ShieldCheck className="size-3.5" aria-hidden />}>Staff only</Chip>
          <span className="text-sm text-slate-500">Intake team · {CLINIC.name}</span>
        </div>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Waitlist report · {quarter.label}</h1>
        <p className="mt-1 text-slate-600">
          {CLINIC.service} · first-assessment waitlist · {fmtLong(quarter.start)} to {fmtLong(quarter.last)}
          {quarter.partial && " (quarter in progress)"}
        </p>
      </div>

      {/* One filter row scopes everything below it. */}
      <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center print:hidden">
        <label className="flex items-center gap-2 text-sm text-slate-600">
          Quarter
          <select
            value={quarter.key}
            onChange={(e) => setQuarter(e.target.value)}
            className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 outline-none focus:border-teal-500 sm:flex-none"
          >
            {[...QUARTERS].reverse().map((q) => (
              <option key={q.key} value={q.key}>
                {q.label}
                {q.partial ? " (to date)" : ""}
              </option>
            ))}
          </select>
        </label>
        <p className="text-sm text-slate-500">Every number, chart and download on this page follows the quarter you pick.</p>
      </div>

      <DownloadCard quarter={quarter} />

      <div className="mt-5 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
        <Tile label="Referrals received" value={String(s.referrals)} sub={countDelta(s.referrals, prev?.referrals)} />
        <Tile label="First assessments" value={String(s.assessed)} sub={countDelta(s.assessed, prev?.assessed)} />
        <Tile
          label="Median wait to first assessment"
          value={s.medianWait === null ? "–" : `${s.medianWait.toFixed(1)} weeks`}
          sub={
            s.medianWait !== null && prev?.medianWait != null
              ? `${signed(round1(s.medianWait - prev.medianWait))} wk ${vs}`
              : ""
          }
        />
        <Tile
          label={quarter.partial ? `On the waitlist on ${fmtShort(quarter.last)}` : "On the waitlist at quarter end"}
          value={String(s.waitlistEnd)}
          sub={`${s.onHoldEnd} on hold${prev && !quarter.partial ? ` · ${signed(s.waitlistEnd - prev.waitlistEnd)} ${vs}` : ""}`}
        />
        <Tile
          label="Estimates that held"
          value={insidePct === null ? "–" : `${insidePct}%`}
          sub={s.estimatesChecked ? `${s.estimatesInside} of ${s.estimatesChecked} inside the range` : "No first assessments yet"}
          className="col-span-2 lg:col-span-1"
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2 lg:gap-6">
        <ChartCard
          title="Waitlist size"
          sub="Referrals on the waitlist each week. A booked referral stays on the list until its appointment."
          legend={
            <Legend
              items={[
                { label: "On the waitlist", color: C.blue, kind: "line" },
                { label: "Of those, on hold", color: C.orange, kind: "line" },
              ]}
            />
          }
          className="lg:col-span-2"
        >
          <TimeChart
            points={weeklyPoints}
            series={[
              { key: "total", label: "on the waitlist", color: C.blue },
              { key: "onHold", label: "on hold", color: C.orange },
            ]}
            band={band}
            format={(n) => String(n)}
            heading={(p) => `Week of ${fmtShort(p.date)}, ${p.date.slice(0, 4)}`}
            label="Waitlist size by week, and how many of those were on hold"
          />
          <TableView
            header={["Week of", "Waiting", "On hold", "Total"]}
            rows={weekly.map((w) => [w.date, w.waiting, w.onHold, w.waiting + w.onHold])}
          />
        </ChartCard>

        <ChartCard
          title="Referrals in and first assessments out"
          sub="Per month. When referrals stay above assessments, the waitlist grows."
          legend={
            <Legend
              items={[
                { label: "Referrals received", color: C.blue, kind: "line" },
                { label: "First assessments", color: C.orange, kind: "line" },
              ]}
            />
          }
        >
          <TimeChart
            points={flowPoints}
            series={[
              { key: "referrals", label: "referrals received", color: C.blue },
              { key: "assessed", label: "first assessments", color: C.orange },
            ]}
            band={band}
            format={(n) => String(n)}
            heading={monthOf}
            label="Referrals received and first assessments per month"
          />
          <TableView
            header={["Month", "Referrals received", "First assessments"]}
            rows={monthly.map((mm) => [mm.month.slice(0, 7), mm.referrals, mm.assessed])}
          />
        </ChartCard>

        <ChartCard
          title="Wait to first assessment"
          sub="For children assessed each month, from referral to first assessment, holds included."
          legend={
            <Legend
              items={[
                { label: "Median", color: C.blue, kind: "line" },
                { label: "9 in 10 seen within", color: C.orange, kind: "line" },
              ]}
            />
          }
        >
          <TimeChart
            points={waitPoints}
            series={[
              { key: "median", label: "median", color: C.blue },
              { key: "p90", label: "9 in 10 seen within", color: C.orange },
            ]}
            band={band}
            format={(n) => `${n.toFixed(1)} wk`}
            heading={monthOf}
            label="Median and 90th percentile wait to first assessment, in weeks, by month"
          />
          <TableView
            header={["Month", "Median (weeks)", "90th percentile (weeks)"]}
            rows={monthly.map((mm) => [mm.month.slice(0, 7), wk(mm.medianWait), wk(mm.p90Wait)])}
          />
        </ChartCard>

        <ChartCard
          title="Did the estimate hold?"
          sub={`Each column is one child assessed in ${quarter.label}: the range the family would have seen once intake was complete, and the wait that actually followed (weeks from that date).`}
          legend={
            <Legend
              items={[
                { label: "Estimated range", color: C.rangeFill, kind: "range" },
                { label: "Actual, inside the range", color: C.blue, kind: "dot" },
                { label: "Actual, outside the range", color: C.orange, kind: "dot" },
              ]}
            />
          }
          className="lg:col-span-2"
        >
          {checks.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-500">No first assessments in this quarter yet.</p>
          ) : (
            <>
              <p className="mb-3 text-sm text-slate-700">
                <span className="font-semibold text-slate-900">{s.estimatesInside} of {s.estimatesChecked}</span> inside the range ·{" "}
                {s.estimatesEarlier} seen sooner · {s.estimatesLater} waited longer
                {s.estimatesLater > 0 && <span className="text-slate-500"> (often after a hold the estimate couldn't foresee)</span>}
              </p>
              <RangeChart
                points={checks.map((c) => ({ ...c, inside: c.result === "inside" }))}
                label={`Estimated range and actual wait for each first assessment in ${quarter.label}`}
                describe={(p) => (
                  <>
                    <p className="font-mono font-medium text-slate-700">{p.id}</p>
                    <p className="mt-1 whitespace-nowrap">
                      <span className="font-semibold tabular-nums text-slate-900">{p.actual.toFixed(1)} wk</span>{" "}
                      <span className="text-slate-500">actual wait</span>
                    </p>
                    <p className="whitespace-nowrap">
                      <span className="font-semibold tabular-nums text-slate-900">
                        {p.lower}–{p.upper} wk
                      </span>{" "}
                      <span className="text-slate-500">estimated</span>
                    </p>
                    <p className="mt-1 text-slate-500">{p.inside ? "Inside the range" : p.actual < p.lower ? "Seen sooner than the range" : "Waited longer than the range"}</p>
                  </>
                )}
              />
              <TableView
                header={["Referral", "Estimate (weeks)", "Actual (weeks)", "Result"]}
                rows={checks.map((c) => [c.id, `${c.lower}–${c.upper}`, c.actual.toFixed(1), RESULT[c.result]])}
              />
            </>
          )}
        </ChartCard>

        <BreakdownCard title="By referral source" rows={bySource} quarter={quarter} />
        <BreakdownCard title="By age group" rows={byAge} quarter={quarter} />
      </div>

      <Card className="mt-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">How these numbers are counted</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
          <li>Wait to first assessment runs from the day the clinic logged the referral to the first speech-language assessment, in calendar weeks. Holds are included.</li>
          <li>A referral is on the waitlist from the day it is logged until its first assessment or until it is withdrawn.</li>
          <li>
            "Estimates that held" is a back-test: for each child assessed in the quarter, would the range shown once intake was complete have contained the
            actual wait? A 10th–90th percentile range should hold for about 8 in 10 families.
          </li>
          <li>Exports contain referral IDs only, no names or contact details. Synthetic data for a fictional clinic, as of {fmtLong(REPORT_AS_OF)}.</li>
        </ul>
      </Card>
    </div>
  );
}

const RESULT = { inside: "Inside", earlier: "Sooner", later: "Longer" } as const;

const round1 = (n: number) => Math.round(n * 10) / 10;
const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "No change");
const unpack = (t: { header: string[]; rows: Parameters<typeof toCsv>[1] }) => [t.header, t.rows] as const;

/**
 * The three ways to take this report out of the app. Each option says what the file is, what is in it
 * and what to open it with, so staff know which button to press before they press it.
 */
function DownloadCard({ quarter }: { quarter: Quarter }) {
  const [saved, setSaved] = useState<string | null>(null);
  const referrals = useMemo(() => quarterTable(quarter), [quarter]);
  const summary = useMemo(summaryTable, []);
  const save = (filename: string, t: Parameters<typeof unpack>[0]) => {
    downloadCsv(filename, toCsv(...unpack(t)));
    setSaved(filename);
  };

  return (
    <Card className="mt-5 print:hidden">
      <h2 className="text-lg font-semibold text-slate-900">Download this report</h2>
      <p className="mt-1 text-sm text-slate-600">
        Three ways to share these numbers with your manager or put them in your own report. Files use referral IDs only, never names.
      </p>
      <ul className="mt-4 grid gap-3 md:grid-cols-3">
        <DownloadOption
          title={`Referrals in ${quarter.label}`}
          kind="Spreadsheet (.csv) · opens in Excel or Google Sheets"
          body={`One row for each of the ${referrals.rows.length} children on the waitlist at any point in the quarter: dates, wait, outcome and the estimate they saw.`}
          button="Download spreadsheet"
          onClick={() => save(`waitlist-report-${quarter.key}-referrals.csv`, referrals)}
        />
        <DownloadOption
          title="Quarter-by-quarter summary"
          kind="Spreadsheet (.csv) · opens in Excel or Google Sheets"
          body={`One row for each of the ${summary.rows.length} quarters from ${QUARTERS[0].label} on, with the numbers shown at the top of this page. Good for making your own charts.`}
          button="Download spreadsheet"
          onClick={() => save(`waitlist-report-summary-${REPORT_AS_OF}.csv`, summary)}
        />
        <DownloadOption
          title="This page as a PDF"
          kind={`PDF · all charts and numbers for ${quarter.label}`}
          body="Opens your browser's print window. To get a file instead of paper, choose “Save as PDF” as the printer."
          button="Print or save as PDF"
          onClick={() => window.print()}
        />
      </ul>
      <p role="status" className="mt-3 min-h-5 text-sm text-slate-600">
        {saved && (
          <>
            Downloaded <span className="font-medium text-slate-900">{saved}</span>. Look in your Downloads folder.
          </>
        )}
      </p>
    </Card>
  );
}

function DownloadOption({ title, kind, body, button, onClick }: { title: string; kind: string; body: string; button: string; onClick: () => void }) {
  return (
    <li className="flex flex-col rounded-xl border border-slate-200 p-4">
      <h3 className="font-semibold text-slate-900">{title}</h3>
      <p className="mt-0.5 text-xs font-medium text-slate-500">{kind}</p>
      <p className="mt-2 flex-1 text-sm text-slate-600">{body}</p>
      <button
        onClick={onClick}
        className="mt-3 rounded-lg bg-teal-700 px-3 py-2 text-sm font-semibold text-white hover:bg-teal-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
      >
        {button}
      </button>
    </li>
  );
}

function Tile({ label, value, sub, className = "" }: { label: string; value: string; sub: string; className?: string }) {
  return (
    <div className={`rounded-2xl border border-slate-200 bg-white p-4 break-inside-avoid ${className}`}>
      <p className="text-sm text-slate-600">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

function ChartCard({ title, sub, legend, children, className = "" }: { title: string; sub: string; legend: ReactNode; children: ReactNode; className?: string }) {
  return (
    <Card className={`min-w-0 break-inside-avoid ${className}`}>
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <p className="mt-0.5 text-sm text-slate-500">{sub}</p>
      <div className="mb-2 mt-3">{legend}</div>
      {children}
    </Card>
  );
}

function BreakdownCard({ title, rows, quarter }: { title: string; rows: ReturnType<typeof breakdown>; quarter: Quarter }) {
  return (
    <Card className="min-w-0 break-inside-avoid !p-0">
      <div className="p-5 pb-3 sm:p-6 sm:pb-3">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        <p className="mt-0.5 text-sm text-slate-500">{quarter.label}</p>
      </div>
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs text-slate-500">
          <tr>
            <th className="px-5 py-2 font-medium sm:px-6"> </th>
            <th className="px-2 py-2 text-right font-medium">Referrals</th>
            <th className="px-2 py-2 text-right font-medium">Assessed</th>
            <th className="px-5 py-2 text-right font-medium sm:px-6">Median wait</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((r) => (
            <tr key={r.group}>
              <td className="px-5 py-2 text-slate-800 sm:px-6">{r.group}</td>
              <td className="px-2 py-2 text-right tabular-nums">{r.referrals}</td>
              <td className="px-2 py-2 text-right tabular-nums">{r.assessed}</td>
              <td className="whitespace-nowrap px-5 py-2 text-right tabular-nums sm:px-6">{wk(r.medianWait)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
