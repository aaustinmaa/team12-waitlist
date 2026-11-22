// The clinic working state as the family and staff components use it, for the
// clinic in scope (see platform/store.tsx). Kept as a thin layer so the
// components don't need to know where the state is stored.

import { usePlatform, useClinicId } from "../platform/store";

export function useDemo() {
  const p = usePlatform();
  const clinicId = useClinicId();
  const ops = p.ops(clinicId);
  return {
    ...ops,
    state: { ...ops.state, toursSeen: p.state.toursSeen },
    markTourSeen: p.markTourSeen,
  };
}
