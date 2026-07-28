import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const readSource = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("MekTek Logistics and Receiving implementation contract", () => {
  const schema = readSource("prisma/schema.prisma");
  const actionSource = readSource("actions/mektek/logistics.ts");
  const outboundManager = readSource(
    "app/[locale]/(routes)/mektek/logistics/_components/OutboundLogisticsManager.tsx",
  );
  const outboundPage = readSource(
    "app/[locale]/(routes)/mektek/logistics/page.tsx",
  );
  const outboundSpreadsheetPage = readSource(
    "app/[locale]/(routes)/mektek/logistics/spreadsheet/page.tsx",
  );
  const receivingManager = readSource(
    "app/[locale]/(routes)/mektek/receiving/_components/ReceivingManager.tsx",
  );
  const receivingPage = readSource(
    "app/[locale]/(routes)/mektek/receiving/page.tsx",
  );
  const picActionSource = readSource("actions/mektek/logistics-pics.ts");
  const picPageSource = readSource(
    "app/[locale]/(routes)/mektek/receiving/pics/page.tsx",
  );

  it("separates inbound Receiving from outbound Monitoring PO", () => {
    expect(schema).toContain("enum LogisticsPurchaseOrderFlow");
    expect(schema).toMatch(/flow\s+LogisticsPurchaseOrderFlow/);
    expect(actionSource).toContain("listMektekReceivingPurchaseOrders");
    expect(actionSource).toContain("listMektekOutboundPurchaseOrders");
    expect(receivingPage).toContain("listMektekReceivingPurchaseOrders");
    expect(outboundManager).toContain("createMektekOutboundPurchaseOrder");
  });

  it("names the standard Monitoring PO supply mode Manual", () => {
    expect(outboundManager).toContain('poType: "Manual"');
    expect(outboundManager).toContain(
      '<SelectItem value="Manual">Manual · one-off PO</SelectItem>',
    );
    expect(actionSource).toContain(
      'requestedMode === "CONSIGNMENT" ? "Consignment" : "Manual"',
    );
  });

  it("links both flows to Catalog and the shared stock ledger", () => {
    expect(schema).toMatch(/catalogItemId\s+String\?/);
    expect(schema).toMatch(/source\s+CatalogStockMovementSource/);
    expect(actionSource).toContain("applyCatalogStockMovement");
    expect(actionSource).toContain('source: "RECEIVING"');
    expect(actionSource).toContain('source: "OUTBOUND_PO"');
  });

  it("keeps Receiving notes and warehouses scoped to each item", () => {
    expect(actionSource).toContain("note: boundedText(item?.note, MAX_NOTE_LEN)");
    expect(actionSource).toContain("warehouse: item?.warehouse");
    expect(receivingManager).toContain(
      "id={`logistics-receipt-note-${item.id}`}",
    );
    expect(receivingManager).toContain(
      "Keterangan ini hanya berlaku untuk item ini.",
    );
    expect(receivingManager).toContain("Surat Jalan dari Supplier");
  });

  it("captures Machine and the destination warehouse for manual Receiving items", () => {
    expect(schema).toMatch(/machine\s+String\?/);
    expect(actionSource).toContain("requireManualMachine: true");
    expect(actionSource).toContain("requireManualWarehouse: true");
    expect(receivingManager).toContain("receiving-machine-");
    expect(receivingManager).toContain("Gudang Tujuan");
    expect(receivingManager).toContain("item.warehouse ?? \"REAR\"");
  });

  it("keeps purchase-order payloads serializable across the server-client boundary", () => {
    expect(receivingPage).toMatch(
      /price:\s+catalogItem\.price == null \? null : Number\(catalogItem\.price\)/,
    );
    expect(receivingPage).toContain(
      "agreedUnitPrice: item.agreedUnitPrice?.toString() ?? null",
    );
    expect(actionSource).not.toContain("return { data: purchaseOrder };");
  });

  it("preserves agreed prices while normalizing purchase-order lines", () => {
    expect(actionSource).toContain(
      "agreedUnitPrice: agreedUnitPrice ?? manualUnitPrice",
    );
    expect(actionSource).toMatch(
      /catalogItemId,\s+orderedQuantity,\s+unitPrice: agreedUnitPrice,\s+agreedUnitPrice,/,
    );
  });

  it("keeps Monitoring PO free from item prices", () => {
    const outboundCreateSource = actionSource.slice(
      actionSource.indexOf("export async function createMektekOutboundPurchaseOrder"),
      actionSource.indexOf(
        "export async function recordMektekOutboundPurchaseOrderDispatch",
      ),
    );

    expect(outboundManager).not.toContain("agreedUnitPrice");
    expect(outboundManager).not.toContain("Harga satuan");
    expect(outboundManager).not.toContain("Total harga");
    expect(outboundPage).not.toContain("agreedUnitPrice: item.agreedUnitPrice");
    expect(outboundSpreadsheetPage).not.toContain(
      "agreedUnitPrice: item.agreedUnitPrice",
    );
    expect(outboundCreateSource).not.toContain("requireUnitPrice");
    expect(outboundCreateSource.match(/agreedUnitPrice: null/g)).toHaveLength(2);
  });

  it("creates and exposes a delivery note for each outbound batch", () => {
    expect(actionSource).toContain("buildOutboundDeliveryNoteNumber");
    expect(actionSource).toContain("const reference = deliveryNoteNumber");
    expect(actionSource).toContain("recordMektekOutboundPurchaseOrderDispatch");
    expect(outboundManager).toContain("Nomor Surat Jalan");
    expect(outboundManager).toContain("Simpan Barang Keluar");
    expect(outboundManager).toContain("PDF Surat Jalan");
  });

  it("grants Receiving PIC management to Logistics staff", () => {
    expect(picPageSource).toContain("await requireMektekLogisticsPicsStaff()");
    expect(picPageSource).toContain("createMektekLogisticsPic");
    expect(picPageSource).toContain("updateMektekLogisticsPic");
    expect(picPageSource).toContain("deleteMektekLogisticsPic");
    expect(picActionSource.match(/await requireMektekLogisticsPicsStaff\(\)/g)).toHaveLength(3);
    expect(picActionSource).not.toContain("requireAdmin");
    expect(receivingManager).toContain("Kelola PIC");
  });
});
