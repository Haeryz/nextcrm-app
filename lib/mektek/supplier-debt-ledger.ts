import type {
  SupplierDebtStatus,
} from "@/lib/mektek/supplier-debt-report";

export type SupplierDebtTransactionKind = "DEPOSIT" | "PAYMENT";
export type SupplierDebtPaymentSource = "CASH" | "DEPOSIT";
export type SupplierDebtDueState = "NONE" | "DUE_SOON" | "OVERDUE";

export type SupplierDebtLedgerTransaction = {
  sheetKey: string;
  sourceRow: number | null;
  kind: SupplierDebtTransactionKind;
  paymentSource: SupplierDebtPaymentSource | null;
  amount: number;
  transactionDate: string | null;
};

export type SupplierDebtTransactionInput = {
  kind: SupplierDebtTransactionKind;
  amount: number | string;
  appliedAmount?: number | string;
  paymentSource?: SupplierDebtPaymentSource;
  transactionDate: string;
  reference?: string;
  note?: string;
};

const DAY_IN_MS = 86_400_000;
const cleanText = (value: unknown, max: number) =>
  String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
const money = (value: unknown) => {
  const normalized = String(value ?? "").replace(/[^\d.-]/g, "");
  const parsed = normalized ? Number(normalized) : 0;
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : 0;
};

export function parseSupplierDebtTransactionInput(
  input: SupplierDebtTransactionInput,
) {
  const kind = input.kind;
  const amount = money(input.amount);
  const appliedAmount = money(input.appliedAmount);
  const paymentSource =
    kind === "PAYMENT" &&
    (input.paymentSource === "CASH" || input.paymentSource === "DEPOSIT")
      ? input.paymentSource
      : null;
  const transactionDate = cleanText(input.transactionDate, 10);

  if (kind !== "DEPOSIT" && kind !== "PAYMENT") {
    return { error: "Jenis transaksi tidak valid" } as const;
  }
  if (amount <= 0) {
    return { error: "Nominal harus lebih dari 0" } as const;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(transactionDate)) {
    return { error: "Tanggal transaksi tidak valid" } as const;
  }
  if (kind === "DEPOSIT" && appliedAmount > amount) {
    return {
      error: "Nominal yang digunakan tidak boleh melebihi deposit",
    } as const;
  }
  if (kind === "PAYMENT" && !paymentSource) {
    return { error: "Sumber pembayaran tidak valid" } as const;
  }

  return {
    data: {
      kind,
      amount,
      appliedAmount: kind === "DEPOSIT" ? appliedAmount : 0,
      remainingDeposit: kind === "DEPOSIT" ? amount - appliedAmount : 0,
      transactionDate,
      paymentSource,
      reference: cleanText(input.reference, 160) || null,
      note: cleanText(input.note, 1000) || null,
    },
  } as const;
}

export function supplierDepositBalance(
  transactions: SupplierDebtLedgerTransaction[],
  sheetKey: string,
) {
  return Math.max(
    transactions.reduce((balance, transaction) => {
      if (transaction.sheetKey !== sheetKey) return balance;
      if (transaction.kind === "DEPOSIT") return balance + transaction.amount;
      if (
        transaction.kind === "PAYMENT" &&
        transaction.paymentSource === "DEPOSIT"
      ) {
        return balance - transaction.amount;
      }
      return balance;
    }, 0),
    0,
  );
}

export function applySupplierDebtPayments(
  entry: { grandTotal: number; paymentAmount: number },
  transactions: SupplierDebtLedgerTransaction[],
  sheetKey: string,
  sourceRow: number,
) {
  const ledgerPayments = transactions
    .filter(
      (transaction) =>
        transaction.sheetKey === sheetKey &&
        transaction.sourceRow === sourceRow &&
        transaction.kind === "PAYMENT",
    )
    .sort((a, b) =>
      (a.transactionDate ?? "").localeCompare(b.transactionDate ?? ""),
    );
  const ledgerPaymentAmount = ledgerPayments.reduce(
    (total, transaction) => total + transaction.amount,
    0,
  );
  const paymentAmount = Math.min(
    Math.max(entry.paymentAmount + ledgerPaymentAmount, 0),
    Math.max(entry.grandTotal, 0),
  );
  const remainingAmount = Math.max(entry.grandTotal - paymentAmount, 0);
  const status: SupplierDebtStatus =
    entry.grandTotal > 0 && remainingAmount === 0
      ? "LUNAS"
      : paymentAmount > 0
        ? "CICILAN"
        : "BELUM_BAYAR";

  return {
    paymentAmount,
    remainingAmount,
    status,
    ledgerPaymentAmount,
    ledgerPayments: ledgerPayments.map((transaction) => ({
      transactionDate: transaction.transactionDate,
      amount: transaction.amount,
    })),
  };
}

export function supplierDebtDueState(
  dueDate: string | null,
  status: SupplierDebtStatus,
  today = new Date(),
  warningDays = 7,
): SupplierDebtDueState {
  if (!dueDate || status === "LUNAS") return "NONE";
  const dueTime = Date.parse(`${dueDate}T00:00:00.000Z`);
  if (Number.isNaN(dueTime)) return "NONE";
  const todayTime = Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate(),
  );
  const daysUntilDue = Math.ceil((dueTime - todayTime) / DAY_IN_MS);
  if (daysUntilDue < 0) return "OVERDUE";
  return daysUntilDue <= warningDays ? "DUE_SOON" : "NONE";
}
