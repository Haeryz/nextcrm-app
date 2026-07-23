import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

const readSource = (path: string) => readFileSync(join(root, path), "utf8");

describe("operations page UI contracts", () => {
  it("starts stock movements from the item name instead of calendar cells", () => {
    const source = readSource(
      "app/[locale]/(routes)/mektek/items/_components/CatalogInventoryPanel.tsx",
    );

    expect(source).toContain("Catat mutasi stok untuk");
    expect(source).toContain("openMovement(item)");
    expect(source).not.toContain("Catat mutasi tanggal");
    expect(source).not.toContain("SelectTrigger aria-label=\"Item\"");
  });

  it("groups item and purchase-order actions in their respective toolbars", () => {
    const itemsPage = readSource(
      "app/[locale]/(routes)/mektek/items/page.tsx",
    );
    const itemManager = readSource(
      "app/[locale]/(routes)/mektek/items/_components/CatalogItemManager.tsx",
    );
    const logisticsPage = readSource(
      "app/[locale]/(routes)/mektek/logistics/page.tsx",
    );
    const logisticsManager = readSource(
      "app/[locale]/(routes)/mektek/logistics/_components/OutboundLogisticsManager.tsx",
    );
    const receivingManager = readSource(
      "app/[locale]/(routes)/mektek/receiving/_components/ReceivingManager.tsx",
    );

    expect(itemsPage).toContain("spreadsheetHref=");
    expect(itemManager).toContain("Buka Spreadsheet Inventory");
    expect(itemManager).toContain("Tambah Spare Part");
    expect(itemManager).toContain("createMektekCatalogItem");
    expect(itemManager).toContain("flex w-full gap-2 sm:w-auto");

    expect(logisticsPage).toContain("OutboundLogisticsManager");
    expect(logisticsManager).toContain("Simpan Barang Keluar");
    expect(receivingManager).toContain("managePicsHref?: string");
    expect(receivingManager).toContain("Kelola PIC");
    expect(receivingManager).toContain("flex flex-wrap items-center");
  });

  it("presents the technician directory with labeled cards and status context", () => {
    const source = readSource(
      "app/[locale]/(routes)/mektek/technicians/page.tsx",
    );

    expect(source).toContain("Daftar Technician");
    expect(source).toContain("Technician aktif");
    expect(source).toContain("CardHeader");
    expect(source).toContain("Badge");
    expect(source).toContain("Label htmlFor=");
    expect(source).toContain("Simpan perubahan");
  });
});
