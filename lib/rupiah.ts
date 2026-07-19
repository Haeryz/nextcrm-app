export type RupiahInputValue = string | number | null | undefined;

export function normalizeRupiahDigits(value: RupiahInputValue): string {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits.replace(/^0+(?=\d)/, "");
}

export function formatRupiahInput(value: RupiahInputValue): string {
  const digits = normalizeRupiahDigits(value);
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}
