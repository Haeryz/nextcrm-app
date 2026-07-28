/**
 * Period filter shared by the Accounting recap pages (Rekapitulasi Invoice
 * Jasa & Part, Pendapatan Spare Part, Pendapatan Jasa, Rekap Jasa & Part).
 *
 * The filter supports three modes — single month, month range, and whole year —
 * plus an implicit "all" mode when nothing is selected. Each mode maps to a
 * half-open date range `[from, to)` that narrows the invoice query server-side.
 */

export type FinancePeriodMode = "all" | "month" | "range" | "year";

export type FinancePeriodFilter = {
  mode: FinancePeriodMode;
  month: string; // "YYYY-MM"
  fromMonth: string; // "YYYY-MM"
  toMonth: string; // "YYYY-MM"
  year: string; // "YYYY"
};

/** Half-open `[from, to)` date range used to narrow `invoiceDate` queries. */
export type FinanceDateRange = {
  from: Date;
  to: Date; // exclusive upper bound
};

const MONTH_NAMES_ID = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

const EMPTY_FILTER: FinancePeriodFilter = {
  mode: "all",
  month: "",
  fromMonth: "",
  toMonth: "",
  year: "",
};

function readStringParam(
  value: string | string[] | undefined,
): string {
  const resolved = Array.isArray(value) ? value[0] : value;
  return (resolved ?? "").trim();
}

/** Parses raw Next.js search params into a normalized period filter. */
export function parseFinancePeriodParams(
  params: Record<string, string | string[] | undefined> | undefined,
): FinancePeriodFilter {
  if (!params) return { ...EMPTY_FILTER };
  const mode = readStringParam(params.periodMode) as FinancePeriodMode;
  if (mode !== "month" && mode !== "range" && mode !== "year") {
    return { ...EMPTY_FILTER };
  }
  return {
    mode,
    month: readStringParam(params.month),
    fromMonth: readStringParam(params.fromMonth),
    toMonth: readStringParam(params.toMonth),
    year: readStringParam(params.year),
  };
}

function parseMonthKey(value: string): { year: number; month: number } | null {
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  return { year, month };
}

/**
 * Resolves a period filter into a half-open `[from, to)` date range.
 * Returns `null` when the filter is inactive or its inputs are incomplete,
 * so callers can skip the `invoiceDate` clause and load every invoice.
 */
export function resolveFinanceDateRange(
  filter: FinancePeriodFilter,
): FinanceDateRange | null {
  if (filter.mode === "month") {
    const parsed = parseMonthKey(filter.month);
    if (!parsed) return null;
    const from = new Date(parsed.year, parsed.month - 1, 1);
    const to = new Date(parsed.year, parsed.month, 1);
    return { from, to };
  }

  if (filter.mode === "range") {
    const fromParsed = parseMonthKey(filter.fromMonth);
    const toParsed = parseMonthKey(filter.toMonth);
    if (!fromParsed || !toParsed) return null;
    // Normalize so `from` is the earlier month.
    const fromKey = filter.fromMonth <= filter.toMonth ? fromParsed : toParsed;
    const toKey = filter.fromMonth <= filter.toMonth ? toParsed : fromParsed;
    const from = new Date(fromKey.year, fromKey.month - 1, 1);
    const to = new Date(toKey.year, toKey.month, 1);
    return { from, to };
  }

  if (filter.mode === "year") {
    const year = Number(filter.year);
    if (!Number.isFinite(year) || year < 2000 || year > 2100) return null;
    const from = new Date(year, 0, 1);
    const to = new Date(year + 1, 0, 1);
    return { from, to };
  }

  return null;
}

/** True when the filter is actively narrowing the result set. */
export function isFinancePeriodActive(filter: FinancePeriodFilter): boolean {
  return resolveFinanceDateRange(filter) !== null;
}

/** Human-readable Bahasa Indonesia label for the active period. */
export function formatFinancePeriodLabel(filter: FinancePeriodFilter): string {
  if (filter.mode === "month") {
    const parsed = parseMonthKey(filter.month);
    if (!parsed) return "Semua periode";
    return `${MONTH_NAMES_ID[parsed.month - 1]} ${parsed.year}`;
  }

  if (filter.mode === "range") {
    const fromParsed = parseMonthKey(filter.fromMonth);
    const toParsed = parseMonthKey(filter.toMonth);
    if (!fromParsed || !toParsed) return "Semua periode";
    const fromKey = filter.fromMonth <= filter.toMonth ? fromParsed : toParsed;
    const toKey = filter.fromMonth <= filter.toMonth ? toParsed : fromParsed;
    if (fromKey.year === toKey.year) {
      return `${MONTH_NAMES_ID[fromKey.month - 1]}–${MONTH_NAMES_ID[toKey.month - 1]} ${fromKey.year}`;
    }
    return `${MONTH_NAMES_ID[fromKey.month - 1]} ${fromKey.year}–${MONTH_NAMES_ID[toKey.month - 1]} ${toKey.year}`;
  }

  if (filter.mode === "year") {
    const year = Number(filter.year);
    if (!Number.isFinite(year)) return "Semua periode";
    return `Tahun ${year}`;
  }

  return "Semua periode";
}

/** Serializes the filter into URL search params (skips empty values). */
export function serializeFinancePeriodParams(
  filter: FinancePeriodFilter,
): Record<string, string> {
  const params: Record<string, string> = {};
  if (filter.mode !== "all") params.periodMode = filter.mode;
  if (filter.mode === "month" && filter.month) params.month = filter.month;
  if (filter.mode === "range") {
    if (filter.fromMonth) params.fromMonth = filter.fromMonth;
    if (filter.toMonth) params.toMonth = filter.toMonth;
  }
  if (filter.mode === "year" && filter.year) params.year = filter.year;
  return params;
}
