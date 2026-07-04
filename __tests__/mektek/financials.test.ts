import { buildMektekFinancialSummary } from "@/lib/mektek/financials";

const baseTags = {
  serviceItems: [
    {
      name: "Tune up",
      quantity: 1,
      unitPrice: 100000,
      total: 100000,
    },
  ],
  tax: 11000,
  pph: 2000,
};

describe("buildMektekFinancialSummary", () => {
  it("uses settled Midtrans payments when tags still say unpaid", () => {
    const summary = buildMektekFinancialSummary(
      {
        ...baseTags,
        payment: {
          method: "qris",
          amountPaid: 0,
          status: "unpaid",
        },
      },
      null,
      [
        {
          id: "payment-1",
          midtransOrderId: "MEK-123",
          grossAmount: 109000,
          paymentType: "qris",
          transactionStatus: "settlement",
          paidAt: new Date("2026-07-05T01:49:00.000Z"),
          createdAt: new Date("2026-07-05T01:45:00.000Z"),
          updatedAt: new Date("2026-07-05T01:49:00.000Z"),
        },
      ]
    );

    expect(summary.grandTotal).toBe(109000);
    expect(summary.amountPaid).toBe(109000);
    expect(summary.balanceDue).toBe(0);
    expect(summary.payment.status).toBe("paid");
    expect(summary.payment.providerAmountPaid).toBe(109000);
  });

  it("does not double count a payment already reflected in tags", () => {
    const summary = buildMektekFinancialSummary(
      {
        ...baseTags,
        payment: {
          method: "qris",
          amountPaid: 109000,
          status: "paid",
        },
      },
      null,
      [
        {
          id: "payment-1",
          midtransOrderId: "MEK-123",
          grossAmount: 109000,
          paymentType: "qris",
          transactionStatus: "settlement",
          paidAt: new Date("2026-07-05T01:49:00.000Z"),
        },
      ]
    );

    expect(summary.amountPaid).toBe(109000);
    expect(summary.balanceDue).toBe(0);
  });
});
