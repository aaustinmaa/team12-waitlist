import { NavLink, Outlet, useLocation } from "react-router";
import { FlaskConical, Hourglass, LayoutDashboard, Smartphone, Home } from "lucide-react";
import { useEffect } from "react";

const links = [
  { to: "/", label: "Demo home", short: "", icon: Home, end: true },
  { to: "/family/demo-001", label: "Family view", short: "Family", icon: Smartphone, match: "/family" },
  { to: "/staff", label: "Staff dashboard", short: "Staff", icon: LayoutDashboard },
];

export function AppShell() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2.5 sm:px-6">
          <NavLink to="/" className="flex shrink-0 items-center gap-2 font-semibold text-slate-900">
            <span className="grid size-8 place-items-center rounded-lg bg-teal-700 text-white">
              <Hourglass className="size-4" aria-hidden />
            </span>
            <span className="hidden sm:inline">Waitlist Prototype</span>
          </NavLink>
          <nav aria-label="Prototype sections" className="ml-auto flex items-center gap-1">
            {links.map(({ to, label, short, icon: Icon, end, match }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) => {
                  const active = isActive || (match && pathname.startsWith(match));
                  return `flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors ${
                    active ? "bg-teal-50 text-teal-800" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`;
                }}
              >
                <Icon className="size-4" aria-hidden />
                <span className="hidden md:inline">{label}</span>
                {short && <span className="md:hidden">{short}</span>}
                {!short && <span className="sr-only md:hidden">{label}</span>}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-4 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="flex items-center gap-1.5">
            <FlaskConical className="size-3.5" aria-hidden />
            Course prototype · CS 497 Team 12 (JJAMMY) · Fictional clinic, synthetic data only
          </p>
          <p>Estimates are simulated for the demo and are not medical advice.</p>
        </div>
      </footer>
    </div>
  );
}
