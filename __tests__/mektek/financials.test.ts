import { buildMektekFinancialSummary } from "@/lib/mektek/financials";

const baseTags = {
  customerType: "B2B",
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
  it("applies PPN but never PPH to a private customer", () => {
    const summary = buildMektekFinancialSummary({
      ...baseTags,
      customerType: "STANDARD",
      ppnEnabled: true,
      pphEnabled: true,
    });

    expect(summary.ppnEnabled).toBe(true);
    expect(summary.pphEnabled).toBe(false);
    expect(summary.tax).toBe(11_000);
    expect(summary.pph).toBe(0);
    expect(summary.grandTotal).toBe(111_000);
  });

  it("applies both PPN and PPH to a business customer by default", () => {
    const summary = buildMektekFinancialSummary({
      serviceItems: baseTags.serviceItems,
      customerType: "B2B",
    });

    expect(summary.ppnEnabled).toBe(true);
    expect(summary.pphEnabled).toBe(true);
    expect(summary.tax).toBe(11_000);
    expect(summary.pph).toBe(2_000);
    expect(summary.grandTotal).toBe(109_000);
  });

  it("lets an admin snapshot disable PPN and PPH independently", () => {
    const noPpn = buildMektekFinancialSummary({
      serviceItems: baseTags.serviceItems,
      customerType: "B2B",
      ppnEnabled: false,
      pphEnabled: true,
    });
    const noPph = buildMektekFinancialSummary({
      serviceItems: baseTags.serviceItems,
      customerType: "B2B",
      ppnEnabled: true,
      pphEnabled: false,
    });

    expect(noPpn.grandTotal).toBe(98_000);
    expect(noPph.grandTotal).toBe(111_000);
  });

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
