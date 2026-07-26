import { readFileSync } from "fs";
import { resolve } from "path";

import {
  buildFinancePurchaseOrderDeliveryNoteSuggestion,
} from "@/lib/mektek/finance-po";

const read = (relativePath: string) =>
  readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("Finance invoice line items", () => {
  it("carries qty and unit price from a Surat Jalan snapshot", () => {
    const suggestion = buildFinancePurchaseOrderDeliveryNoteSuggestion({
      id: "src-1",
      sourceReference: "SJ-001",
      occurredAt: new Date("2026-07-22T00:00:00.000Z"),
      subtotal: "450000",
      snapshot: {
        items: [
          {
            description: "Jasa servis",
            partNumber: null,
            quantity: 2,
            unitPrice: "150000",
          },
          {
            description: "Filter",
            partNumber: "FLT-01",
            quantity: 3,
            unitPrice: "50000",
          },
        ],
      },
    });

    expect(suggestion.items).toEqual([
      {
        description: "Jasa servis",
        partNumber: "",
        quantity: "2",
        unitPrice: "150000",
      },
      {
        description: "Filter",
        partNumber: "FLT-01",
        quantity: "3",
        unitPrice: "50000",
      },
    ]);
    // qty x unit price reproduces the pre-PPN value shown on the invoice.
    const computed = suggestion.items.reduce(
      (sum, item) => sum + Number(item.quantity) * Number(item.unitPrice),
      0,
    );
    expect(String(computed)).toBe(suggestion.subtotal);
  });

  it("leaves the unit price blank when the snapshot has no price", () => {
    const suggestion = buildFinancePurchaseOrderDeliveryNoteSuggestion({
      id: "src-2",
      sourceReference: "SJ-002",
      occurredAt: new Date("2026-07-22T00:00:00.000Z"),
      subtotal: null,
      snapshot: {
        items: [{ description: "Filter", quantity: 3, unitPrice: null }],
      },
    });

    expect(suggestion.items).toEqual([
      { description: "Filter", partNumber: "", quantity: "3", unitPrice: "" },
    ]);
    expect(suggestion.pricingComplete).toBe(false);
  });

  it("derives the pre-PPN value from the items server-side", () => {
    const actionSource = read("actions/mektek/finance.ts");

    expect(actionSource).toContain("function parseInvoiceItems");
    expect(actionSource).toContain(
      "const subtotal = items ? items.subtotal : money(input.subtotal)",
    );
    expect(actionSource).toContain("create: value.items ??");
  });

  it("prices outbound dispatches from the Catalog when the PO has none", () => {
    const syncSource = read("lib/mektek/finance-sync.ts");

    expect(syncSource).toContain("catalogItem: { select: { price: true } }");
    expect(syncSource).toContain("item.catalogItem?.price?.toString()");
  });

  it("keeps Monitoring PO free from item prices", () => {
    const logisticsSource = read("actions/mektek/logistics.ts");
    const outboundCreateSource = logisticsSource.slice(
      logisticsSource.indexOf(
        "export async function createMektekOutboundPurchaseOrder",
      ),
      logisticsSource.indexOf(
        "export async function recordMektekOutboundPurchaseOrderDispatch",
      ),
    );

    expect(outboundCreateSource.match(/agreedUnitPrice: null/g)).toHaveLength(2);
  });

  it("renders the invoice item rows and an auto-calculated pre-PPN value", () => {
    const managerSource = read(
      "app/[locale]/(routes)/mektek/finance/_components/InvoiceCrudManager.tsx",
    );

    expect(managerSource).toContain("Rincian item (qty &amp; harga)");
    expect(managerSource).toContain("Tambah item");
    expect(managerSource).toContain("function sumInvoiceItems");
    expect(managerSource).toContain("readOnly={itemsProvided}");
  });

  it("prefers the stored invoice lines over the snapshot in the PDF", () => {
    const pdfRoute = read(
      "app/api/mektek/finance/invoices/[id]/pdf/route.ts",
    );

    expect(pdfRoute).toContain("const hasItemDetail =");
    expect(pdfRoute).toContain(
      "hasItemDetail || sourceLines.length === 0 ? invoiceLines : sourceLines",
    );
  });
});
