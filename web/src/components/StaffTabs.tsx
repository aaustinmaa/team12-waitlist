import { NavLink } from "react-router";

/** Switches between the two staff pages. */
export function StaffTabs() {
  const tab = ({ isActive }: { isActive: boolean }) =>
    `-mb-px border-b-2 px-1 pb-2 text-sm font-medium ${
      isActive ? "border-slate-900 text-slate-900" : "border-transparent text-slate-500 hover:text-slate-800"
    }`;
  return (
    <nav aria-label="Staff pages" className="mb-5 flex gap-5 border-b border-slate-200 print:hidden">
      <NavLink to="/staff" end className={tab}>
        Waitlist
      </NavLink>
      <NavLink to="/staff/reports" className={tab}>
        Reports
      </NavLink>
    </nav>
  );
}
