import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { renderPurchaseOrderPreviewSvg } from "@/lib/mektek/purchase-order-preview-svg";

const source = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("supplier payment Finance workspace", () => {
  it("exposes the supplier-payment register in the Finance menu", () => {
    const menu = source(
      "app/[locale]/(routes)/components/menu-items/Mektek.tsx",
    );

    expect(menu).toContain("Pembayaran Pemasok");
    expect(menu).toContain("/mektek/finance/payables");
  });

  it("requires the three source documents and renders the notebook columns", () => {
    const manager = source(
      "app/[locale]/(routes)/mektek/finance/_components/SupplierPaymentManager.tsx",
    );

    for (const label of [
      "Purchase Order",
      "Invoice Pemasok",
      "Surat Jalan / Tanda Terima",
      "Tanggal",
      "Nama Supplier",
      "No. Invoice / No. SJ",
      "No. PO",
      "Grand Total",
    ]) {
      expect(manager).toContain(label);
    }
  });

  it("shows the Logistics receiving date as read-only synchronized data", () => {
    const manager = source(
      "app/[locale]/(routes)/mektek/finance/_components/SupplierPaymentManager.tsx",
    );
    const page = source(
      "app/[locale]/(routes)/mektek/finance/payables/page.tsx",
    );

    expect(manager).toContain("Tanggal terima Logistics");
    expect(manager).toContain("selected.receivedAt");
    expect(manager).toContain("readOnly");
    expect(manager).toContain("Tanggal terima:");
    expect(page).toContain("occurredAt: true");
    expect(page).toContain("receivedAt: dateOnly(source.occurredAt)");
  });

  it("links an incomplete price warning to its exact document detail", () => {
    const manager = source(
      "app/[locale]/(routes)/mektek/finance/_components/SupplierPaymentManager.tsx",
    );
    const detail = source(
      "app/[locale]/(routes)/mektek/finance/payables/sources/[sourceId]/page.tsx",
    );

    expect(manager).toContain("Dokumen yang perlu diperbaiki");
    expect(manager).toContain("/mektek/finance/payables/sources/");
    expect(manager).toContain("Lihat detail dokumen");
    expect(manager).toContain("/mektek/receiving?q=");
    expect(manager).toContain("Periksa dokumen di Receiving");
    expect(manager).toContain("&detail=");
    expect(detail).toContain("Dokumen yang perlu dilaporkan");
    expect(detail).toContain("Item tanpa harga");
    expect(detail).toContain("/mektek/receiving?q=");
    expect(detail).toContain("Lihat Purchase Order");
    expect(detail).toContain("Lihat Invoice Pemasok");
    expect(detail).toContain("Lihat Surat Jalan");
    expect(detail).toContain("&detail=");

    const receivingPage = source(
      "app/[locale]/(routes)/mektek/receiving/page.tsx",
    );
    const receivingManager = source(
      "app/[locale]/(routes)/mektek/receiving/_components/ReceivingManager.tsx",
    );
    expect(receivingPage).toContain("initialPurchaseOrderId");
    expect(receivingManager).toContain(
      "purchaseOrder.id === initialPurchaseOrderId",
    );
  });

  it("renders the three source documents inline without requiring a download", () => {
    const manager = source(
      "app/[locale]/(routes)/mektek/finance/_components/SupplierPaymentManager.tsx",
    );
    const page = source(
      "app/[locale]/(routes)/mektek/finance/payables/page.tsx",
    );
    const route = source(
      "app/api/mektek/finance/payables/sources/[sourceId]/documents/[document]/route.ts",
    );

    expect(manager).toContain("InlineDocumentPreview");
    expect(manager).not.toContain("<iframe");
    expect(manager).toContain("<Image");
    expect(manager).toContain("Klik untuk memperbesar");
    expect(manager).toContain("disabled={!document.available}");
    expect(manager).toContain("Pratinjau dokumen");
    expect(manager).toContain("supplierInvoiceImageAvailable");
    expect(manager).toContain("deliveryNoteImageAvailable");
    expect(page).toContain("supplierInvoiceImageUpdatedAt");
    expect(page).toContain("deliveryNoteImageUpdatedAt");
    expect(route).toContain("renderPurchaseOrderPreviewSvg");
    expect(route).toContain('"Content-Type": "image/svg+xml; charset=utf-8"');
  });

  it("renders the Purchase Order as a safe image document", () => {
    const svg = renderPurchaseOrderPreviewSvg({
      poNumber: "PO-2026-001",
      supplierName: "Supplier <Utama>",
      projectName: "MTL",
      userName: "Logistics",
      inputDate: new Date("2026-07-24T00:00:00.000Z"),
      dueDate: new Date("2026-08-24T00:00:00.000Z"),
      poType: "Normal",
      notes: "Periksa & kirim",
      items: [
        {
          position: 1,
          partName: "Kompresor",
          partNumber: "CMP-01",
          orderedQuantity: 2,
          unitPrice: 1_500_000,
        },
      ],
    });

    expect(svg).toContain("<svg");
    expect(svg).toContain("PURCHASE ORDER");
    expect(svg).toContain("PO-2026-001");
    expect(svg).toContain("Rp");
    expect(svg).toContain("Supplier &lt;Utama&gt;");
    expect(svg).toContain("Periksa &amp; kirim");
  });
});
