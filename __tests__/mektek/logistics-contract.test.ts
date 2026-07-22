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
    expect(schema).toContain("flow               LogisticsPurchaseOrderFlow");
    expect(actionSource).toContain("listMektekReceivingPurchaseOrders");
    expect(actionSource).toContain("listMektekOutboundPurchaseOrders");
    expect(receivingPage).toContain("listMektekReceivingPurchaseOrders");
    expect(outboundManager).toContain("createMektekOutboundPurchaseOrder");
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
    expect(receivingManager).not.toContain("Surat Jalan");
  });

  it("creates and exposes a delivery note for each outbound batch", () => {
    expect(actionSource).toContain("buildOutboundDispatchReference");
    expect(actionSource).toContain("recordMektekOutboundPurchaseOrderDispatch");
    expect(outboundManager).toContain("Simpan Barang Keluar");
    expect(outboundManager).toContain("PDF Surat Jalan");
  });

  it("keeps Receiving PIC management exclusive to the main admin", () => {
    expect(picPageSource).toContain("await requireAdmin()");
    expect(picPageSource).toContain("createMektekLogisticsPic");
    expect(picPageSource).toContain("updateMektekLogisticsPic");
    expect(picPageSource).toContain("deleteMektekLogisticsPic");
    expect(picActionSource.match(/await requireAdmin\(\)/g)).toHaveLength(3);
    expect(receivingManager).toContain("Kelola PIC");
  });
});
