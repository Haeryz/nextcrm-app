jest.mock("@react-pdf/renderer", () => ({
  Document: "Document",
  Page: "Page",
  Text: "Text",
  View: "View",
  StyleSheet: { create: (styles: unknown) => styles },
  renderToBuffer: jest.fn(),
}));

import { buildMektekInvoiceData } from "@/actions/mektek/invoice-pdf";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const order = (tags: Record<string, unknown>) => ({
  id: "12345678-1234-1234-1234-123456789012",
  serviceNumber: "SRV-202607-0001",
  createdAt: new Date("2026-07-20T00:00:00.000Z"),
  content: "Servis",
  tags: {
    customerName: "Customer",
    serviceItems: [{ name: "Servis", quantity: 1, unitPrice: 100000, total: 100000 }],
    ...tags,
  },
});

describe("business and private invoice data", () => {
  it("uses the public service number for invoice and work-order references", () => {
    const invoice = buildMektekInvoiceData(order({ customerType: "STANDARD" }));

    expect(invoice.invoiceNumber).toBe("INV-202607-0001");
    expect(invoice.reference).toBe("SRV-202607-0001");
    expect(invoice.workOrder).toBe("SRV-202607-0001");
  });

  it("creates a private invoice without PPH or a tax-document attachment", () => {
    const invoice = buildMektekInvoiceData(
      order({ customerType: "STANDARD", ppnEnabled: true, pphEnabled: true }),
    );

    expect(invoice.customer.type).toBe("STANDARD");
    expect(invoice.financials.pph).toBe(0);
    expect(invoice.taxDocumentPlaceholder).toBe(false);
  });

  it("creates a business invoice with its tax-document placeholder", () => {
    const invoice = buildMektekInvoiceData(
      order({ customerType: "B2B", vehicleMileageKm: 125000 }),
    );

    expect(invoice.customer.type).toBe("B2B");
    expect(invoice.financials.pph).toBe(2000);
    expect(invoice.financials.grossInvoiceTotal).toBe(111000);
    expect(invoice.financials.netPayable).toBe(109000);
    expect(invoice.taxDocumentPlaceholder).toBe(true);
    expect(invoice.service.mileageKm).toBe(125000);
  });

  it("renders admin-only PPN and business-only PPH switches", () => {
    const paymentCard = readFileSync(
      resolve(
        process.cwd(),
        "app/[locale]/(routes)/mektek/_components/PaymentCard.tsx",
      ),
      "utf8",
    );
    const serviceOrders = readFileSync(
      resolve(process.cwd(), "actions/mektek/service-orders.ts"),
      "utf8",
    );

    expect(paymentCard).toMatch(/aria-label="Aktifkan PPN 11%"/);
    expect(paymentCard).toMatch(
      /customerType === "B2B"[\s\S]*aria-label="Aktifkan pemotongan PPh 23 sebesar 2%"/,
    );
    expect(paymentCard).toContain("PPh 23 dipotong 2%");
    expect(paymentCard).toContain("totalBeforePph - pphAmount");
    expect(paymentCard).toMatch(/disabled=\{isPending \|\| !canManageTaxSettings\}/);
    expect(serviceOrders).toMatch(
      /wantsTaxSettingChange[\s\S]*!session\.user\.isAdmin/,
    );
  });
});
