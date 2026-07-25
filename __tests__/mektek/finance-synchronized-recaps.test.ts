import { buildFinanceSynchronizedRecaps } from "@/lib/mektek/finance-recaps";

describe("synchronized Finance recaps", () => {
  it("projects one invoice into delivery-note, receivable, service, part, and revenue recaps", () => {
    const result = buildFinanceSynchronizedRecaps([
      {
        id: "invoice-1",
        invoiceNumber: "INV-001",
        draftNumber: "draft-1",
        status: "ISSUED",
        customer: "PT Pelanggan",
        invoiceDate: "2026-07-15",
        deliveryNoteNumber: "SJ-001",
        deliveryNoteDate: "2026-07-10",
        receiptNumber: "KW-001",
        purchaseOrderNumber: "PO-001",
        purchaseOrderDate: "2026-07-01",
        taxInvoiceNumber: "FP-001",
        subtotal: 1_500_000,
        taxAmount: 165_000,
        netAmount: 1_665_000,
        paidAmount: 600_000,
        lines: [
          {
            kind: "SERVICE",
            description: "Jasa perbaikan AC",
            lineTotal: 1_000_000,
          },
          {
            kind: "SPARE_PART",
            description: "Kompresor AC",
            lineTotal: 500_000,
          },
        ],
        deliveryNotes: [
          {
            id: "source-1",
            number: "SJ-001",
            date: "2026-07-10",
            description: "Jasa perbaikan AC; Kompresor AC",
            subtotal: 1_500_000,
          },
        ],
      },
    ]);

    expect(result.deliveryNotes).toEqual([
      expect.objectContaining({
        company: "PT Pelanggan",
        deliveryNoteNumber: "SJ-001",
        invoiceNumber: "INV-001",
        subtotal: 1_500_000,
        taxAmount: 165_000,
        total: 1_665_000,
      }),
    ]);
    expect(result.receivables).toEqual([
      expect.objectContaining({
        customer: "PT Pelanggan",
        totalReceivable: 1_665_000,
        paid: 600_000,
        balance: 1_065_000,
        notes: "BELUM LUNAS",
        monthly: expect.objectContaining({ jul: 1_665_000 }),
        monthlyPaid: expect.objectContaining({ jul: 600_000 }),
        monthlyBalance: expect.objectContaining({ jul: 1_065_000 }),
      }),
    ]);
    expect(result.revenueRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: "service",
          subtotal: 1_000_000,
          taxAmount: 110_000,
        }),
        expect.objectContaining({
          category: "sparepart",
          subtotal: 500_000,
          taxAmount: 55_000,
        }),
      ]),
    );
  });

  it("keeps every linked delivery note and excludes void invoices everywhere", () => {
    const base = {
      draftNumber: "draft",
      customer: "PT Pelanggan",
      invoiceDate: "2026-08-01",
      deliveryNoteNumber: null,
      deliveryNoteDate: null,
      receiptNumber: null,
      purchaseOrderNumber: "PO-002",
      purchaseOrderDate: "2026-07-25",
      taxInvoiceNumber: null,
      subtotal: 1_000_000,
      taxAmount: 110_000,
      netAmount: 1_110_000,
      paidAmount: 0,
      lines: [
        {
          kind: "SERVICE",
          description: "Jasa instalasi",
          lineTotal: 1_000_000,
        },
      ],
    };
    const result = buildFinanceSynchronizedRecaps([
      {
        ...base,
        id: "active",
        invoiceNumber: "INV-002",
        status: "ISSUED",
        deliveryNotes: [
          {
            id: "sj-a",
            number: "SJ-A",
            date: "2026-07-29",
            description: "Tahap A",
            subtotal: 400_000,
          },
          {
            id: "sj-b",
            number: "SJ-B",
            date: "2026-07-30",
            description: "Tahap B",
            subtotal: 600_000,
          },
        ],
      },
      {
        ...base,
        id: "void",
        invoiceNumber: "INV-VOID",
        status: "VOID",
        deliveryNotes: [],
      },
    ]);

    expect(result.deliveryNotes.map((row) => row.deliveryNoteNumber)).toEqual([
      "SJ-A",
      "SJ-B",
    ]);
    expect(result.receivables).toHaveLength(1);
    expect(result.revenueRows).toHaveLength(1);
  });
});
