import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";

import { renderMektekDeliveryNotePdf } from "@/actions/mektek/logistics-delivery-note-pdf";
import { requireMektekLogisticsApiSession } from "@/lib/mektek/logistics-api";
import { prismadb } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const access = await requireMektekLogisticsApiSession("RECEIVING");
  if (access.response) return access.response;

  const { id } = await params;
  const updated = await prismadb.logisticsPurchaseOrder.updateMany({
    where: { id, flow: "RECEIVING" },
    data: { receivingDeliveryNoteSource: "MEKTEK" },
  });
  if (updated.count === 0) {
    return NextResponse.json(
      { error: "Purchase Order Receiving tidak ditemukan" },
      { status: 404 },
    );
  }

  revalidatePath("/[locale]/(routes)/mektek/receiving", "page");
  return NextResponse.json({
    data: {
      source: "MEKTEK",
      pdfPath: `/api/mektek/logistics/purchase-orders/${encodeURIComponent(id)}/delivery-note?flow=receiving`,
    },
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const isReceiving =
    request.nextUrl.searchParams.get("flow")?.toLowerCase() === "receiving";
  const access = isReceiving
    ? await requireMektekLogisticsApiSession("RECEIVING")
    : await requireMektekLogisticsApiSession("MONITORING_PO");
  if (access.response) return access.response;
  const { id } = await params;
  const reference = request.nextUrl.searchParams.get("reference")?.trim() || null;
  const limit = checkRateLimit(
    `logistics-delivery-note:${isReceiving ? "receiving" : "outbound"}:${getClientIp(request.headers)}:${id}`,
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
    where: isReceiving
      ? { id, flow: "RECEIVING" }
      : { id, flow: "OUTBOUND" },
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
    return new Response(
      isReceiving
        ? "Purchase Order Receiving tidak ditemukan"
        : "Surat Jalan Monitoring PO tidak ditemukan",
      {
      status: 404,
      },
    );
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
  if (!isReceiving && !reference && !purchaseOrder.deliveryNoteNumber) {
    return new Response("Surat Jalan Monitoring PO tidak ditemukan", {
      status: 404,
    });
  }

  const deliveryNoteNumber =
    reference ||
    purchaseOrder.deliveryNoteNumber ||
    `SJ-${purchaseOrder.poNumber}`;
  const firstBatchReceipt = batchItems[0]?.receipt;

  const pdf = await renderMektekDeliveryNotePdf({
    deliveryNoteNumber,
    receivedAt:
      firstBatchReceipt?.receivedAt ||
      purchaseOrder.deliveryDate ||
      purchaseOrder.inputDate,
    recipientName: isReceiving
      ? purchaseOrder.supplierName
      : purchaseOrder.userName,
    projectName: purchaseOrder.projectName,
    poNumber: purchaseOrder.poNumber,
    picName:
      firstBatchReceipt?.pic.name ||
      (isReceiving ? "Logistics Mektek" : "Logistics MekTek"),
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
