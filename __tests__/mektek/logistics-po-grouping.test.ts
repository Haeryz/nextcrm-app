import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("MekTek Purchase Order grouping", () => {
  const outboundManager = readFileSync(
    resolve(
      process.cwd(),
      "app/[locale]/(routes)/mektek/logistics/_components/OutboundLogisticsManager.tsx",
    ),
    "utf8",
  );
  const receivingManager = readFileSync(
    resolve(
      process.cwd(),
      "app/[locale]/(routes)/mektek/receiving/_components/ReceivingManager.tsx",
    ),
    "utf8",
  );
  const actionSource = readFileSync(
    resolve(process.cwd(), "actions/mektek/logistics.ts"),
    "utf8",
  );

  it("renders one outbound history row for each Purchase Order", () => {
    expect(outboundManager).not.toContain("purchaseOrders.flatMap");
    expect(outboundManager).toContain("purchaseOrders.map((purchaseOrder)");
    expect(outboundManager).toContain("Detail Purchase Order Monitoring");
  });

  it("lets users reopen and edit an existing Monitoring PO", () => {
    expect(actionSource).toContain("updateMektekOutboundPurchaseOrder");
    expect(outboundManager).toContain("updateMektekOutboundPurchaseOrder");
    expect(outboundManager).toContain("Edit PO");
    expect(outboundManager).toContain("Simpan Perubahan PO");
  });

  it("records one Receiving batch for multiple selected PO items", () => {
    expect(actionSource).toContain("recordMektekReceivingPurchaseOrderReceipt");
    expect(receivingManager).toContain(
      "recordMektekReceivingPurchaseOrderReceipt",
    );
    expect(receivingManager).toContain("Catat Barang Masuk");
    expect(receivingManager).toContain("Simpan Penerimaan");
    expect(receivingManager).toContain("Surat Jalan dari Supplier");
    expect(receivingManager).toContain("Buat Surat Jalan Mektek");
  });
});
