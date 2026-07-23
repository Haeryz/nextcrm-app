import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("22 July Logistics revision contract", () => {
  const schema = source("prisma/schema.prisma");
  const menu = source("app/[locale]/(routes)/components/menu-items/Mektek.tsx");
  const logisticsActions = source("actions/mektek/logistics.ts");
  const receivingPage = source("app/[locale]/(routes)/mektek/receiving/page.tsx");
  const receivingManager = source(
    "app/[locale]/(routes)/mektek/receiving/_components/ReceivingManager.tsx",
  );
  const outboundManager = source(
    "app/[locale]/(routes)/mektek/logistics/_components/OutboundLogisticsManager.tsx",
  );
  const logisticsPage = source(
    "app/[locale]/(routes)/mektek/logistics/page.tsx",
  );
  const itemPicker = source(
    "app/[locale]/(routes)/mektek/_components/CatalogOrManualItemPicker.tsx",
  );
  const purchaseOrderPdf = source(
    "actions/mektek/logistics-purchase-order-pdf.tsx",
  );
  const catalogManager = source(
    "app/[locale]/(routes)/mektek/items/_components/CatalogItemManager.tsx",
  );
  const inventoryPanel = source(
    "app/[locale]/(routes)/mektek/items/_components/CatalogInventoryPanel.tsx",
  );
  const exportRoute = source(
    "app/api/mektek/logistics/purchase-orders/export/route.ts",
  );

  it("separates outbound Monitoring PO from inbound Receiving", () => {
    expect(schema).toContain("enum LogisticsPurchaseOrderFlow");
    expect(schema).toContain("flow               LogisticsPurchaseOrderFlow");
    expect(logisticsActions).toContain('flow: "OUTBOUND"');
    expect(logisticsActions).toContain('flow: "RECEIVING"');
    expect(receivingPage).toContain("Receiving");
  });

  it("links both flows to the shared Catalog stock ledger", () => {
    expect(schema).toContain("catalogItemId");
    expect(schema).toMatch(/source\s+CatalogStockMovementSource/);
    expect(logisticsActions).toContain("applyCatalogStockMovement");
    expect(outboundManager).toContain("catalogItemId");
    expect(receivingManager).toContain("catalogItemId");
  });

  it("uses one Catalog/manual picker in Receiving and Monitoring PO", () => {
    expect(receivingManager).toContain("CatalogOrManualItemPicker");
    expect(outboundManager).toContain("CatalogOrManualItemPicker");
    expect(itemPicker).toContain('role="combobox"');
    expect(itemPicker).toContain("Cari Catalog");
    expect(itemPicker).toContain("Input Manual");
    expect(itemPicker).toContain("Contoh: Aki atau 992");
    expect(itemPicker).toContain(
      "Item manual tidak mengubah stok Catalog",
    );
  });

  it("keeps both item-entry dialogs comfortable and avoids nested scrolling", () => {
    expect(itemPicker).toContain("Item Catalog terpilih");
    expect(itemPicker).toContain("Ganti item");
    expect(itemPicker).toContain("Gunakan Input Manual");
    expect(itemPicker).toContain("Cari berdasarkan nama atau part number");
    expect(receivingManager).not.toContain('max-h-[24rem]');
    expect(outboundManager).not.toContain('max-h-[22rem]');
  });

  it("removes USER/PT from Receiving creation while retaining it in Monitoring PO", () => {
    expect(receivingManager).not.toContain('htmlFor="logistics-user"');
    expect(receivingManager).not.toContain('id="logistics-user"');
    expect(receivingManager).not.toContain("User / PT");
    expect(purchaseOrderPdf).not.toContain("User / PT");
    expect(outboundManager).toContain("User / PT Tujuan");
  });

  it("exposes one Logistics menu with the three requested destinations", () => {
    expect(menu).toContain('title: "Catalog / Item"');
    expect(menu).toContain('title: "Monitoring PO"');
    expect(menu).toContain('title: "Receiving"');
    expect(menu).toContain('url: "/mektek/receiving"');
  });

  it("uses a user-entered Surat Jalan number for each outbound batch", () => {
    expect(logisticsActions).toContain("deliveryNoteNumber");
    expect(logisticsActions).toContain(
      "recordMektekOutboundPurchaseOrderDispatch",
    );
    expect(outboundManager).toContain("Nomor Surat Jalan");
    expect(outboundManager).toContain("dispatchReference");
    expect(outboundManager).toContain("PDF Surat Jalan");
    expect(receivingManager).not.toContain("Surat Jalan");
  });

  it("keeps the PO number separate and only exposes PDFs inside dispatch history", () => {
    expect(logisticsActions).not.toContain("buildAutomaticDeliveryNoteNumber");
    expect(outboundManager).toContain(
      "delivery-note?reference=${encodeURIComponent(batch.dispatchReference)}",
    );
    expect(outboundManager).not.toContain(
      "delivery-note`",
    );
  });

  it("uses the requested three approval roles on Receiving purchase orders", () => {
    expect(purchaseOrderPdf).toContain("Finance Accounting");
    expect(purchaseOrderPdf).toContain("Department Purchasing");
    expect(purchaseOrderPdf).toContain("Purchasing Admin");
  });

  it("restores Catalog item creation while retaining inventory mutation", () => {
    expect(catalogManager).toContain("Tambah Spare Part");
    expect(catalogManager).toContain("createMektekCatalogItem");
    expect(inventoryPanel).toContain("Catat Mutasi Stok");
  });

  it("captures one Receiving photo per received item and supports mobile camera input", () => {
    expect(receivingManager).toContain("receiptItemPhotos");
    expect(receivingManager).toContain('capture="environment"');
    expect(receivingManager).toContain("Foto Item");
    expect(receivingManager).toContain("receipt.imageMimeType");
  });

  it("links manual Receiving entries into Catalog stock", () => {
    expect(logisticsActions).toContain("ensureManualReceivingCatalogItem");
    expect(receivingManager).toContain(
      "otomatis ditambahkan ke Catalog / Item",
    );
  });

  it("places month and spreadsheet filters inside the stock-card surface", () => {
    expect(inventoryPanel).toContain('id="inventory-month"');
    expect(inventoryPanel).toContain("Filter & periode kartu stok");
    expect(inventoryPanel).toContain("Kartu stok sparepart");
  });

  it("exports outbound SJ or PO recap for one selected month", () => {
    expect(exportRoute).toContain('searchParams.get("type")');
    expect(exportRoute).toContain('searchParams.get("month")');
    expect(exportRoute).toContain("buildLogisticsDeliveryNoteExportRows");
    expect(exportRoute).toContain("buildLogisticsPoMonthlyExportRows");
    expect(exportRoute).toContain("application/vnd.openxmlformats");
    expect(outboundManager).toContain("Export Excel");
    expect(outboundManager).toContain("Recap Bulanan (SJ)");
    expect(outboundManager).toContain("Recap PO Bulanan (PO/User)");
  });

  it("moves export and created-PO filters into the Monitoring PO page", () => {
    expect(logisticsPage).toContain('name="q"');
    expect(logisticsPage).toContain('name="status"');
    expect(logisticsPage).toContain("Reset Filter");
    expect(logisticsPage).toContain("query,");
    expect(logisticsPage).toContain("status,");
    expect(outboundManager).toContain("Export Excel Monitoring PO");
    expect(outboundManager).not.toContain("spreadsheetHref");
  });

  it("tracks partial outbound fulfillment like Receiving", () => {
    expect(logisticsActions).toContain(
      "recordMektekOutboundPurchaseOrderDispatch",
    );
    expect(outboundManager).toContain("QTY Order");
    expect(outboundManager).toContain("QTY Keluar");
    expect(outboundManager).toContain("QTY Sisa");
    expect(outboundManager).toContain("Catat Barang Keluar");
    expect(outboundManager).toContain("Riwayat Barang Keluar");
  });
});
