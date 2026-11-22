import { Link } from "react-router";
import { ChevronRight } from "lucide-react";
import { Card, Chip, type Tone } from "../../components/ui";
import { getFamilyReferral } from "../../lib/api";
import { useI18n } from "../../lib/i18n";
import { usePlatform } from "../../platform/store";
import { useFamilyText } from "./FamilyShell";

/** Every referral linked to the signed-in family's email or phone, across clinics. */
export function FamilyHome() {
  const p = usePlatform();
  const ft = useFamilyText();
  const { fmt } = useI18n();
  const items = p.familyReferrals().flatMap(({ clinicId, referralId }) => {
    const v = p.view(clinicId);
    const data = v && getFamilyReferral(v, referralId);
    return v && data ? [{ clinicId, v, data }] : [];
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{ft.homeTitle}</h1>
      <p className="mt-1 text-slate-600">{ft.homeLead}</p>
      {items.length === 0 ? (
        <Card className="mt-6">
          <p className="text-slate-700">{ft.none}</p>
        </Card>
      ) : (
        <ul className="mt-6 space-y-3">
          {items.map(({ clinicId, v, data }) => {
            const st = data.referral.status;
            const label = st === "assessment_booked" ? ft.booked : st === "on_hold" ? ft.onHold : ft.waiting;
            const tone: Tone = st === "assessment_booked" ? "green" : st === "on_hold" ? "amber" : "teal";
            const range = data.estimate.range_weeks;
            return (
              <li key={`${clinicId}/${data.referral.id}`}>
                <Link to={`/my/${clinicId}/${encodeURIComponent(data.referral.id)}`} className="block rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:border-teal-300 sm:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm text-slate-500">{v.info.name}</p>
                      <p className="font-semibold text-slate-900">{v.info.service}</p>
                      <p className="mt-0.5 font-mono text-xs text-slate-500">
                        {ft.ref} {data.referral.id}
                      </p>
                    </div>
                    <ChevronRight className="mt-1 size-5 shrink-0 text-slate-400 rtl:rotate-180" aria-hidden />
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Chip tone={tone}>{label}</Chip>
                    <span className="text-sm font-medium text-slate-800">
                      {st === "assessment_booked" && data.referral.appointment_on
                        ? fmt.long(data.referral.appointment_on)
                        : range
                          ? ft.weeks(range.lower, range.upper)
                          : ft.noEstimate}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">{ft.dataAsOf(fmt.long(v.asOf))}</p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
