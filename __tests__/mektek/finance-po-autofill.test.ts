import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  buildFinancePurchaseOrderSuggestion,
  findExactFinancePurchaseOrderSuggestion,
  MIN_FINANCE_PURCHASE_ORDER_QUERY_LENGTH,
  shouldSearchFinancePurchaseOrders,
} from "@/lib/mektek/finance-po";

describe("Finance invoice PO autocomplete", () => {
  it("opens PO suggestions from three typed characters", () => {
    expect(MIN_FINANCE_PURCHASE_ORDER_QUERY_LENGTH).toBe(3);
    expect(shouldSearchFinancePurchaseOrders("12")).toBe(false);
    expect(shouldSearchFinancePurchaseOrders(" 123 ")).toBe(true);
  });

  it("finds an exact PO regardless of surrounding spaces or letter case", () => {
    const suggestion = buildFinancePurchaseOrderSuggestion({
      id: "po-exact",
      poNumber: "PO-ABC-123",
      userName: "PT Pelanggan",
      projectName: "",
      inputDate: new Date("2026-07-20T00:00:00.000Z"),
      dueDate: new Date("2026-08-20T00:00:00.000Z"),
      deliveryNoteNumber: null,
      deliveryDate: null,
      items: [],
    });

    expect(
      findExactFinancePurchaseOrderSuggestion(
        [suggestion],
        "  po-abc-123  ",
      ),
    ).toBe(suggestion);
  });

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
      items: [
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
      ],
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

    const deliveryNoteSelection = source.slice(
      source.indexOf("if (option.deliveryNotes.length)"),
      source.indexOf("setForm((current)", source.indexOf("if (option.deliveryNotes.length)")),
    );
    expect(deliveryNoteSelection).toContain(
      "setAppliedPurchaseOrderQuery(option.poNumber)",
    );
    expect(deliveryNoteSelection).not.toContain(
      'setPurchaseOrderQuery("")',
    );
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
