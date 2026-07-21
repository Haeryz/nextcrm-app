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
  const picActionSource = readFileSync(
    resolve(process.cwd(), "actions/mektek/logistics-pics.ts"),
    "utf8",
  );
  const picPageSource = readFileSync(
    resolve(
      process.cwd(),
      "app/[locale]/(routes)/mektek/logistics/pics/page.tsx",
    ),
    "utf8",
  );
  const picMigration = readFileSync(
    resolve(
      process.cwd(),
      "prisma/migrations/20260721170000_logistics_receipt_pic/migration.sql",
    ),
    "utf8",
  );

  it("stores PO headers, line items, and auditable receipt events", () => {
    expect(schema).toContain("model LogisticsPurchaseOrder {");
    expect(schema).toContain("model LogisticsPurchaseOrderItem {");
    expect(schema).toContain("model LogisticsReceipt {");
    expect(schema).toContain("@@unique([purchaseOrderItemId, deliveryNoteNumber])");
  });

  it("requires a PIC on each shipment and seeds the temporary directory", () => {
    expect(schema).toContain("model LogisticsPic {");
    expect(schema).toContain("picId               String   @db.Uuid");
    expect(schema).toContain("pic               LogisticsPic");
    expect(picMigration).toContain("'PIC 1'");
    expect(picMigration).toContain("'PIC 2'");
    expect(picMigration).toContain("'PIC 3'");
    expect(picMigration).toContain('ALTER COLUMN "picId" SET NOT NULL');
    expect(managerSource).toContain('PIC: {receipt.pic.name}');
    expect(managerSource).toContain('htmlFor="logistics-receipt-pic"');
  });

  it("keeps PIC CRUD exclusive to the main admin", () => {
    expect(picPageSource).toContain("await requireAdmin()");
    expect(picPageSource).toContain("createMektekLogisticsPic");
    expect(picPageSource).toContain("updateMektekLogisticsPic");
    expect(picPageSource).toContain("deleteMektekLogisticsPic");
    expect(picActionSource.match(/await requireAdmin\(\)/g)).toHaveLength(3);
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

  it("limits PO Type and scrolls only the ordered-parts list", () => {
    expect(managerSource).toContain('<SelectItem value="Normal">Normal</SelectItem>');
    expect(managerSource).toContain(
      '<SelectItem value="Consignment">Consignment</SelectItem>',
    );
    expect(managerSource).toContain("max-h-[18rem]");
    expect(managerSource).toContain("overflow-y-auto overscroll-contain");
  });
});
