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
  const editOutboundDialog = readFileSync(
    resolve(
      process.cwd(),
      "app/[locale]/(routes)/mektek/logistics/_components/EditOutboundPurchaseOrderDialog.tsx",
    ),
    "utf8",
  );
  const detailOutboundDialog = readFileSync(
    resolve(
      process.cwd(),
      "app/[locale]/(routes)/mektek/logistics/_components/DetailOutboundPurchaseOrderDialog.tsx",
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
  const receivingReceivingDialog = readFileSync(
    resolve(
      process.cwd(),
      "app/[locale]/(routes)/mektek/receiving/_components/DetailPurchaseOrderReceivingDialog.tsx",
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
    expect(detailOutboundDialog).toContain("Detail Purchase Order Monitoring");
  });

  it("lets users reopen and edit an existing Monitoring PO", () => {
    expect(actionSource).toContain("updateMektekOutboundPurchaseOrder");
    expect(outboundManager).toContain("updateMektekOutboundPurchaseOrder");
    expect(detailOutboundDialog).toContain("Edit PO");
    expect(editOutboundDialog).toContain("Simpan Perubahan PO");
  });

  it("records one Receiving batch for multiple selected PO items", () => {
    expect(actionSource).toContain("recordMektekReceivingPurchaseOrderReceipt");
    expect(receivingManager).toContain(
      "recordMektekReceivingPurchaseOrderReceipt",
    );
    expect(receivingReceivingDialog).toContain("Catat Barang Masuk");
    expect(receivingReceivingDialog).toContain("Simpan Penerimaan");
    expect(receivingReceivingDialog).toContain("Surat Jalan dari Supplier");
    expect(receivingReceivingDialog).toContain("Buat Surat Jalan Mektek");
  });
});
