import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("July 22 Finance and Logistics revision", () => {
  it("keeps Monitoring PO focused on quantities without item prices", () => {
    const manager = read(
      "app/[locale]/(routes)/mektek/logistics/_components/OutboundLogisticsManager.tsx",
    );
    const action = read("actions/mektek/logistics.ts");
    const outboundStart = action.indexOf("createMektekOutboundPurchaseOrder");
    const outboundSection = action.slice(outboundStart);

    expect(manager).not.toContain("Harga satuan");
    expect(manager).not.toContain("Total harga");
    expect(manager).not.toContain("calculateLogisticsPurchaseOrderTotal");
    expect(outboundSection).not.toContain("requireUnitPrice: true");
    expect(action.match(/agreedUnitPrice: null/g)).toHaveLength(2);
  });

  it("filters Accounting recaps and keeps the existing Payment Faktur filter", () => {
    const workspace = read(
      "app/[locale]/(routes)/mektek/finance/_components/FinanceWorkspace.tsx",
    );
    const parts = read(
      "app/[locale]/(routes)/mektek/finance/_components/FinanceWorkspaceParts.tsx",
    );
    const paymentManager = read(
      "app/[locale]/(routes)/mektek/finance/_components/PaymentFakturManager.tsx",
    );

    expect(parts).toContain("function ReportFilter");
    expect(workspace).toContain("matchesReportQuery");
    expect(paymentManager).toContain(
      "Cari invoice, kwitansi, PO, faktur pajak, atau deskripsi",
    );
  });

  it("uses three-character Logistics PO suggestions in Payment Faktur", () => {
    const manager = read(
      "app/[locale]/(routes)/mektek/finance/_components/PaymentFakturManager.tsx",
    );

    expect(manager).toContain("shouldSearchFinancePurchaseOrders");
    expect(manager).toContain("searchFinancePurchaseOrders");
    expect(manager).toContain("buildPaymentFakturPurchaseOrderAutofill");
    expect(manager).toContain("Ketik minimal 3 karakter nomor PO");
    expect(manager).toContain('role="listbox"');
    expect(manager).toContain('role="option"');
  });

  it("records every requirement as completed in the revision handoff", () => {
    const revision = read("revision/july22.md");

    expect(revision).not.toContain("[ ]");
    expect(revision).toContain("PDF siap cetak dan ditandatangani");
    expect(revision).toContain("minimal 3 karakter");
  });
});
