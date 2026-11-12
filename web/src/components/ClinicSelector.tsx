import { useNavigate } from "react-router";
import { CLINICS, DEFAULT_CLINIC_ID } from "../../../backend/api/network";

export function ClinicSelector({ clinicId = "" }: { clinicId?: string }) {
  const navigate = useNavigate();
  return (
    <label className="block text-sm font-medium text-slate-700">
      Demo clinic
      <select
        value={clinicId}
        onChange={(event) => navigate(event.target.value === DEFAULT_CLINIC_ID ? "/staff" : `/staff/${event.target.value}`)}
        className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900"
      >
        {!clinicId && <option value="" disabled>Choose a staff dashboard</option>}
        {Object.entries(CLINICS).map(([id, { clinic }]) => <option key={id} value={id}>{clinic.name}</option>)}
      </select>
    </label>
  );
}
