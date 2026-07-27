import type { NextRequest } from "next/server";

import { canViewMektekFinance } from "@/lib/mektek/permissions";
import { parseSupplierPayableSnapshot } from "@/lib/mektek/supplier-payment";
import { prismadb } from "@/lib/prisma";
import { getRequestSessionUser } from "@/lib/request-session";

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
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{ sourceId: string; document: string }>;
  },
) {
  const user = await getRequestSessionUser(request);
  if (!user?.id || !canViewMektekFinance(user)) {
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
    select: {
      poNumber: true,
      signedPoImageData: true,
      signedPoImageMimeType: true,
      signedPoImageUpdatedAt: true,
      supplierInvoiceImageData: true,
      supplierInvoiceImageMimeType: true,
      supplierInvoiceImageUpdatedAt: true,
      deliveryNoteImageData: true,
      deliveryNoteImageMimeType: true,
      deliveryNoteImageUpdatedAt: true,
    },
  });
  if (!purchaseOrder) {
    return new Response("Purchase Order Receiving tidak ditemukan", {
      status: 404,
    });
  }

  const safePoNumber = safeDocumentName(purchaseOrder.poNumber);
  if (document === "purchase-order") {
    if (!purchaseOrder.signedPoImageData || !purchaseOrder.signedPoImageMimeType) {
      return new Response(
        "PO yang ditandatangani belum diunggah oleh Receiving",
        { status: 404 },
      );
    }
    const extension =
      purchaseOrder.signedPoImageMimeType === "image/png"
        ? "png"
        : purchaseOrder.signedPoImageMimeType === "image/webp"
          ? "webp"
          : "jpg";
    return new Response(Buffer.from(purchaseOrder.signedPoImageData), {
      headers: {
        "Content-Type": purchaseOrder.signedPoImageMimeType,
        "Content-Length": String(purchaseOrder.signedPoImageData.byteLength),
        "Content-Disposition": `inline; filename="po-ttd-${safePoNumber}.${extension}"`,
        "Cache-Control": "private, no-store",
        ETag: `"${purchaseOrder.signedPoImageUpdatedAt?.getTime() || 0}-${purchaseOrder.signedPoImageData.byteLength}"`,
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
