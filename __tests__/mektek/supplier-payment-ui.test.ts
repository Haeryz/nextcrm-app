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
});
