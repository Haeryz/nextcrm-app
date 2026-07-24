export const PAYMENT_FAKTUR_STATUSES = [
  "SEMUA",
  "BELUM_BAYAR",
  "CICILAN",
  "LUNAS",
] as const;

export const PAYMENT_FAKTUR_SORT_KEYS = [
  "number",
  "invoiceDate",
  "invoiceNumber",
  "grandTotal",
  "paidAmount",
  "remainingAmount",
  "status",
] as const;

export const PAYMENT_FAKTUR_SORT_DIRECTIONS = ["asc", "desc"] as const;

export type PaymentFakturStatusFilter =
  (typeof PAYMENT_FAKTUR_STATUSES)[number];
export type PaymentFakturSortKey = (typeof PAYMENT_FAKTUR_SORT_KEYS)[number];
export type PaymentFakturSortDirection =
  (typeof PAYMENT_FAKTUR_SORT_DIRECTIONS)[number];

type SortablePaymentFakturRow = {
  id: string;
  sourceRow: number | null;
  invoiceNumber: string;
  invoiceDate: string | null;
  grandTotal: number;
  paidAmount: number;
  remainingAmount: number;
  status: Exclude<PaymentFakturStatusFilter, "SEMUA">;
};

const statusRank: Record<SortablePaymentFakturRow["status"], number> = {
  BELUM_BAYAR: 0,
  CICILAN: 1,
  LUNAS: 2,
};

export function normalizePaymentFakturStatus(
  value: unknown,
): PaymentFakturStatusFilter {
  return PAYMENT_FAKTUR_STATUSES.includes(value as PaymentFakturStatusFilter)
    ? (value as PaymentFakturStatusFilter)
    : "SEMUA";
}

export function normalizePaymentFakturSort(
  value: unknown,
): PaymentFakturSortKey {
  return PAYMENT_FAKTUR_SORT_KEYS.includes(value as PaymentFakturSortKey)
    ? (value as PaymentFakturSortKey)
    : "number";
}

export function normalizePaymentFakturDirection(
  value: unknown,
): PaymentFakturSortDirection {
  return PAYMENT_FAKTUR_SORT_DIRECTIONS.includes(
    value as PaymentFakturSortDirection,
  )
    ? (value as PaymentFakturSortDirection)
    : "desc";
}

function sortableValue(
  row: SortablePaymentFakturRow,
  key: PaymentFakturSortKey,
) {
  switch (key) {
    case "number":
      return row.sourceRow ?? -1;
    case "invoiceDate":
      return row.invoiceDate ? Date.parse(`${row.invoiceDate}T00:00:00Z`) : -1;
    case "invoiceNumber":
      return row.invoiceNumber;
    case "grandTotal":
      return row.grandTotal;
    case "paidAmount":
      return row.paidAmount;
    case "remainingAmount":
      return row.remainingAmount;
    case "status":
      return statusRank[row.status];
  }
}

export function filterAndSortPaymentFakturRows<
  T extends SortablePaymentFakturRow,
>(
  rows: readonly T[],
  options: {
    status: PaymentFakturStatusFilter;
    sort: PaymentFakturSortKey;
    direction: PaymentFakturSortDirection;
  },
) {
  const direction = options.direction === "asc" ? 1 : -1;
  return rows
    .filter(
      (row) => options.status === "SEMUA" || row.status === options.status,
    )
    .slice()
    .sort((left, right) => {
      const a = sortableValue(left, options.sort);
      const b = sortableValue(right, options.sort);
      const comparison =
        typeof a === "string" && typeof b === "string"
          ? a.localeCompare(b, "id-ID", { numeric: true })
          : Number(a) - Number(b);
      return comparison === 0
        ? left.id.localeCompare(right.id)
        : comparison * direction;
    });
}

export function paymentFakturDisplayNumber(
  sourceRow: number | null,
  index: number,
  pageOffset: number,
) {
  return sourceRow ? Math.max(1, sourceRow - 14) : pageOffset + index + 1;
}
