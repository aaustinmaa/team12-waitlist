import { ExternalLink, Library, Users } from "lucide-react";
import { useI18n, type LangCode } from "../../lib/i18n";
import type { Portal } from "../../lib/types";
import { Card, CardHeading } from "../ui";

// Real Ontario resources, checked on 2026-11-16. `fr` is the French page where one exists.
const ONLINE = [
  {
    key: "earlyon",
    url: "https://www.ontario.ca/page/find-earlyon-child-and-family-centre",
    fr: "https://www.ontario.ca/fr/page/trouver-un-centre-pour-lenfant-et-la-famille-y-va",
  },
  { key: "hanen", url: "https://www.hanen.org/information-tips/tips" },
  {
    key: "program",
    url: "https://www.ontario.ca/page/preschool-speech-and-language-program",
    fr: "https://www.ontario.ca/fr/page/programme-de-services-de-reeducation-de-la-parole-et-du-langage-pour-les-enfants-dage-prescolaire",
  },
  { key: "o211", url: "https://211ontario.ca/" },
] as const;

/** Says "in English" after a link when the family reads another language and the site has no version in it. */
function useEnglishOnly() {
  const { t, lang } = useI18n();
  return (hasFrench: boolean) => (lang === "en" || (lang === "fr" && hasFrench) ? null : t.wait.englishOnly);
}

/**
 * A link to another site. "row" is a plain line in a list, for the narrow
 * side column; "box" is a bordered tile, for the wide main column.
 */
function OutLink({
  href,
  title,
  note,
  englishOnly,
  variant = "box",
}: {
  href: string;
  title: string;
  note: string;
  englishOnly: string | null;
  variant?: "box" | "row";
}) {
  const { t } = useI18n();
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`group flex h-full items-start gap-3 ${
        variant === "box" ? "rounded-xl border border-slate-200 px-3 py-2.5 hover:border-teal-300 hover:bg-teal-50" : "py-2.5"
      }`}
    >
      <span className="min-w-0 flex-1">
        <span className="block font-medium text-teal-800 underline decoration-teal-300 underline-offset-2 group-hover:decoration-teal-700">{title}</span>
        <span className="block text-sm text-slate-500">
          {note}
          {englishOnly && <> ({englishOnly})</>}
        </span>
      </span>
      <ExternalLink className="mt-1 size-4 shrink-0 text-teal-700" aria-hidden />
      <span className="sr-only">({t.page.newTab})</span>
    </a>
  );
}

const pick = (lang: LangCode, r: { url: string; fr?: string }) => (lang === "fr" && r.fr ? r.fr : r.url);

/** Sized for the side column: plain lists rather than tiles, so it stays short. */
export function WhileYouWait({ id }: { id?: string }) {
  const { t, lang } = useI18n();
  const englishOnly = useEnglishOnly();
  const local = [
    { icon: Library, ...t.wait.playTalk },
    { icon: Users, ...t.wait.coffee },
  ];
  return (
    <Card id={id} tour="wait" className="scroll-mt-20">
      <CardHeading id={id ? `${id}-heading` : undefined}>{t.wait.heading}</CardHeading>
      <p className="mt-2 text-sm text-slate-600">{t.wait.intro}</p>

      <h3 className="mt-4 text-xs font-medium text-slate-500">{t.wait.onlineTitle}</h3>
      <ul className="mt-1 divide-y divide-slate-100">
        {ONLINE.map((r) => (
          <li key={r.key}>
            <OutLink variant="row" href={pick(lang, r)} title={t.wait[r.key].title} note={t.wait[r.key].note} englishOnly={englishOnly("fr" in r)} />
          </li>
        ))}
      </ul>

      <h3 className="mt-3 text-xs font-medium text-slate-500">{t.wait.nearTitle}</h3>
      <ul className="mt-1 divide-y divide-slate-100">
        {local.map(({ icon: Icon, title, where }) => (
          <li key={title} className="flex gap-3 py-2.5">
            <Icon className="mt-0.5 size-4 shrink-0 text-slate-500" aria-hidden />
            <div className="min-w-0">
              <p className="font-medium text-slate-900">{title}</p>
              <p className="text-sm text-slate-500">{where}</p>
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-slate-400">{t.wait.example}</p>
    </Card>
  );
}

/** Links out to other patient portals the clinic's families commonly use. Nothing is shared with them. */
export function PortalsCard({ portals }: { portals: Portal[] }) {
  const { t } = useI18n();
  const englishOnly = useEnglishOnly();
  if (portals.length === 0) return null;
  return (
    <Card className="@container">
      <CardHeading>{t.portals.heading}</CardHeading>
      <p className="mt-2 text-sm text-slate-600">{t.portals.intro}</p>
      <ul className="mt-3 grid gap-2 @xl:grid-cols-3">
        {portals.map((p) => (
          <li key={p.id}>
            <OutLink href={p.url} title={p.name} note={t.portals.note[p.id] ?? ""} englishOnly={englishOnly(false)} />
          </li>
        ))}
      </ul>
    </Card>
  );
}
