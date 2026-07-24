import type { NextRequest } from "next/server";

import { authOptions } from "@/lib/auth";
import { canViewMektekFinance } from "@/lib/mektek/permissions";
import { renderPurchaseOrderPreviewSvg } from "@/lib/mektek/purchase-order-preview-svg";
import { parseSupplierPayableSnapshot } from "@/lib/mektek/supplier-payment";
import { prismadb } from "@/lib/prisma";
import { getServerSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SupplierDocument =
  | "purchase-order"
  | "supplier-invoice"
  | "delivery-note";

const isSupplierDocument = (value: string): value is SupplierDocument =>
  value === "purchase-order" ||
  value === "supplier-invoice" ||
  value === "delivery-note";

const safeDocumentName = (value: string) =>
  value.replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") ||
  "dokumen";

export async function GET(
  _request: NextRequest,
  {
    params,
  }: {
    params: Promise<{ sourceId: string; document: string }>;
  },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !canViewMektekFinance(session.user)) {
    return new Response("Forbidden", { status: 403 });
  }

  const { sourceId, document } = await params;
  if (!isSupplierDocument(document)) {
    return new Response("Jenis dokumen tidak valid", { status: 400 });
  }
  const source = await prismadb.financePayableSource.findUnique({
    where: { id: sourceId },
    select: { snapshot: true },
  });
  const snapshot = parseSupplierPayableSnapshot(source?.snapshot);
  if (!source || !snapshot.purchaseOrderId) {
    return new Response("Sumber dokumen tidak ditemukan", { status: 404 });
  }

  const purchaseOrder = await prismadb.logisticsPurchaseOrder.findFirst({
    where: { id: snapshot.purchaseOrderId, flow: "RECEIVING" },
    include: { items: { orderBy: { position: "asc" } } },
  });
  if (!purchaseOrder) {
    return new Response("Purchase Order Receiving tidak ditemukan", {
      status: 404,
    });
  }

  const safePoNumber = safeDocumentName(purchaseOrder.poNumber);
  if (document === "purchase-order") {
    const svg = renderPurchaseOrderPreviewSvg({
      ...purchaseOrder,
      items: purchaseOrder.items.map((item) => ({
        position: item.position,
        partName: item.partName,
        partNumber: item.partNumber,
        orderedQuantity: item.orderedQuantity,
        unitPrice: Number(item.agreedUnitPrice || 0),
      })),
    });
    return new Response(svg, {
      headers: {
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Content-Disposition": `inline; filename="purchase-order-${safePoNumber}.svg"`,
        "Cache-Control": "private, no-store",
        "Content-Security-Policy":
          "default-src 'none'; style-src 'unsafe-inline'; sandbox",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }

  const isSupplierInvoice = document === "supplier-invoice";
  const data = isSupplierInvoice
    ? purchaseOrder.supplierInvoiceImageData
    : purchaseOrder.deliveryNoteImageData;
  const mimeType = isSupplierInvoice
    ? purchaseOrder.supplierInvoiceImageMimeType
    : purchaseOrder.deliveryNoteImageMimeType;
  const updatedAt = isSupplierInvoice
    ? purchaseOrder.supplierInvoiceImageUpdatedAt
    : purchaseOrder.deliveryNoteImageUpdatedAt;
  if (!data || !mimeType) {
    return new Response(
      isSupplierInvoice
        ? "Invoice pemasok belum diunggah"
        : "Surat Jalan belum diunggah",
      { status: 404 },
    );
  }

  const label = isSupplierInvoice ? "invoice-pemasok" : "surat-jalan";
  const extension =
    mimeType === "image/png"
      ? "png"
      : mimeType === "image/webp"
        ? "webp"
        : "jpg";
  return new Response(Buffer.from(data), {
    headers: {
      "Content-Type": mimeType,
      "Content-Length": String(data.byteLength),
      "Content-Disposition": `inline; filename="${label}-${safePoNumber}.${extension}"`,
      "Cache-Control": "private, no-store",
      ETag: `"${updatedAt?.getTime() || 0}-${data.byteLength}"`,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
