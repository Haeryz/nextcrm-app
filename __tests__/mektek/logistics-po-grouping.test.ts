import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("MekTek Logistics grouped Purchase Orders", () => {
  const managerSource = readFileSync(
    resolve(
      process.cwd(),
      "app/[locale]/(routes)/mektek/logistics/_components/LogisticsManager.tsx",
    ),
    "utf8",
  );
  const actionSource = readFileSync(
    resolve(process.cwd(), "actions/mektek/logistics.ts"),
    "utf8",
  );

  it("renders one spreadsheet history row for each Purchase Order", () => {
    expect(managerSource).not.toContain("purchaseOrders.flatMap");
    expect(managerSource).toContain("purchaseOrders.map((purchaseOrder, index)");
    expect(managerSource).toContain("Buka detail");
    expect(managerSource).toContain("Detail Part");
  });

  it("records one delivery-note number for multiple PO items", () => {
    expect(actionSource).toContain(
      "recordMektekLogisticsPurchaseOrderReceipt",
    );
    expect(managerSource).toContain(
      "recordMektekLogisticsPurchaseOrderReceipt",
    );
    expect(managerSource).toContain("Item dalam Surat Jalan");
    expect(managerSource).toContain("Simpan Surat Jalan");
  });
});
