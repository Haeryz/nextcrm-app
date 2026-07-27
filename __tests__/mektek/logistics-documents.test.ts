import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const readSource = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("MekTek Logistics documents", () => {
  const schema = readSource("prisma/schema.prisma");
  const outboundManager = readSource(
    "app/[locale]/(routes)/mektek/logistics/_components/OutboundLogisticsManager.tsx",
  );
  const receivingManager = readSource(
    "app/[locale]/(routes)/mektek/receiving/_components/ReceivingManager.tsx",
  );
  const imageRoute = readSource(
    "app/api/mektek/logistics/receipts/[id]/image/route.ts",
  );
  const deliveryNoteRoute = readSource(
    "app/api/mektek/logistics/purchase-orders/[id]/delivery-note/route.ts",
  );
  const deliveryNotePdf = readSource(
    "actions/mektek/logistics-delivery-note-pdf.ts",
  );
  const purchaseOrderPdfRoute = readSource(
    "app/api/mektek/logistics/purchase-orders/[id]/pdf/route.ts",
  );
  const purchaseOrderPdf = readSource(
    "actions/mektek/logistics-purchase-order-pdf.tsx",
  );
  const whatsappSource = readSource(
    "actions/mektek/logistics-document-whatsapp.ts",
  );

  it("keeps item-condition photos on Receiving records", () => {
    expect(schema).toMatch(/imageData\s+Bytes\?/);
    expect(schema).toMatch(/imageMimeType\s+String\?/);
    expect(imageRoute).toContain("validateLogisticsReceiptImageUpload");
    expect(imageRoute).toContain("requireMektekLogisticsApiSession");
    expect(receivingManager).toContain("Foto Item");
    expect(receivingManager).toContain("receiptItemPhotos");
    expect(receivingManager).toContain('capture="environment"');
  });

  it("serves outbound delivery notes for every Monitoring PO status", () => {
    expect(deliveryNoteRoute).toContain("requireMektekLogisticsApiSession");
    expect(deliveryNoteRoute).toContain('flow: "OUTBOUND"');
    expect(deliveryNoteRoute).not.toContain('status: "CLOSED"');
    expect(deliveryNoteRoute).toContain('"Content-Type": "application/pdf"');
    expect(outboundManager).toContain("PDF Surat Jalan");
  });

  it("uses the MekTek delivery-note layout", () => {
    expect(deliveryNotePdf).toContain("PT. MEKTEK TANJUNG LESTARI");
    expect(deliveryNotePdf).toContain("SURAT JALAN");
    expect(deliveryNotePdf).toContain("DESCRIPTION");
    expect(deliveryNotePdf).toContain("PART NUMBER");
    expect(deliveryNotePdf).toContain("QTY");
    expect(deliveryNotePdf).not.toContain("Tanggal terima:");
  });

  it("drops the right signature only on Receiving delivery notes", () => {
    expect(deliveryNotePdf).toContain("Penerima");
    expect(deliveryNotePdf).toContain("Logistics MekTek");
    expect(deliveryNotePdf).toContain("isReceiving");
    expect(deliveryNoteRoute).toContain("isReceiving");
  });

  it("uses JOBSITE/PROJECT label on Monitoring PO delivery notes", () => {
    expect(deliveryNotePdf).toContain("JOBSITE/PROJECT");
  });

  it("limits Receiving documents to its PO PDF and required signatures", () => {
    expect(receivingManager).toContain("PDF PO");
    expect(receivingManager).toContain("WhatsApp PO");
    expect(receivingManager).not.toContain("WhatsApp DO");
    expect(purchaseOrderPdfRoute).toContain('flow: "RECEIVING"');
    expect(whatsappSource).toContain('documentType: "PO"');
    expect(whatsappSource).not.toContain('documentType: "PO" | "DO"');
    expect(purchaseOrderPdf).toContain("Dept. FA");
    expect(purchaseOrderPdf).toContain("Dept. Purch");
    expect(purchaseOrderPdf).toContain("Purchasing Adm.");
  });
});
