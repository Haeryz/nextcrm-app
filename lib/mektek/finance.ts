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

export function getContractReminderMilestones(input: {
  endDate: Date;
  now?: Date;
  sentMilestones: number[];
}) {
  const now = input.now ?? new Date();
  const startOfNow = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  const startOfEnd = Date.UTC(
    input.endDate.getUTCFullYear(),
    input.endDate.getUTCMonth(),
    input.endDate.getUTCDate(),
  );
  const daysRemaining = Math.round((startOfEnd - startOfNow) / DAY_MS);
  const sent = new Set(input.sentMilestones);

  return FINANCE_REMINDER_MILESTONES.filter(
    (milestone) => milestone === daysRemaining && !sent.has(milestone),
  );
}
