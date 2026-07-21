import type { NextRequest } from "next/server";

import { renderMektekDeliveryNotePdf } from "@/actions/mektek/logistics-delivery-note-pdf";
import { requireMektekLogisticsApiSession } from "@/lib/mektek/logistics-api";
import { prismadb } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const access = await requireMektekLogisticsApiSession();
  if (access.response) return access.response;

  const { id } = await context.params;
  const ip = getClientIp(request.headers);
  const rateLimit = checkRateLimit(`logistics-delivery-note:${ip}:${id}`, 20, 10 * 60 * 1000);
  if (!rateLimit.ok) {
    return new Response("Terlalu banyak Request", {
      status: 429,
      headers: { "Retry-After": String(Math.ceil(rateLimit.retryAfterMs / 1000)) },
    });
  }

  const sourceReceipt = await prismadb.logisticsReceipt.findUnique({
    where: { id },
    select: {
      deliveryNoteNumber: true,
      receivedAt: true,
      purchaseOrderItem: {
        select: {
          purchaseOrderId: true,
          status: true,
          purchaseOrder: {
            select: {
              poNumber: true,
              userName: true,
              projectName: true,
            },
          },
        },
      },
    },
  });
  if (!sourceReceipt) {
    return new Response("Riwayat penerimaan tidak ditemukan", { status: 404 });
  }
  if (sourceReceipt.purchaseOrderItem.status !== "CLOSED") {
    return new Response("PDF Surat Jalan tersedia setelah item PO berstatus Closed", {
      status: 409,
      headers: { "Cache-Control": "private, no-store" },
    });
  }

  const relatedReceipts = await prismadb.logisticsReceipt.findMany({
    where: {
      deliveryNoteNumber: sourceReceipt.deliveryNoteNumber,
      purchaseOrderItem: {
        purchaseOrderId: sourceReceipt.purchaseOrderItem.purchaseOrderId,
      },
    },
    select: {
      quantity: true,
      note: true,
      purchaseOrderItem: {
        select: {
          position: true,
          partName: true,
          partNumber: true,
        },
      },
    },
  });
  relatedReceipts.sort(
    (left, right) => left.purchaseOrderItem.position - right.purchaseOrderItem.position,
  );

  const purchaseOrder = sourceReceipt.purchaseOrderItem.purchaseOrder;
  const pdf = await renderMektekDeliveryNotePdf({
    deliveryNoteNumber: sourceReceipt.deliveryNoteNumber,
    receivedAt: sourceReceipt.receivedAt,
    recipientName: purchaseOrder.userName,
    projectName: purchaseOrder.projectName,
    poNumber: purchaseOrder.poNumber,
    items: relatedReceipts.map((receipt) => ({
      description: receipt.purchaseOrderItem.partName,
      partNumber: receipt.purchaseOrderItem.partNumber,
      quantity: receipt.quantity,
      note: receipt.note,
    })),
  });
  const filenamePart = sourceReceipt.deliveryNoteNumber.replace(/[^A-Za-z0-9_-]+/g, "-");
  const body = pdf.buffer.slice(pdf.byteOffset, pdf.byteOffset + pdf.byteLength) as ArrayBuffer;

  return new Response(body, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="surat-jalan-${filenamePart}.pdf"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
