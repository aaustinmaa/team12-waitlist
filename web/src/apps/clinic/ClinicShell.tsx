import { useEffect, useState, type FormEvent } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router";
import { ShieldCheck } from "lucide-react";
import { Brand, DemoFooter, ThemeButton } from "../../components/ThemeButton";
import { btn, Card, Chip } from "../../components/ui";
import { CAN, DEMO_STAFF_PASSWORD, ROLE_LABEL, STAFF, clinicSetup } from "../../platform/clinics";
import { ClinicScope, usePlatform } from "../../platform/store";
import { HOSTED } from "../../platform/hosted";

const NAV = [
  { to: "/waitlist", label: "Waitlist", show: () => true },
  { to: "/reports", label: "Reports", show: () => true },
  { to: "/data", label: "Data", show: () => true },
  { to: "/model", label: "Estimates", show: () => true },
  { to: "/settings", label: "Settings", show: () => true },
  { to: "/audit", label: "Audit log", show: CAN.manageSettings },
];

/** The clinic portal: staff accounts only, each clinic sees only its own data. */
export function ClinicShell() {
  const { pathname } = useLocation();
  const p = usePlatform();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  const staff = p.staff;
  const setup = staff ? clinicSetup(staff.clinicId) : null;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur print:hidden">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2.5 sm:px-6">
          <Link to="/" className="shrink-0">
            <Brand sub={setup ? setup.info.name : "Clinic portal"} />
          </Link>
          <div className="ms-auto flex items-center gap-1">
            {staff && (
              <span className="hidden items-center gap-2 text-sm text-slate-600 md:flex">
                <Chip tone="rose" icon={<ShieldCheck className="size-3.5" aria-hidden />}>
                  Staff only
                </Chip>
                {staff.name} · {ROLE_LABEL[staff.role]}
              </span>
            )}
            <ThemeButton />
            {staff && (
              <button type="button" onClick={p.signOutStaff} className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100">
                Sign out
              </button>
            )}
          </div>
        </div>
        {staff && (
          <nav aria-label="Clinic portal" className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 sm:px-6">
            {NAV.filter((n) => n.show(staff.role)).map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                className={({ isActive }) =>
                  `-mb-px whitespace-nowrap border-b-2 px-3 pb-2 pt-1 text-sm font-medium ${isActive ? "border-slate-900 text-slate-900" : "border-transparent text-slate-500 hover:text-slate-800"}`
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>
        )}
      </header>
      <main className="flex-1">
        {p.state.sync?.error && (
          <p className="mx-auto mt-4 max-w-7xl rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800 sm:px-6">Couldn't reach the server: {p.state.sync.error}</p>
        )}
        {HOSTED && p.state.sync?.loading ? (
          <p className="px-4 py-16 text-center text-slate-500">Loading…</p>
        ) : staff ? (
          <ClinicScope clinicId={staff.clinicId}>
            <Outlet />
          </ClinicScope>
        ) : (
          <ClinicSignIn />
        )}
      </main>
      <DemoFooter />
    </div>
  );
}

function ClinicSignIn() {
  const p = usePlatform();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(await p.signInStaff(email, password));
    setBusy(false);
  };
  return (
    <div className="mx-auto max-w-md px-4 py-10 sm:py-16">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">Clinic staff sign in</h1>
      <p className="mt-2 text-slate-600">For clinic staff only. Accounts are created by your clinic's admin.</p>
      <Card className="mt-6">
        <form onSubmit={submit} className="space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-slate-800">Work email</span>
            <input value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" type="email" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-teal-500" />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-800">Password</span>
            <input value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" type="password" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-teal-500" />
          </label>
          {error && <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
          <button type="submit" disabled={busy} className={btn("primary", "w-full py-2.5")}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
          <p className="text-xs text-slate-500">The hosted version adds a second step (an authenticator app code) and can use your clinic's Microsoft 365 sign-in.</p>
        </form>
      </Card>
      <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white/60 p-4 text-sm">
        <p className="font-medium text-slate-600">
          Demo accounts · password <span className="font-mono">{DEMO_STAFF_PASSWORD}</span>
        </p>
        <ul className="mt-2 space-y-1.5">
          {STAFF.map((s) => (
            <li key={s.email}>
              <button
                type="button"
                onClick={() => {
                  setEmail(s.email);
                  setPassword(DEMO_STAFF_PASSWORD);
                }}
                className="text-left"
              >
                <span className="font-mono font-medium text-teal-700 underline underline-offset-2">{s.email}</span>
                <span className="block text-xs text-slate-500">
                  {clinicSetup(s.clinicId)!.info.name} · {ROLE_LABEL[s.role]}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** Shown on a clinic page when the clinic has not imported any data yet. */
export function NoDataYet() {
  return (
    <div className="mx-auto max-w-xl px-4 py-16 text-center">
      <h1 className="text-2xl font-semibold text-slate-900">No referral data yet</h1>
      <p className="mt-2 text-slate-600">This clinic hasn't imported an export from its clinic system. Start on the Data page; it takes a couple of minutes.</p>
      <Link to="/data" className={btn("primary", "mt-6")}>
        Go to Data
      </Link>
    </div>
  );
}
