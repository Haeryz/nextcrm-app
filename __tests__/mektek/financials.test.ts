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
  it("never applies PPN or PPH to a private customer", () => {
    const summary = buildMektekFinancialSummary({
      ...baseTags,
      customerType: "STANDARD",
      ppnEnabled: true,
      pphEnabled: true,
    });

    expect(summary.ppnEnabled).toBe(false);
    expect(summary.pphEnabled).toBe(false);
    expect(summary.tax).toBe(0);
    expect(summary.pph).toBe(0);
    expect(summary.grandTotal).toBe(100_000);
  });

  it("deducts service-only PPh from DPP plus PPN for a business customer", () => {
    const summary = buildMektekFinancialSummary({
      serviceItems: baseTags.serviceItems,
      sparepartItems: [
        { name: "Filter", quantity: 1, unitPrice: 50_000, total: 50_000 },
      ],
      customerType: "B2B",
    });

    expect(summary.ppnEnabled).toBe(true);
    expect(summary.pphEnabled).toBe(true);
    expect(summary.tax).toBe(16_500);
    expect(summary.pph).toBe(2_000);
    expect(summary.grossInvoiceTotal).toBe(166_500);
    expect(summary.netPayable).toBe(164_500);
    expect(summary.grandTotal).toBe(164_500);
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
    expect(noPpn.grandTotal).toBeLessThan(100_000);
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

  it("reopens the balance when items are added after a settled payment", () => {
    const summary = buildMektekFinancialSummary(
      {
        ...baseTags,
        serviceItems: [
          ...baseTags.serviceItems,
          {
            name: "Servis tambahan",
            quantity: 1,
            unitPrice: 50_000,
            total: 50_000,
          },
        ],
      },
      null,
      [
        {
          id: "payment-1",
          midtransOrderId: "MEK-123",
          grossAmount: 109_000,
          paymentType: "qris",
          transactionStatus: "settlement",
          paidAt: new Date("2026-07-05T01:49:00.000Z"),
        },
      ],
    );

    expect(summary.amountPaid).toBe(109_000);
    expect(summary.balanceDue).toBe(54_500);
    expect(summary.payment.status).toBe("partial");
  });
});
