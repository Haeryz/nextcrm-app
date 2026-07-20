export const MEKTEK_TECHNICIAN_ROLES = ["MECHANIC", "HELPER", "OJT"] as const;

export type MektekTechnicianRole = (typeof MEKTEK_TECHNICIAN_ROLES)[number];

export const MEKTEK_TECHNICIAN_ROLE_LABELS: Record<MektekTechnicianRole, string> = {
  MECHANIC: "Mekanik",
  HELPER: "Helper",
  OJT: "OJT",
};

export const INITIAL_MEKTEK_TECHNICIANS = [
  { name: "Winarto", role: "MECHANIC" },
  { name: "Ahmad", role: "MECHANIC" },
  { name: "Dicko", role: "MECHANIC" },
  { name: "Saryanto", role: "HELPER" },
  { name: "Widodo", role: "MECHANIC" },
  { name: "Yudha", role: "MECHANIC" },
  { name: "Rizki Ridwan", role: "MECHANIC" },
  { name: "Wildan", role: "OJT" },
] as const satisfies ReadonlyArray<{
  name: string;
  role: MektekTechnicianRole;
}>;

export function isMektekTechnicianRole(value: unknown): value is MektekTechnicianRole {
  return (
    typeof value === "string" &&
    (MEKTEK_TECHNICIAN_ROLES as readonly string[]).includes(value)
  );
}

export function validateMektekTechnicianIds(values: readonly unknown[]): string[] {
  const ids = values.map((value) => String(value ?? "").trim()).filter(Boolean);
  if (ids.length < 1) throw new Error("Pilih minimal 1 technician.");
  if (ids.length > 3) throw new Error("Pilih maksimal 3 technician.");
  if (new Set(ids).size !== ids.length) {
    throw new Error("Setiap technician harus berbeda.");
  }
  return ids;
}
