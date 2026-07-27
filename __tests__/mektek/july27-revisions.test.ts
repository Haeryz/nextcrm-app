import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const readSource = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("27 July revisions", () => {
  const schema = readSource("prisma/schema.prisma");
  const deliveryNotePdf = readSource(
    "actions/mektek/logistics-delivery-note-pdf.ts",
  );
  const deliveryNoteRoute = readSource(
    "app/api/mektek/logistics/purchase-orders/[id]/delivery-note/route.ts",
  );
  const purchaseOrderPdf = readSource(
    "actions/mektek/logistics-purchase-order-pdf.tsx",
  );
  const receivingManager = readSource(
    "app/[locale]/(routes)/mektek/receiving/_components/ReceivingManager.tsx",
  );
  const logisticsActions = readSource("actions/mektek/logistics.ts");
  const itemPicker = readSource(
    "app/[locale]/(routes)/mektek/_components/CatalogOrManualItemPicker.tsx",
  );
  const outboundManager = readSource(
    "app/[locale]/(routes)/mektek/logistics/_components/OutboundLogisticsManager.tsx",
  );
  const serviceOrderForm = readSource(
    "app/[locale]/(routes)/mektek/_components/NewServiceOrderForm.tsx",
  );

  describe("Surat Jalan PDF", () => {
    it("drops the receiving right signature and the left-signature date line", () => {
      expect(deliveryNotePdf).not.toContain("Tanggal terima:");
      expect(deliveryNotePdf).toContain("Penerima");
      expect(deliveryNotePdf).toContain("Logistics MekTek");
      expect(deliveryNotePdf).toContain("data.isReceiving");
    });

    it("enlarges the top-right date to match the SURAT JALAN title", () => {
      expect(deliveryNotePdf).toMatch(
        /documentDate:\s*\{\s*fontFamily:\s*"Helvetica-Bold",\s*fontSize:\s*13\s*\}/,
      );
    });

    it("uses the JOBSITE/PROJECT label for Monitoring PO delivery notes", () => {
      expect(deliveryNotePdf).toContain("JOBSITE/PROJECT");
      expect(deliveryNoteRoute).toContain("isReceiving");
    });
  });

  describe("Purchase Order PDF remarks", () => {
    it("moves remarks to a per-item section at the bottom", () => {
      expect(purchaseOrderPdf).not.toContain('label="Remarks"');
      expect(purchaseOrderPdf).toContain("remarksBox");
      expect(purchaseOrderPdf).toContain("Remarks");
      expect(purchaseOrderPdf).toContain("item.note");
    });
  });

  describe("Receiving form", () => {
    it("renames the input date label to Tanggal Create", () => {
      expect(receivingManager).toContain("Tanggal Create");
      expect(receivingManager).not.toContain("Tanggal Input");
    });

    it("makes part number optional only for Receiving", () => {
      expect(logisticsActions).toContain("requireManualPartNumber");
      expect(logisticsActions).toMatch(
        /requireManualPartNumber !== false && !partNumber/,
      );
      expect(itemPicker).toContain("requireManualPartNumber");
      expect(itemPicker).toContain("Part Number{requireManualPartNumber ? \"\" : \" (opsional)\"}");
      expect(receivingManager).toContain("requireManualPartNumber={false}");
    });
  });

  describe("Monitoring PO create form", () => {
    it("restores an explicit Due Date field", () => {
      expect(outboundManager).toContain('htmlFor="outbound-due-date"');
      expect(outboundManager).toContain("Due Date");
    });
  });

  describe("Service order customer type", () => {
    it("lets staff pick the customer type from a Select", () => {
      expect(serviceOrderForm).toContain('id="customer-type"');
      expect(serviceOrderForm).toContain('<SelectItem value="STANDARD">Pelanggan standar</SelectItem>');
      expect(serviceOrderForm).toContain('<SelectItem value="B2B">Perusahaan</SelectItem>');
      expect(serviceOrderForm).not.toContain('readOnly\n    aria-readonly="true"');
    });
  });

  describe("Catalog minStock", () => {
    it("adds a per-item minStock column to the schema", () => {
      expect(schema).toMatch(/minStock\s+Int\s+@default\(0\)/);
    });
  });
});
