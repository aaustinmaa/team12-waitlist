import { useState } from "react";
import { btn, Card, CardHeading } from "../../components/ui";
import { DEFAULT_GEMINI_MODEL } from "../../ingest/gemini";
import { CAN, ROLE_LABEL, STAFF, clinicSetup } from "../../platform/clinics";
import { useClinicId, usePlatform } from "../../platform/store";
import { HOSTED } from "../../platform/hosted";

export function SettingsPage() {
  const clinicId = useClinicId();
  const p = usePlatform();
  const setup = clinicSetup(clinicId)!;
  const isAdmin = !!p.staff && CAN.manageSettings(p.staff.role);
  const [key, setKey] = useState("");
  const [model, setModel] = useState(p.state.ai.geminiModel || DEFAULT_GEMINI_MODEL);
  const [confirmReset, setConfirmReset] = useState(false);

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Settings</h1>

      <Card className="mt-6">
        <CardHeading>Clinic</CardHeading>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-slate-500">Name</dt>
            <dd className="font-medium text-slate-900">{setup.info.name}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Families contact</dt>
            <dd className="font-medium text-slate-900">{setup.info.contact}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Address</dt>
            <dd className="font-medium text-slate-900">{setup.info.address}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Clinic system</dt>
            <dd className="font-medium text-slate-900">{setup.system}</dd>
          </div>
        </dl>
      </Card>

      <Card className="mt-6">
        <CardHeading>Team</CardHeading>
        <p className="mt-1 text-sm text-slate-600">Accounts are invite-only. Each person sees this clinic's data and nothing else.</p>
        <ul className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200 text-sm">
          {STAFF.filter((s) => s.clinicId === clinicId).map((s) => (
            <li key={s.email} className="flex flex-col px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between">
              <span className="font-medium text-slate-900">{s.name}</span>
              <span className="text-slate-600">
                {s.email} · {ROLE_LABEL[s.role]}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-slate-500">Admins import data and change settings. Intake staff work the waitlist. Managers see reports only.</p>
      </Card>

      <Card className="mt-6">
        <CardHeading>AI column matching (Gemini)</CardHeading>
        <p className="mt-1 text-sm text-slate-600">
          When an export's columns are new, AI reads a masked description of them (names, value types, a few examples with emails, phones and names removed) and proposes how they map. Staff confirm it. Rows are never sent.
        </p>
        <p className="mt-2 text-sm text-slate-600">
          Status:{" "}
          <strong className="text-slate-900">
            {HOSTED ? "on · the key is kept on the server (Supabase secret GEMINI_API_KEY); if it's missing, the matching rules are used" : p.state.ai.geminiKey ? `on · ${p.state.ai.geminiModel}` : "off · the matching rules are used instead"}
          </strong>
        </p>
        {HOSTED ? null : isAdmin ? (
          <div className="mt-4 space-y-3">
            <label className="block text-sm">
              <span className="font-medium text-slate-800">Gemini API key</span>
              <input
                type="password"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder={p.state.ai.geminiKey ? "A key is saved. Paste a new one to replace it." : "Paste a key from Google AI Studio"}
                autoComplete="off"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm outline-none focus:border-teal-500"
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-slate-800">Model</span>
              <input value={model} onChange={(e) => setModel(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm outline-none focus:border-teal-500" />
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => {
                  if (key.trim()) p.setAi({ geminiKey: key.trim(), geminiModel: model.trim() || DEFAULT_GEMINI_MODEL });
                  else p.setAi({ geminiModel: model.trim() || DEFAULT_GEMINI_MODEL });
                  setKey("");
                }}
                className={btn("primary")}
              >
                Save
              </button>
              {p.state.ai.geminiKey && (
                <button onClick={() => p.setAi({ geminiKey: "" })} className={btn("outline")}>
                  Remove key
                </button>
              )}
            </div>
            <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900">
              Prototype only: the key is kept in this browser. In the hosted version it lives on the server (a Supabase secret) and the browser never sees it. Google may use prompts sent with a free-tier key to improve its products, which is one more reason only masked
              column descriptions are sent.
            </p>
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-500">Only the clinic admin can change this.</p>
        )}
      </Card>

      {isAdmin && (
        <Card className="mt-6">
          <CardHeading>Demo data</CardHeading>
          <p className="mt-1 text-sm text-slate-600">Put every clinic back to the start: Maple Grove with its Nov 13 export, the other two clinics empty, no staff changes, empty logs. Sign-ins and the AI setting stay.</p>
          {confirmReset ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-sm text-slate-700">Reset all demo data?</span>
              <button
                onClick={() => {
                  p.resetDemo();
                  setConfirmReset(false);
                }}
                className={btn("dark")}
              >
                Yes, reset
              </button>
              <button onClick={() => setConfirmReset(false)} className={btn("outline")}>
                Cancel
              </button>
            </div>
          ) : (
            <button onClick={() => setConfirmReset(true)} className={btn("outline", "mt-3")}>
              Reset demo data
            </button>
          )}
        </Card>
      )}
    </div>
  );
}
