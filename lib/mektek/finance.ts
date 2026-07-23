export const FINANCE_CURRENCY = "IDR" as const;
export const FINANCE_REMINDER_MILESTONES = [30, 14, 7] as const;

export type FinanceDerivedState =
  | "UNPAID"
  | "PARTIALLY_PAID"
  | "PAID"
  | "OVERDUE";

export type FinanceGroupingSource = {
  counterpartyId: string;
  currency: string;
  taxProfile: string;
  paymentTermsDays: number | null;
  contractId: string | null;
};

export type SupplyWindow = {
  counterpartyId: string;
  projectKey: string;
  itemKey: string;
  mode: "MANUAL" | "CONSIGNMENT";
  startDate: Date;
  endDate: Date;
};

export type FinanceRevenueCategory = "service" | "sparepart" | "unclassified";

export type FinanceRevenueLine = {
  kind?: string | null;
  description?: string | null;
  lineTotal: number;
};

export type FinanceRevenueBucket = {
  subtotal: number;
  taxAmount: number;
  total: number;
  descriptions: string[];
};

const SPARE_PART_REVENUE_PATTERN =
  /spare\s*part|suku\s*cadang|\bpart\b|komponen|penjualan/i;
const SERVICE_REVENUE_PATTERN =
  /jasa|service|servis|rental|sewa|maint(?:enance)?|repair|perbaikan|rekondisi|labou?r|lembur|contract|kontrak/i;

export function classifyFinanceRevenueLine(
  line: Pick<FinanceRevenueLine, "kind" | "description">,
): FinanceRevenueCategory {
  const kind = String(line.kind ?? "")
    .trim()
    .toLocaleLowerCase("id-ID")
    .replace(/[\s_-]+/g, "");
  if (["sparepart", "part", "sukucadang"].includes(kind)) return "sparepart";
  if (["service", "jasa"].includes(kind)) return "service";
  if (["mixed", "campuran", "other", "lainnya"].includes(kind)) {
    return "unclassified";
  }

  const description = String(line.description ?? "").trim();
  const hasSparePart = SPARE_PART_REVENUE_PATTERN.test(description);
  const hasService = SERVICE_REVENUE_PATTERN.test(description);
  if (hasSparePart === hasService) return "unclassified";
  return hasSparePart ? "sparepart" : "service";
}

const emptyRevenueBucket = (): FinanceRevenueBucket => ({
  subtotal: 0,
  taxAmount: 0,
  total: 0,
  descriptions: [],
});

export function buildFinanceRevenueSplit(input: {
  taxAmount: number;
  lines: FinanceRevenueLine[];
}) {
  const result: Record<FinanceRevenueCategory, FinanceRevenueBucket> = {
    service: emptyRevenueBucket(),
    sparepart: emptyRevenueBucket(),
    unclassified: emptyRevenueBucket(),
  };

  for (const line of input.lines) {
    const category = classifyFinanceRevenueLine(line);
    const amount = finiteMoney(Number(line.lineTotal));
    result[category].subtotal += amount;
    const description = String(line.description ?? "").trim();
    if (description) result[category].descriptions.push(description);
  }

  const invoiceSubtotal = Object.values(result).reduce(
    (sum, bucket) => sum + bucket.subtotal,
    0,
  );
  const taxAmount = finiteMoney(Number(input.taxAmount));
  if (invoiceSubtotal > 0 && taxAmount > 0) {
    let allocatedTax = 0;
    const populatedCategories = (
      ["service", "sparepart", "unclassified"] as const
    ).filter((category) => result[category].subtotal > 0);
    populatedCategories.forEach((category, index) => {
      const isLast = index === populatedCategories.length - 1;
      const categoryTax = isLast
        ? taxAmount - allocatedTax
        : Math.round(
            (taxAmount * result[category].subtotal) / invoiceSubtotal * 100,
          ) / 100;
      result[category].taxAmount = categoryTax;
      allocatedTax += categoryTax;
    });
  }

  for (const bucket of Object.values(result)) {
    bucket.total = bucket.subtotal + bucket.taxAmount;
  }
  return result;
}

const finiteMoney = (value: number) =>
  Number.isFinite(value) ? Math.max(0, value) : 0;

export function buildFinanceBalance(total: number, allocations: number[]) {
  const normalizedTotal = finiteMoney(total);
  const allocated = Math.min(
    normalizedTotal,
    allocations.reduce((sum, value) => sum + finiteMoney(value), 0),
  );

  return {
    allocated,
    balance: Math.max(0, normalizedTotal - allocated),
  };
}

