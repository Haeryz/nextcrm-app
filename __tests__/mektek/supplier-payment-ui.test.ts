import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("supplier payment Finance workspace", () => {
  it("exposes the supplier-payment register in the Finance menu", () => {
    const menu = source(
      "app/[locale]/(routes)/components/menu-items/Mektek.tsx",
    );

    expect(menu).toContain("Pembayaran Pemasok");
    expect(menu).toContain("/mektek/finance/payables");
  });

  it("requires the three source documents and renders the notebook columns", () => {
    const manager = source(
      "app/[locale]/(routes)/mektek/finance/_components/SupplierPaymentManager.tsx",
    );

    for (const label of [
      "Purchase Order",
      "Invoice Pemasok",
      "Surat Jalan / Tanda Terima",
      "Tanggal",
      "Nama Supplier",
      "No. Invoice / No. SJ",
      "No. PO",
      "Grand Total",
    ]) {
      expect(manager).toContain(label);
    }
  });

  it("links an incomplete price warning to its exact document detail", () => {
    const manager = source(
      "app/[locale]/(routes)/mektek/finance/_components/SupplierPaymentManager.tsx",
    );
    const detail = source(
      "app/[locale]/(routes)/mektek/finance/payables/sources/[sourceId]/page.tsx",
    );

    expect(manager).toContain("Dokumen yang perlu diperbaiki");
    expect(manager).toContain("/mektek/finance/payables/sources/");
    expect(manager).toContain("Lihat detail dokumen");
    expect(detail).toContain("Dokumen yang perlu dilaporkan");
    expect(detail).toContain("Item tanpa harga");
    expect(detail).toContain("/mektek/receiving?q=");
    expect(detail).toContain("Lihat Purchase Order");
    expect(detail).toContain("Lihat Invoice Pemasok");
    expect(detail).toContain("Lihat Surat Jalan");
    expect(detail).toContain("&detail=");

    const receivingPage = source(
      "app/[locale]/(routes)/mektek/receiving/page.tsx",
    );
    const receivingManager = source(
      "app/[locale]/(routes)/mektek/receiving/_components/ReceivingManager.tsx",
    );
    expect(receivingPage).toContain("initialPurchaseOrderId");
    expect(receivingManager).toContain(
      "purchaseOrder.id === initialPurchaseOrderId",
    );
  });
});
