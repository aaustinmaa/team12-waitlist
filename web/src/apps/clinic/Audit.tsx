import { useState } from "react";
import { Download, ScrollText, Search } from "lucide-react";
import { Card, EmptyState } from "../../components/ui";
import { downloadCsv, toCsv } from "../../lib/csv";
import { btn } from "../../components/ui";
import { useClinicId, usePlatform } from "../../platform/store";

/** Who did what, when: sign-ins, views of a family's page, changes, imports. */
export function AuditPage() {
  const clinicId = useClinicId();
  const p = usePlatform();
  const [q, setQ] = useState("");
  const entries = p.state.audit.filter((e) => e.clinicId === clinicId || (e.clinicId === null && e.action.startsWith("Family")));
  const shown = entries.filter((e) => !q || `${e.actor} ${e.action} ${e.detail}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Audit log</h1>
          <p className="mt-1 text-slate-600">Every sign-in, every view of a family's page, every change and import. Kept so the clinic can answer "who looked at or changed this referral".</p>
        </div>
        <button
          onClick={() => downloadCsv(`audit-log-${clinicId}.csv`, toCsv(["time", "who", "action", "detail", "referral_id"], shown.map((e) => [e.at, e.actor, e.action, e.detail, e.referral_id])))}
          disabled={shown.length === 0}
          className={btn("outline")}
        >
          <Download className="size-4" aria-hidden /> Download
        </button>
      </div>
      <label className="relative mt-4 block sm:w-72">
        <span className="sr-only">Search the audit log</span>
        <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" className="w-full rounded-lg border border-slate-300 bg-white py-2 pe-3 ps-9 text-sm outline-none focus:border-teal-500" />
      </label>
      <Card className="mt-4 !p-0">
        {shown.length === 0 ? (
          <EmptyState icon={ScrollText} title={q ? "No entries match" : "Nothing logged yet"}>
            {q ? `Nothing in the log mentions "${q}".` : "Sign-ins, views of a family's page, changes and imports will appear here."}
          </EmptyState>
        ) : (
          <ul className="divide-y divide-slate-100 text-sm">
            {shown.slice(0, 300).map((e) => (
              <li key={e.id} className="flex flex-col gap-1 px-4 py-2.5 transition-colors duration-150 hover:bg-teal-50/50 sm:flex-row sm:gap-4">
                <span className="w-40 shrink-0 text-xs text-slate-500">{new Date(e.at).toLocaleString("en-CA", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", second: "2-digit" })}</span>
                <span className="w-56 shrink-0 truncate text-slate-700">{e.actor}</span>
                <span className="flex-1 text-slate-900">
                  <span className="font-medium">{e.action}</span> · {e.detail}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
