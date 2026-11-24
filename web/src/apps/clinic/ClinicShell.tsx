import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router";
import { ArrowRight, BarChart3, ChevronRight, Database, Eye, EyeOff, Gauge, ListOrdered, LogOut, ScrollText, Settings, ShieldCheck, type LucideIcon } from "lucide-react";
import { Brand, DemoFooter, ThemeButton } from "../../components/ThemeButton";
import { btn, Card, EmptyState, PageSkeleton, SkipLink, useScrolled } from "../../components/ui";
import { CAN, DEMO_STAFF_PASSWORD, ROLE_LABEL, STAFF, clinicSetup, type Role } from "../../platform/clinics";
import { ClinicScope, usePlatform } from "../../platform/store";
import { HOSTED } from "../../platform/hosted";

/** The portal's sections. `hint` is what a pointer over the item (or keyboard focus) reveals. */
const NAV: { to: string; label: string; icon: LucideIcon; hint: string; show: (r: Role) => boolean }[] = [
  { to: "/waitlist", label: "Waitlist", icon: ListOrdered, hint: "Every referral in line: status, priority, and what the family is shown.", show: () => true },
  { to: "/reports", label: "Reports", icon: BarChart3, hint: "Quarterly numbers and charts, ready to download for a manager.", show: () => true },
  { to: "/data", label: "Data", icon: Database, hint: "Bring in exports from your clinic system and review past imports.", show: () => true },
  { to: "/model", label: "Estimates", icon: Gauge, hint: "How wait ranges are made, and how well they held against the past.", show: () => true },
  { to: "/settings", label: "Settings", icon: Settings, hint: "Clinic details, your team, and AI column matching.", show: () => true },
  { to: "/audit", label: "Audit log", icon: ScrollText, hint: "Who viewed or changed what, and when.", show: CAN.manageSettings },
];

const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

