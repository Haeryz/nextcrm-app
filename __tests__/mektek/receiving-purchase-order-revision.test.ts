import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("Receiving Purchase Order revision", () => {
  it("keeps catalog and manual unit prices on Receiving PO lines", () => {
    const actionSource = read("actions/mektek/logistics.ts");
    const managerSource = read(
      "app/[locale]/(routes)/mektek/receiving/_components/ReceivingManager.tsx",
    );
    const createDialogSource = read(
      "app/[locale]/(routes)/mektek/receiving/_components/CreatePurchaseOrderDialog.tsx",
    );

    expect(actionSource).toContain("unitPrice");
    expect(actionSource).toContain("agreedUnitPrice");
    expect(createDialogSource).toContain("Harga Supplier");
    expect(createDialogSource).toContain("Total Purchase Order");
  });

  it("shows the spreadsheet workflow directly on the Receiving page", () => {
    const pageSource = read(
      "app/[locale]/(routes)/mektek/receiving/page.tsx",
    );
    const spreadsheetPageSource = read(
      "app/[locale]/(routes)/mektek/receiving/spreadsheet/page.tsx",
    );
    const managerSource = read(
      "app/[locale]/(routes)/mektek/receiving/_components/ReceivingManager.tsx",
    );

    expect(pageSource).toContain("Export Excel");
    expect(pageSource).toContain('mode="combined"');
    expect(spreadsheetPageSource).toContain("redirect(");
    expect(managerSource).not.toContain("Riwayat Purchase Order");
  });

  it("supports supplier delivery-note images and Mektek-generated delivery notes", () => {
    const managerSource = read(
      "app/[locale]/(routes)/mektek/receiving/_components/ReceivingManager.tsx",
    );
    const dialogSource = read(
      "app/[locale]/(routes)/mektek/receiving/_components/DetailPurchaseOrderReceivingDialog.tsx",
    );
    const deliveryNoteRoute = read(
      "app/api/mektek/logistics/purchase-orders/[id]/delivery-note/route.ts",
    );
    const imageRoute = read(
      "app/api/mektek/logistics/purchase-orders/[id]/delivery-note-image/route.ts",
    );

    expect(dialogSource).toContain("Surat Jalan dari Supplier");
    expect(dialogSource).toContain("Buat Surat Jalan Mektek");
    expect(deliveryNoteRoute).toContain('"RECEIVING"');
    expect(imageRoute).toContain("deliveryNoteImageData");
  });

  it("shows ordered Receiving document groups including supplier Faktur", () => {
    const managerSource = read(
      "app/[locale]/(routes)/mektek/receiving/_components/ReceivingManager.tsx",
    );
    const dialogSource = read(
      "app/[locale]/(routes)/mektek/receiving/_components/DetailPurchaseOrderReceivingDialog.tsx",
    );
    const invoiceImageRoute = read(
      "app/api/mektek/logistics/purchase-orders/[id]/supplier-invoice-image/route.ts",
    );
    const labels = [
      "PDF Purchase Order",
      "Faktur dari Supplier",
      "Surat Jalan dari Supplier",
      "Buat Surat Jalan Mektek",
    ];

    const documentSectionStart = dialogSource.indexOf(
      '<CardTitle className="text-base">Dokumen Receiving</CardTitle>',
    );
    const documentSection = dialogSource.slice(
      documentSectionStart,
      dialogSource.indexOf("</CardContent>", documentSectionStart),
    );
    const positions = labels.map((label) => documentSection.indexOf(label));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    expect(documentSection).toContain("Lihat Faktur");
    expect(documentSection).toContain("Ganti Faktur");
    expect(invoiceImageRoute).toContain("supplierInvoiceImageData");
    expect(managerSource).toContain("supplier-invoice-image");
  });

  it("persists whether the Receiving delivery note comes from supplier or Mektek", () => {
    const schemaSource = read("prisma/schema.prisma");
    const managerSource = read(
      "app/[locale]/(routes)/mektek/receiving/_components/ReceivingManager.tsx",
    );
    const dialogSource = read(
      "app/[locale]/(routes)/mektek/receiving/_components/DetailPurchaseOrderReceivingDialog.tsx",
    );
    const deliveryNoteRoute = read(
      "app/api/mektek/logistics/purchase-orders/[id]/delivery-note/route.ts",
    );
    const supplierImageRoute = read(
      "app/api/mektek/logistics/purchase-orders/[id]/delivery-note-image/route.ts",
    );

    expect(schemaSource).toMatch(
      /receivingDeliveryNoteSource\s+LogisticsReceivingDeliveryNoteSource\?/,
    );
    expect(dialogSource).toContain("Pilih sumber Surat Jalan");
    expect(dialogSource).toContain("Pilih dokumen ini");
    expect(dialogSource).toContain("Cetak Surat Jalan");
    expect(dialogSource).toContain(
      "Unggah Surat Jalan yang Sudah Ditandatangani",
    );
    expect(deliveryNoteRoute).toContain('receivingDeliveryNoteSource: "MEKTEK"');
    expect(supplierImageRoute).toContain(
      'receivingDeliveryNoteSource: "SUPPLIER"',
    );
    expect(supplierImageRoute).toContain("export async function PATCH");
  });

  it("renders PO prices, amounts, and a subtotal in the PDF", () => {
    const pdfSource = read(
      "actions/mektek/logistics-purchase-order-pdf.tsx",
    );

    expect(pdfSource).toContain("unitPrice");
    expect(pdfSource).toContain("amount");
    expect(pdfSource).toContain("Sub Total");
  });
});