export function getFinanceDocumentState(input: {
  total: number;
  allocations: number[];
  dueDate: Date;
  now?: Date;
}): FinanceDerivedState {
  const { allocated, balance } = buildFinanceBalance(
    input.total,
    input.allocations,
  );
  if (balance <= 0 && input.total > 0) return "PAID";
  const now = input.now ?? new Date();
  if (input.dueDate.getTime() < now.getTime()) return "OVERDUE";
  return allocated > 0 ? "PARTIALLY_PAID" : "UNPAID";
}

export function canApproveFinanceRequest(
  requestedById: string,
  approverId: string,
) {
  return !!requestedById && !!approverId && requestedById !== approverId;
}

export function validateBillingSourceGrouping(
  sources: FinanceGroupingSource[],
): { ok: true } | { ok: false; reason: string } {
  const first = sources[0];
  if (!first) return { ok: false, reason: "NO_SOURCES" };

  for (const source of sources.slice(1)) {
    if (source.counterpartyId !== first.counterpartyId) {
      return { ok: false, reason: "COUNTERPARTY_MISMATCH" };
    }
    if (source.currency !== first.currency) {
      return { ok: false, reason: "CURRENCY_MISMATCH" };
    }
    if (source.taxProfile !== first.taxProfile) {
      return { ok: false, reason: "TAX_PROFILE_MISMATCH" };
    }
    if (source.paymentTermsDays !== first.paymentTermsDays) {
      return { ok: false, reason: "PAYMENT_TERMS_MISMATCH" };
    }
    if (source.contractId !== first.contractId) {
      return { ok: false, reason: "CONTRACT_MISMATCH" };
    }
  }

  return { ok: true };
}

export const normalizeFinanceKey = (value: unknown) =>
  String(value ?? "")
    .trim()
    .toLocaleUpperCase("id-ID")
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export function hasSupplyWindowConflict(
  existing: SupplyWindow,
  candidate: SupplyWindow,
) {
  if (existing.mode === candidate.mode) return false;
  if (existing.counterpartyId !== candidate.counterpartyId) return false;
  if (existing.projectKey !== candidate.projectKey) return false;
  if (existing.itemKey !== candidate.itemKey) return false;

  return (
    existing.startDate.getTime() <= candidate.endDate.getTime() &&
    candidate.startDate.getTime() <= existing.endDate.getTime()
  );
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function getContractDaysRemaining(endDate: Date, now = new Date()) {
  const startOfNow = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  const startOfEnd = Date.UTC(
    endDate.getUTCFullYear(),
    endDate.getUTCMonth(),
    endDate.getUTCDate(),
  );
  return Math.round((startOfEnd - startOfNow) / DAY_MS);
}

const CONTRACT_MONTHS: Record<string, number> = {
  januari: 0,
  january: 0,
  jan: 0,
  februari: 1,
  february: 1,
  feb: 1,
  maret: 2,
  march: 2,
  mart: 2,
  mar: 2,
  april: 3,
  apr: 3,
  mei: 4,
  may: 4,
  juni: 5,
  june: 5,
  jun: 5,
  juli: 6,
  july: 6,
  jul: 6,
  agustus: 7,
  august: 7,
  agu: 7,
  aug: 7,
  september: 8,
  sept: 8,
  sep: 8,
  oktober: 9,
  october: 9,
  okt: 9,
  oct: 9,
  november: 10,
  nov: 10,
  desember: 11,
  december: 11,
  des: 11,
  dec: 11,
};

export function parseFinanceContractPeriodEnd(period: unknown) {
  const value = String(period ?? "").trim();
  if (!value) return null;

  const isoDates = [...value.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g)];
  if (isoDates.length) {
    const [, year, month, day] = isoDates.at(-1)!;
    const parsed = new Date(
      Date.UTC(Number(year), Number(month) - 1, Number(day)),
    );
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const namedDates = [
    ...value.toLocaleLowerCase("id-ID").matchAll(
      /\b(\d{1,2})\s+([a-z]+)\s+(\d{4})\b/g,
    ),
  ];
  for (const match of namedDates.reverse()) {
    const month = CONTRACT_MONTHS[match[2]];
    if (month == null) continue;
    const day = Number(match[1]);
    const year = Number(match[3]);
    const parsed = new Date(Date.UTC(year, month, day));
    if (
      parsed.getUTCFullYear() === year &&
      parsed.getUTCMonth() === month &&
      parsed.getUTCDate() === day
    ) {
      return parsed;
    }
  }
  return null;
}

export function getContractReminderMilestones(input: {
  endDate: Date;
  now?: Date;
  sentMilestones: number[];
}) {
  const now = input.now ?? new Date();
  const daysRemaining = getContractDaysRemaining(input.endDate, now);
  const sent = new Set(input.sentMilestones);

  return FINANCE_REMINDER_MILESTONES.filter(
    (milestone) => milestone === daysRemaining && !sent.has(milestone),
  );
}
