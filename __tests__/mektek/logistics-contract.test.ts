import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("MekTek Logistics implementation contract", () => {
  const schema = readFileSync(resolve(process.cwd(), "prisma/schema.prisma"), "utf8");
  const actionSource = readFileSync(
    resolve(process.cwd(), "actions/mektek/logistics.ts"),
    "utf8",
  );
  const pageSource = readFileSync(
    resolve(process.cwd(), "app/[locale]/(routes)/mektek/logistics/page.tsx"),
    "utf8",
  );
  const spreadsheetPageSource = readFileSync(
    resolve(
      process.cwd(),
      "app/[locale]/(routes)/mektek/logistics/spreadsheet/page.tsx",
    ),
    "utf8",
  );
  const managerSource = readFileSync(
    resolve(
      process.cwd(),
      "app/[locale]/(routes)/mektek/logistics/_components/LogisticsManager.tsx",
    ),
    "utf8",
  );

  it("stores PO headers, line items, and auditable receipt events", () => {
    expect(schema).toContain("model LogisticsPurchaseOrder {");
    expect(schema).toContain("model LogisticsPurchaseOrderItem {");
    expect(schema).toContain("model LogisticsReceipt {");
    expect(schema).toContain("@@unique([purchaseOrderItemId, deliveryNoteNumber])");
  });

  it("guards receipt increments transactionally and authorizes on the server", () => {
    expect(actionSource).toContain("canManageMektekLogistics");
    expect(actionSource).toContain("prismadb.$transaction");
    expect(actionSource).toMatch(/receivedQuantity:\s*\{\s*lte:/);
    expect(actionSource).toContain("validateLogisticsReceipt");
  });

  it("keeps the PO spreadsheet on a dedicated Logistics route", () => {
    expect(pageSource).toContain("listMektekLogisticsPurchaseOrders");
    expect(pageSource).toContain("/mektek/logistics/spreadsheet");
    expect(pageSource).toContain("<LogisticsManager");
    expect(pageSource).toContain('mode="overview"');
    expect(spreadsheetPageSource).toContain("listMektekLogisticsPurchaseOrders");
    expect(spreadsheetPageSource).toContain("<LogisticsManager");
    expect(spreadsheetPageSource).toContain('mode="spreadsheet"');
    expect(spreadsheetPageSource).toContain("Kembali ke Logistics");
    expect(managerSource).toContain("PO Open");
    expect(managerSource).toContain("PO Closed");
    expect(managerSource).toContain("Total QTY Sisa");
    expect(managerSource).toContain("PO Terlambat");
    expect(managerSource).toContain("Buat Purchase Order");
    expect(managerSource).toContain("Buka Spreadsheet PO");
    expect(managerSource).toContain("Riwayat Purchase Order");
    expect(managerSource).toContain("Detail Purchase Order");
    expect(managerSource).toContain("QTY Masuk");
    expect(managerSource).toContain("QTY Order");
    expect(managerSource).toContain("QTY Sisa");
    expect(managerSource).toContain("Nomor Surat Jalan");
  });
});
