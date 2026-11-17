// Contact details a family gives for updates. The clinic's records are the
// starting point (shown masked); a family can replace either one with their
// own. Checks are deliberately simple: they catch typos, they don't prove the
// address works. A real service would send a code to confirm it first.

export type ContactField = "email" | "phone";
export type FamilyContact = Partial<Record<ContactField, string>>;

/** A cleaned-up email address, or null if it doesn't look like one. */
export function normalizeEmail(raw: string) {
  const v = raw.trim();
  return /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(v) && v.length <= 254 ? v : null;
}

/**
 * A North American mobile number written as 519-555-0123, or null. Accepts
 * spaces, dots, brackets, dashes and a leading +1 or 1.
 */
export function normalizePhone(raw: string) {
  if (!/^[\d\s().+-]+$/.test(raw.trim())) return null;
  let d = raw.replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("1")) d = d.slice(1);
  // Area code and exchange can't start with 0 or 1.
  if (!/^[2-9]\d{2}[2-9]\d{6}$/.test(d)) return null;
  return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
}

export function normalize(field: ContactField, raw: string) {
  return field === "email" ? normalizeEmail(raw) : normalizePhone(raw);
}

/** Where updates go: what the family entered, otherwise the clinic's (masked) record. */
export function contactDetails(onFile: { email: string; phone: string } | undefined, entered: FamilyContact | undefined) {
  return {
    email: { value: entered?.email ?? onFile?.email ?? "", entered: !!entered?.email },
    phone: { value: entered?.phone ?? onFile?.phone ?? "", entered: !!entered?.phone },
  };
}
