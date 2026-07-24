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

export type MektekTechnicianSelectionInput = {
  id?: unknown;
  name?: unknown;
};

export type MektekTechnicianSelection = {
  id: string | null;
  name: string;
};

export function normalizeMektekTechnicianSelections(
  values: readonly MektekTechnicianSelectionInput[],
): MektekTechnicianSelection[] {
  const selections = values
    .map((value) => ({
      id: String(value?.id ?? "").trim() || null,
      name: String(value?.name ?? "").trim().slice(0, 100),
    }))
    .filter((value) => value.name);

  if (selections.length < 1) {
    throw new Error("Pilih minimal 1 technician.");
  }
  if (selections.length > 3) {
    throw new Error("Pilih maksimal 3 technician.");
  }

  const identities = selections.map((selection) =>
    selection.name.toLocaleLowerCase("id-ID"),
  );
  if (new Set(identities).size !== identities.length) {
    throw new Error("Setiap technician harus berbeda.");
  }

  return selections;
}
