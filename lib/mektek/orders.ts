import type { Prisma } from "@prisma/client";

/**
 * Shared Mektek service-order constants and query fragments.
 *
 * Mektek orders are stored as `crm_Accounts_Tasks` rows whose `title` starts with
 * one of the prefixes below. These were previously redefined in `service-orders.ts`,
 * `dashboard.ts`, and `catalog-purchase.ts`; centralizing them here prevents one copy
 * drifting from the others (e.g. adding a filter clause in one place only).
 *
 * Note: `crm_Accounts_Tasks` has no `deletedAt` column — Mektek orders are not
 * soft-deleted (state is tracked via `taskStatus`), so no `deletedAt: null` filter
 * is required here despite the CLAUDE.md soft-delete rule for other CRM entities.
 */

export const MEKTEK_TITLE_PREFIX = "MEKTEK Service -";
export const LEGACY_MEKTEK_TITLE_PREFIX = "MEKTEK AC -";
export const MEKTEK_TITLE_PREFIXES = [
  MEKTEK_TITLE_PREFIX,
  LEGACY_MEKTEK_TITLE_PREFIX,
] as const;

/** Prisma `where` fragment matching every Mektek service order by title prefix. */
export const mektekOrderWhere = (): Prisma.crm_Accounts_TasksWhereInput => ({
  OR: MEKTEK_TITLE_PREFIXES.map((prefix) => ({
    title: {
      startsWith: prefix,
    },
  })),
});

/** Shared `select` for the payment rows attached to a Mektek order. */
export const mektekPaymentSelect = {
  id: true,
  midtransOrderId: true,
  grossAmount: true,
  paymentType: true,
  transactionStatus: true,
  fraudStatus: true,
  paidAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.MektekPaymentSelect;