/** The clinic portal: staff accounts only, each clinic sees only its own data. */
export function ClinicShell() {
  const { pathname } = useLocation();
  const p = usePlatform();
  const staff = p.staff;
  const setup = staff ? clinicSetup(staff.clinicId) : null;
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrolled = useScrolled(scrollRef, !!staff);
  useEffect(() => {
    scrollRef.current?.scrollTo(0, 0);
    window.scrollTo(0, 0);
  }, [pathname]);
  const nav = staff ? NAV.filter((n) => n.show(staff.role)) : [];
  const current = nav.find((n) => pathname.startsWith(n.to));

  const body = (
    <>
      {p.state.sync?.error && (
        <p className="mx-auto mt-4 max-w-7xl rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800 sm:px-6">Couldn't reach the server: {p.state.sync.error}</p>
      )}
      {HOSTED && p.state.sync?.loading ? (
        <PageSkeleton />
      ) : staff ? (
        <ClinicScope clinicId={staff.clinicId}>
          {/* Keyed by page so each new page fades in instead of popping. */}
          <div key={pathname} className="animate-page-in">
            <Outlet />
          </div>
        </ClinicScope>
      ) : (
        <div className="animate-page-in">
          <ClinicSignIn />
        </div>
      )}
    </>
  );

  // Signed out: fixed top header so vertical rubber-band bounce moves only the grey content underneath.
  if (!staff || !setup) {
    return (
      <div className="flex min-h-dvh flex-col pt-16 print:pt-0">
        <SkipLink />
        <header
          className={`fixed inset-x-0 top-0 z-30 border-b border-slate-200 backdrop-blur-md transition-[box-shadow,background-color] duration-200 print:hidden ${
            scrolled ? "bg-white/95 shadow-xs" : "bg-white/90"
          }`}
        >
          <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6">
            <Link to="/" className="shrink-0">
              <Brand sub="Clinic portal" />
            </Link>
            <div className="ms-auto">
              <ThemeButton />
            </div>
          </div>
        </header>
        <main id="main-content" tabIndex={-1} className="flex-1 outline-none">
          {body}
        </main>
        <DemoFooter />
      </div>
    );
  }

  return (
    <div className="flex h-dvh overflow-hidden print:h-auto print:overflow-visible">
      <SkipLink />
      {/* Desktop: locked sidebar frame; vertical bounce happens inside the grey content pane only. */}
      <aside className="z-40 hidden h-full w-64 shrink-0 flex-col bg-nav text-nav-fg lg:flex print:hidden">
        <Link to="/waitlist" className="block px-5 pb-5 pt-6">
          <Brand sub="Clinic portal" onDark />
        </Link>
        <div className="mx-3 rounded-xl bg-nav-raised px-3 py-2.5 ring-1 ring-inset ring-white/[0.06]">
          <p className="truncate text-sm font-semibold" title={setup.info.name}>
            {setup.info.name}
          </p>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-nav-fg/65">
            <ShieldCheck className="size-3.5 shrink-0 text-nav-accent" aria-hidden />
            <span className="truncate">Staff only · {ROLE_LABEL[staff.role]}</span>
          </p>
        </div>

        <nav aria-label="Clinic portal" className="mt-5 flex-1 px-3">
          <p className="px-3 pb-2 text-[0.6875rem] font-semibold uppercase tracking-wider text-nav-fg/45">Workspace</p>
          <ul className="space-y-0.5">
            {nav.map((n) => (
              <li key={n.to}>
                <SideLink item={n} />
              </li>
            ))}
          </ul>
        </nav>

        <div className="border-t border-nav-fg/10 p-3">
          <div className="flex items-center gap-3 rounded-xl px-2 py-2">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-nav-accent/20 text-sm font-semibold text-nav-accent" aria-hidden>
              {initials(staff.name)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{staff.name}</p>
              <p className="truncate text-xs text-nav-fg/60">{ROLE_LABEL[staff.role]}</p>
            </div>
            <button
              type="button"
              onClick={p.signOutStaff}
              title="Sign out"
              aria-label="Sign out"
              className="grid size-8 place-items-center rounded-lg text-nav-fg/60 hover:bg-nav-fg/10 hover:text-nav-fg"
            >
              <LogOut className="size-4" aria-hidden />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden print:h-auto print:overflow-visible">
        <header
          className={`z-30 shrink-0 border-b border-slate-200 backdrop-blur-md transition-[box-shadow,background-color] duration-200 print:hidden ${
            scrolled ? "bg-white/95 shadow-xs" : "bg-white/90"
          }`}
        >
          {/* Desktop: where you are. */}
          <div className="hidden h-16 items-center gap-3 px-6 lg:flex">
            <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-sm">
              <span className="truncate text-slate-500">{setup.info.name}</span>
              {current && (
                <>
                  <ChevronRight className="size-4 shrink-0 text-slate-400" aria-hidden />
                  <span className="flex items-center gap-1.5 font-medium text-slate-900">
                    <current.icon className="size-4 text-teal-700" aria-hidden />
                    {current.label}
                  </span>
                </>
              )}
            </nav>
            <div className="ms-auto flex items-center gap-2">
              <ThemeButton />
            </div>
          </div>

          {/* Phone and tablet: brand row plus a scrolling row of sections. */}
          <div className="lg:hidden">
            <div className="flex h-16 items-center gap-2 px-4 sm:px-6">
              <Link to="/waitlist" className="min-w-0 shrink">
                <Brand sub={`${setup.info.name} · ${ROLE_LABEL[staff.role]}`} />
              </Link>
              <div className="ms-auto flex items-center gap-1">
                <ThemeButton />
                <button type="button" onClick={p.signOutStaff} className="whitespace-nowrap rounded-lg px-2.5 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900">
                  Sign out
                </button>
              </div>
            </div>
            <nav aria-label="Clinic portal" className="no-scrollbar flex gap-1 overflow-x-auto overscroll-x-contain px-3 pb-2.5 sm:px-5">
              {nav.map((n) => (
                <NavLink
                  key={n.to}
                  to={n.to}
                  title={n.hint}
                  className={({ isActive }) =>
                    `flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium ${
                      isActive ? "bg-teal-50 text-teal-800 ring-1 ring-inset ring-teal-200" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    }`
                  }
                >
                  <n.icon className="size-4" aria-hidden />
                  {n.label}
                </NavLink>
              ))}
            </nav>
          </div>
        </header>
        <div ref={scrollRef} className="flex flex-1 flex-col overflow-y-auto overscroll-x-none overscroll-y-contain print:overflow-visible">
          <main id="main-content" tabIndex={-1} className="flex-1 outline-none">
            {body}
          </main>
          <DemoFooter />
        </div>
      </div>
    </div>
  );
}

/**
 * One sidebar section. The active one gets a lit bar and icon; hovering or
 * focusing any of them slides out a card saying what that section is for.
 */
function SideLink({ item }: { item: (typeof NAV)[number] }) {
  const Icon = item.icon;
  const tipId = `nav-tip-${item.to.slice(1)}`;
  return (
    <NavLink
      to={item.to}
      aria-describedby={tipId}
      className={({ isActive }) =>
        `group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium outline-offset-0 ${
          isActive ? "bg-nav-fg/[0.12] text-nav-fg" : "text-nav-fg/70 hover:bg-nav-fg/[0.07] hover:text-nav-fg"
        }`
      }
    >
      {({ isActive }) => (
        <>
          <span
            className={`absolute inset-y-2 start-0 w-[3px] rounded-full bg-nav-accent transition-opacity duration-200 ${isActive ? "opacity-100" : "opacity-0"}`}
            aria-hidden
          />
          <Icon
            className={`size-[1.125rem] shrink-0 transition-transform duration-200 group-hover:scale-110 ${isActive ? "text-nav-accent" : "text-nav-fg/60 group-hover:text-nav-fg"}`}
            aria-hidden
          />
          <span className="flex-1">{item.label}</span>
          <ChevronRight
            className={`size-4 shrink-0 transition-[opacity,translate] duration-200 ${isActive ? "opacity-60" : "-translate-x-1 opacity-0 group-hover:translate-x-0 group-hover:opacity-60"}`}
            aria-hidden
          />
          <span
            id={tipId}
            role="tooltip"
            className="pointer-events-none invisible absolute start-full top-1/2 z-50 ms-3 w-64 -translate-y-1/2 translate-x-1 rounded-xl bg-white p-3 text-start opacity-0 shadow-xl ring-1 ring-slate-200 transition-[opacity,translate,visibility] duration-150 group-hover:visible group-hover:translate-x-0 group-hover:opacity-100 group-hover:delay-150 group-focus-visible:visible group-focus-visible:translate-x-0 group-focus-visible:opacity-100 group-focus-visible:delay-0"
          >
            <span className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Icon className="size-4 text-teal-700" aria-hidden />
              {item.label}
            </span>
            <span className="mt-1 block text-xs font-normal leading-relaxed text-slate-600">{item.hint}</span>
          </span>
        </>
      )}
    </NavLink>
  );
}

function ClinicSignIn() {
  const p = usePlatform();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const signInWith = async (em: string, pw: string) => {
    setBusy(true);
    setError(null);
    const err = await p.signInStaff(em, pw);
    setError(err);
    setBusy(false);
  };
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    await signInWith(email, password);
  };
  return (
    <div className="mx-auto max-w-md px-4 py-10 sm:py-16">
      <span className="mb-5 grid size-12 place-items-center rounded-2xl bg-teal-50 text-teal-700 ring-1 ring-teal-100" aria-hidden>
        <ShieldCheck className="size-6" />
      </span>
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">Clinic staff sign in</h1>
      <p className="mt-2 text-slate-600">For clinic staff only. Accounts are created by your clinic's admin.</p>
      <Card className="mt-6">
        <form onSubmit={submit} className="space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-slate-800">Work email</span>
            <input
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (error) setError(null);
              }}
              autoComplete="username"
              type="email"
              placeholder="name@clinic.example"
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none focus:border-teal-500"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-800">Password</span>
            <span className="relative mt-1 block">
              <input
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError(null);
                }}
                autoComplete="current-password"
                type={showPw ? "text" : "password"}
                className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pe-10 ps-3 text-slate-900 outline-none focus:border-teal-500"
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                aria-label={showPw ? "Hide password" : "Show password"}
                className="absolute end-1.5 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              >
                {showPw ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
              </button>
            </span>
          </label>
          {error && (
            <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800 ring-1 ring-inset ring-rose-200">
              {error}
            </p>
          )}
          <button type="submit" disabled={busy || !email.trim() || !password} className={btn("primary", "w-full py-2.5")}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
          <p className="text-xs text-slate-500">The hosted version adds a second step (an authenticator app code) and can use your clinic's Microsoft 365 sign-in.</p>
        </form>
      </Card>
      <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white/60 p-4 text-sm">
        <p className="font-medium text-slate-600">
          Demo accounts · click any row to sign in <span className="font-normal text-slate-500">(password <span className="font-mono">{DEMO_STAFF_PASSWORD}</span>)</span>
        </p>
        <ul className="mt-2.5 space-y-1">
          {STAFF.map((s) => (
            <li key={s.email}>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setEmail(s.email);
                  setPassword(DEMO_STAFF_PASSWORD);
                  void signInWith(s.email, DEMO_STAFF_PASSWORD);
                }}
                className="group flex w-full items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-left hover:bg-slate-100 disabled:opacity-60"
              >
                <span className="min-w-0">
                  <span className="block truncate font-mono font-medium text-teal-700 group-hover:underline group-hover:underline-offset-2">{s.email}</span>
                  <span className="block text-xs text-slate-500">
                    {clinicSetup(s.clinicId)!.info.name} · {ROLE_LABEL[s.role]}
                  </span>
                </span>
                <ArrowRight className="size-4 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:text-teal-700" aria-hidden />
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
    <div className="mx-auto max-w-xl px-4 py-12">
      <Card>
        <h1 className="sr-only">No referral data yet</h1>
        <EmptyState
          icon={Database}
          title="No referral data yet"
          action={
            <Link to="/data" className={btn("primary")}>
              <Database className="size-4" aria-hidden /> Go to Data
            </Link>
          }
        >
          This clinic hasn't imported an export from its clinic system. Start on the Data page; it takes a couple of minutes.
        </EmptyState>
      </Card>
    </div>
  );
}
