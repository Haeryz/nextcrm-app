import type { NextRequest } from "next/server";

import { renderMektekDeliveryNotePdf } from "@/actions/mektek/logistics-delivery-note-pdf";
import { requireMektekLogisticsApiSession } from "@/lib/mektek/logistics-api";
import { prismadb } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const access = await requireMektekLogisticsApiSession();
  if (access.response) return access.response;
  const { id } = await params;
  const reference = request.nextUrl.searchParams.get("reference")?.trim() || null;
  const limit = checkRateLimit(
    `logistics-outbound-delivery-note:${getClientIp(request.headers)}:${id}`,
    20,
    10 * 60 * 1000,
  );
  if (!limit.ok) {
    return new Response("Terlalu banyak Request", {
      status: 429,
      headers: { "Retry-After": String(Math.ceil(limit.retryAfterMs / 1000)) },
    });
  }

  const purchaseOrder = await prismadb.logisticsPurchaseOrder.findFirst({
    where: { id, flow: "OUTBOUND" },
    include: {
      items: {
        orderBy: { position: "asc" },
        include: {
          receipts: {
            include: { pic: { select: { name: true } } },
            orderBy: { createdAt: "asc" },
          },
        },
      },
    },
  });
  if (!purchaseOrder) {
    return new Response("Surat Jalan Monitoring PO tidak ditemukan", {
      status: 404,
    });
  }

  const batchItems = reference
    ? purchaseOrder.items.flatMap((item) =>
        item.receipts
          .filter((receipt) => receipt.receivingReference === reference)
          .map((receipt) => ({ item, receipt })),
      )
    : [];
  if (reference && batchItems.length === 0) {
    return new Response("Batch barang keluar tidak ditemukan", { status: 404 });
  }
  if (!reference && !purchaseOrder.deliveryNoteNumber) {
    return new Response("Surat Jalan Monitoring PO tidak ditemukan", {
      status: 404,
    });
  }

  const deliveryNoteNumber = reference || purchaseOrder.deliveryNoteNumber!;
  const firstBatchReceipt = batchItems[0]?.receipt;

  const pdf = await renderMektekDeliveryNotePdf({
    deliveryNoteNumber,
    receivedAt:
      firstBatchReceipt?.receivedAt ||
      purchaseOrder.deliveryDate ||
      purchaseOrder.inputDate,
    recipientName: purchaseOrder.userName,
    projectName: purchaseOrder.projectName,
    poNumber: purchaseOrder.poNumber,
    picName: firstBatchReceipt?.pic.name || "Logistics MekTek",
    items: reference
      ? batchItems.map(({ item, receipt }) => ({
          description: item.partName,
          partNumber: item.partNumber,
          quantity: receipt.quantity,
          note: receipt.note,
        }))
      : purchaseOrder.items.map((item) => ({
          description: item.partName,
          partNumber: item.partNumber,
          quantity: item.orderedQuantity,
          note: item.note,
        })),
  });
  const filename = deliveryNoteNumber.replace(/[^A-Za-z0-9_-]+/g, "-");
  return new Response(pdf.buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="surat-jalan-${filename}.pdf"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
