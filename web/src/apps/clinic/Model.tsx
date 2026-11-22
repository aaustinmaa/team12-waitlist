import { CheckCircle2, TriangleAlert } from "lucide-react";
import { Card, CardHeading } from "../../components/ui";
import { judge } from "../../engine/backtest";
import { GATE } from "../../engine/model";
import { PRIORITIES } from "../../engine/types";
import type { ClinicView } from "../../lib/api";
import { fmtLong } from "../../lib/dates";
import { PRIORITY_LABEL } from "../../components/ui";
import { useClinicView } from "../../platform/store";
import { NoDataYet } from "./ClinicShell";

const pct = (x: number | null) => (x === null ? "–" : `${Math.round(x * 100)}%`);

/** What the estimator learned from this clinic's data, and how well it did on the past. */
export function ModelPage() {
  const v = useClinicView();
  if (!v) return <NoDataYet />;
  return <Body v={v} />;
}

function Body({ v }: { v: ClinicView }) {
  const m = v.model;
  const p = m.params;
  const bt = m.backtest;
  const counts = { inside: 0, earlier: 0, later: 0 };
  for (const c of bt.cases) {
    const j = judge(c, bt.calibration);
    if (j) counts[j]++;
  }
  const maxT = Math.max(1, ...p.weeklyThroughput);
  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">How the estimates are made</h1>
      <p className="mt-1 max-w-3xl text-slate-600">
        Everything on this page is learned from {v.info.name}'s own data as of {fmtLong(v.asOf)}. Nothing is typed in by hand, so a small clinic and a large one get different numbers.
      </p>

      <Card className={`mt-6 ${m.gate.familyVisible ? "" : "border-amber-300"}`}>
        <div className="flex items-start gap-3">
          {m.gate.familyVisible ? <CheckCircle2 className="mt-0.5 size-6 shrink-0 text-emerald-600" aria-hidden /> : <TriangleAlert className="mt-0.5 size-6 shrink-0 text-amber-600" aria-hidden />}
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{m.gate.familyVisible ? "Families can see their wait ranges" : "Families are not shown ranges yet"}</h2>
            <p className="mt-1 text-sm text-slate-600">
              A range is shown to families only when the clinic has at least {GATE.minAssessed} recent first assessments, at least {GATE.minResolved} past referrals to check against, at least {GATE.minCoverage * 100}% of past families inside their range, and the range didn't
              need widening more than {GATE.maxK}×.
            </p>
            {!m.gate.familyVisible && (
              <ul className="mt-2 list-disc ps-5 text-sm text-amber-900">
                {m.gate.failed.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </Card>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeading>1 · What the clinic actually did</CardHeading>
          <p className="mt-1 text-xs text-slate-500">Last {p.windowWeeks} weeks</p>
          <dl className="mt-3 space-y-2 text-sm">
            <Row k="First assessments a week" v={`${p.meanThroughput.toFixed(1)} on average`} />
            <Row k="Join ahead of a standard referral" v={`${p.aheadRate.standard.toFixed(2)} a week (urgent + high)`} />
            <Row k="Join ahead of a high-priority referral" v={`${p.aheadRate.high.toFixed(2)} a week (urgent)`} />
            <Row k="Become ready again (intake done, hold over)" v={`${Math.round(p.joinWeekly * 100)}% a week`} />
            <Row k="Leave the list without an assessment" v={`${(p.withdrawWeekly * 100).toFixed(2)}% a week`} />
            <Row k="Typical time to complete intake" v={p.intakeMedianDays === null ? "–" : `${p.intakeMedianDays} days`} />
          </dl>
          <div className="mt-4 flex h-16 items-end gap-px" aria-label="First assessments each week">
            {p.weeklyThroughput.map((t, i) => (
              <span key={i} className="flex-1 rounded-t bg-teal-600/70" style={{ height: `${(t / maxT) * 100}%` }} title={`${t}`} />
            ))}
          </div>
          <p className="mt-1 text-xs text-slate-500">First assessments each week, oldest left. The simulation replays these real weeks in shuffled blocks.</p>
        </Card>

        <Card>
          <CardHeading>2 · Checked against the past</CardHeading>
          <p className="mt-1 text-xs text-slate-500">Every referral that became ready in the last year, estimated with only what was known that day</p>
          <dl className="mt-3 space-y-2 text-sm">
            <Row k="Past referrals checked" v={`${bt.resolved}`} />
            <Row k="Inside the range, before calibration" v={pct(bt.coverageRaw)} />
            <Row k="Speed correction" v={`× ${bt.calibration.speed}`} />
            <Row k="Range widening" v={`× ${bt.calibration.k}`} />
            <Row k="Inside the range, after calibration" v={pct(bt.coverage)} strong />
            <Row k="Typical range width" v={bt.medianWidth === null ? "–" : `${bt.medianWidth} weeks`} />
          </dl>
          <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-slate-100">
            {(["earlier", "inside", "later"] as const).map((k) => (
              <span key={k} className={k === "inside" ? "bg-emerald-500" : k === "earlier" ? "bg-sky-400" : "bg-amber-500"} style={{ width: `${(counts[k] / Math.max(1, bt.resolved)) * 100}%` }} />
            ))}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {counts.earlier} seen earlier than the range · {counts.inside} inside · {counts.later} later. Calibration is chosen on these same referrals, so treat the figure as in-sample.
          </p>
        </Card>

        <Card>
          <CardHeading>3 · Second opinion</CardHeading>
          <p className="mt-1 text-xs text-slate-500">Kaplan–Meier on the last two years: time from intake complete to first assessment; people still waiting are counted, not dropped</p>
          <table className="mt-3 w-full text-left text-sm">
            <thead className="text-xs text-slate-500">
              <tr>
                <th className="py-1 font-medium">Priority</th>
                <th className="py-1 font-medium">History (10–90%)</th>
                <th className="py-1 font-medium">New referral today</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {[...PRIORITIES].reverse().map((pr) => {
                const s = m.survival[pr];
                const n = v.newReferral[pr];
                return (
                  <tr key={pr}>
                    <td className="py-1.5 pr-3">{PRIORITY_LABEL[pr]}</td>
                    <td className="py-1.5 pr-3 tabular-nums">{s.subjects < 10 ? "too few" : `${s.p10 ?? "–"}–${s.p90 ?? "> 2 yr"} wk`}</td>
                    <td className="py-1.5 tabular-nums">{n ? `${n.lower}–${n.upper} wk` : "too long"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-slate-500">
            If today's estimate is much longer or shorter than the history, the line has changed speed recently (new staff, more referrals). That's expected; the simulation uses today's line, the history doesn't.
          </p>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeading>How it works, in plain words</CardHeading>
        <ol className="mt-3 list-decimal space-y-2 ps-5 text-sm text-slate-700">
          <li>Each night the clinic's export is imported. We rebuild the line: who is ready, who is booked, on hold or still in intake, in the order the clinic sees them (priority, then referral date).</li>
          <li>For each family we replay the coming weeks hundreds of times. Each run draws real recent weeks from this clinic (busy and slow ones), lets higher-priority referrals and people finishing intake join ahead, and lets some families leave.</li>
          <li>The 10th–90th percentile of the runs is the raw range. The back-test above corrects its speed and width so about 8 in 10 past families would have been inside.</li>
          <li>Staff can try a capacity scenario on the Waitlist page. It adds to the real weeks; it never replaces them.</li>
          <li>The numbers are computed; the decisions aren't. Staff set priorities (with a reason, logged) and book appointments. Families see a range, never a promised date.</li>
        </ol>
      </Card>
    </div>
  );
}

function Row({ k, v, strong = false }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-slate-600">{k}</dt>
      <dd className={`text-right tabular-nums ${strong ? "font-bold text-slate-900" : "font-medium text-slate-800"}`}>{v}</dd>
    </div>
  );
}

