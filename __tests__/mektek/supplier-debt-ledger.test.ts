import {
  applySupplierDebtPayments,
  isCalendarDate,
  parseSupplierDebtTransactionInput,
  supplierDebtDueState,
  supplierDepositBalance,
} from "@/lib/mektek/supplier-debt-ledger";

const transactions = [
  {
    sheetKey: "SUPPLIER A",
    sourceRow: null,
    kind: "DEPOSIT" as const,
    paymentSource: null,
    amount: 500_000,
    transactionDate: "2026-07-20" as const,
  },
  {
    sheetKey: "SUPPLIER A",
    sourceRow: 12,
    kind: "PAYMENT" as const,
    paymentSource: "DEPOSIT" as const,
    amount: 300_000,
    transactionDate: "2026-07-21" as const,
  },
  {
    sheetKey: "SUPPLIER A",
    sourceRow: 12,
    kind: "PAYMENT" as const,
    paymentSource: "CASH" as const,
    amount: 100_000,
    transactionDate: "2026-07-22" as const,
  },
];

describe("supplier debt transaction ledger", () => {
  it("documents unused supplier deposits as an available balance", () => {
    expect(supplierDepositBalance(transactions, "SUPPLIER A")).toBe(200_000);
  });

  it("applies cash and deposit-funded payments to the same displayed debt", () => {
    expect(
      applySupplierDebtPayments(
        {
          grandTotal: 1_000_000,
          paymentAmount: 200_000,
        },
        transactions,
        "SUPPLIER A",
        12,
      ),
    ).toEqual({
      paymentAmount: 600_000,
      remainingAmount: 400_000,
      status: "CICILAN",
      ledgerPaymentAmount: 400_000,
      ledgerPayments: [
        { transactionDate: "2026-07-21", amount: 300_000 },
        { transactionDate: "2026-07-22", amount: 100_000 },
      ],
    });
  });

  it("marks unpaid rows as due soon or overdue without alerting paid rows", () => {
    const today = new Date("2026-07-25T00:00:00.000Z");

    expect(supplierDebtDueState("2026-07-29", "CICILAN", today, 7)).toBe(
      "DUE_SOON",
    );
    expect(supplierDebtDueState("2026-07-24", "BELUM_BAYAR", today, 7)).toBe(
      "OVERDUE",
    );
    expect(supplierDebtDueState("2026-07-24", "LUNAS", today, 7)).toBe("NONE");
  });

  it("validates deposits and preserves the amount left after immediate use", () => {
    expect(
      parseSupplierDebtTransactionInput({
        kind: "DEPOSIT",
        amount: 500_000,
        appliedAmount: 300_000,
        transactionDate: "2026-07-25",
        reference: "DP-001",
        note: "Deposit untuk pembelian berikutnya",
      }),
    ).toEqual({
      data: {
        kind: "DEPOSIT",
        amount: 500_000,
        appliedAmount: 300_000,
        remainingDeposit: 200_000,
        transactionDate: "2026-07-25",
        paymentSource: null,
        reference: "DP-001",
        note: "Deposit untuk pembelian berikutnya",
      },
    });
  });

  it("rejects allocating more money than was deposited", () => {
    expect(
      parseSupplierDebtTransactionInput({
        kind: "DEPOSIT",
        amount: 100_000,
        appliedAmount: 120_000,
        transactionDate: "2026-07-25",
      }),
    ).toEqual({
      error: "Nominal yang digunakan tidak boleh melebihi deposit",
    });
  });
});

describe("Supplier debt transaction dates", () => {
  const now = new Date("2026-09-24T03:00:00.000Z");
  const payment = (transactionDate: string) =>
    parseSupplierDebtTransactionInput(
      {
        kind: "PAYMENT",
        amount: 1_400_000,
        paymentSource: "CASH",
        transactionDate,
        reference: "NO SP",
      },
      now,
    );

  it("accepts a payment recorded days after it was made", () => {
    expect(payment("2026-09-21")).toHaveProperty("data.transactionDate", "2026-09-21");
  });

  it("accepts today and tomorrow (timezone slack) but not later", () => {
    expect(payment("2026-09-24")).toHaveProperty("data");
    expect(payment("2026-09-25")).toHaveProperty("data");
    expect(payment("2026-09-26")).toEqual({
      error: "Tanggal transaksi tidak boleh di masa depan",
    });
  });

  it("rejects impossible calendar dates instead of rolling them over", () => {
    expect(isCalendarDate("2026-02-31")).toBe(false);
    expect(isCalendarDate("2024-02-29")).toBe(true);
    expect(payment("2026-02-31")).toEqual({ error: "Tanggal transaksi tidak valid" });
    expect(payment("21/09/2026")).toEqual({ error: "Tanggal transaksi tidak valid" });
  });

  it("rejects implausibly old dates", () => {
    expect(payment("1926-09-21")).toEqual({ error: "Tanggal transaksi terlalu lama" });
  });
});
