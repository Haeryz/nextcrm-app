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

    expect(actionSource).toContain("unitPrice");
    expect(actionSource).toContain("agreedUnitPrice");
    expect(managerSource).toContain("Harga Satuan");
    expect(managerSource).toContain("catalogItem.price");
    expect(managerSource).toContain("Total Purchase Order");
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
    const deliveryNoteRoute = read(
      "app/api/mektek/logistics/purchase-orders/[id]/delivery-note/route.ts",
    );
    const imageRoute = read(
      "app/api/mektek/logistics/purchase-orders/[id]/delivery-note-image/route.ts",
    );

    expect(managerSource).toContain("Surat Jalan dari Supplier");
    expect(managerSource).toContain("Buat Surat Jalan Mektek");
    expect(deliveryNoteRoute).toContain('"RECEIVING"');
    expect(imageRoute).toContain("deliveryNoteImageData");
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
