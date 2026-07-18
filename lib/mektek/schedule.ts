export function parseEstimatedDoneInput(
  value: string | null | undefined,
): { date: Date | null } | { error: string } {
  const normalized = String(value ?? "").trim();
  if (!normalized) return { date: null };

  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) {
    return { error: "Estimated done date is invalid" };
  }

  return { date };
}
