import { MEKTEK_TIME_ZONE } from "@/lib/mektek/customer-display";

export function getMektekTodayDateInput(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: MEKTEK_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const valueByPart = new Map(parts.map((part) => [part.type, part.value]));

  return (["year", "month", "day"] as const)
    .map((part) => valueByPart.get(part) ?? "")
    .join("-");
}

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
