import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { buildFinancePurchaseOrderSuggestion } from "@/lib/mektek/finance-po";

describe("Finance invoice PO autocomplete", () => {
  it("maps an outbound Logistics PO into invoice fields and totals its priced items", () => {
    expect(
      buildFinancePurchaseOrderSuggestion({
        id: "po-1",
        poNumber: "123/PO/VII/2026",
        userName: "PT Pelanggan",
        projectName: "Site A",
        inputDate: new Date("2026-07-20T00:00:00.000Z"),
        dueDate: new Date("2026-08-20T00:00:00.000Z"),
        deliveryNoteNumber: "SJ-123",
        deliveryDate: new Date("2026-07-22T00:00:00.000Z"),
        items: [
          {
            position: 1,
            partName: "Jasa servis",
            partNumber: null,
            orderedQuantity: 2,
            agreedUnitPrice: "150000",
          },
          {
            position: 2,
            partName: "Filter",
            partNumber: "FLT-01",
            orderedQuantity: 3,
            agreedUnitPrice: "50000",
          },
        ],
      }),
    ).toEqual({
      id: "po-1",
      poNumber: "123/PO/VII/2026",
      poMode: "MANUAL",
      customerName: "PT Pelanggan",
      projectName: "Site A",
      purchaseOrderDate: "2026-07-20",
      dueDate: "2026-08-20",
      deliveryNoteNumber: "SJ-123",
      deliveryNoteDate: "2026-07-22",
      description:
        "Project: Site A\n1. Jasa servis × 2\n2. Filter (FLT-01) × 3",
      subtotal: "450000",
      pricingComplete: true,
      deliveryNotes: [],
      totalDeliveryNoteCount: 0,
    });
  });

  it("does not invent a partial subtotal when a PO line has no agreed price", () => {
    const result = buildFinancePurchaseOrderSuggestion({
      id: "po-2",
      poNumber: "PO-UNPRICED",
      userName: "PT Pelanggan",
      projectName: "Site B",
      inputDate: new Date("2026-07-20T00:00:00.000Z"),
      dueDate: new Date("2026-08-20T00:00:00.000Z"),
      deliveryNoteNumber: null,
      deliveryDate: null,
      items: [
        {
          position: 1,
          partName: "Spare part",
          partNumber: null,
          orderedQuantity: 1,
          agreedUnitPrice: null,
        },
      ],
    });

    expect(result.subtotal).toBe("");
    expect(result.pricingComplete).toBe(false);
  });

  it("renders a selectable suggestion menu and applies an exact PO match", () => {
    const source = readFileSync(
      resolve(
        process.cwd(),
        "app/[locale]/(routes)/mektek/finance/_components/InvoiceCrudManager.tsx",
      ),
      "utf8",
    );

    expect(source).toContain("searchFinancePurchaseOrders");
    expect(source).toContain('role="combobox"');
    expect(source).toContain('role="listbox"');
    expect(source).toContain('role="option"');
    expect(source).toContain("applyPurchaseOrder");
    expect(source).toContain("purchaseOrderNumber: option.poNumber");
    expect(source).toContain("customerName: option.customerName");
    expect(source).toContain("description: option.description");
    expect(source).toContain("subtotal: option.subtotal");
  });

  it("keeps multiple PO delivery notes as relational invoice sources", () => {
    const actionSource = readFileSync(
      resolve(process.cwd(), "actions/mektek/finance.ts"),
      "utf8",
    );
    const workspaceSource = readFileSync(
      resolve(
        process.cwd(),
        "app/[locale]/(routes)/mektek/finance/_components/FinanceWorkspace.tsx",
      ),
      "utf8",
    );
    const managerSource = readFileSync(
      resolve(
        process.cwd(),
        "app/[locale]/(routes)/mektek/finance/_components/InvoiceCrudManager.tsx",
      ),
      "utf8",
    );

    expect(actionSource).toContain("sourceIds?: string[]");
    expect(actionSource).toContain('sourceType: "OUTBOUND_DISPATCH"');
    expect(actionSource).toContain('status: "BILLED"');
    expect(workspaceSource).toContain("sources:");
    expect(managerSource).toContain("selectedInvoiceSources");
    expect(managerSource).toContain("removeInvoiceSource");
    expect(managerSource).toContain("Surat Jalan terpilih");
  });
});
