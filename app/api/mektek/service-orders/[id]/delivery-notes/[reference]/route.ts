import { NextResponse, type NextRequest } from "next/server";

import { renderMektekDeliveryNotePdf } from "@/actions/mektek/logistics-delivery-note-pdf";
import { canViewMektekOrders } from "@/lib/mektek/permissions";
import { prismadb } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { getRequestSessionUser } from "@/lib/request-session";
import { isUuid } from "@/lib/uuid";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  {
    params,
  }: { params: Promise<{ id: string; reference: string }> },
) {
  const user = await getRequestSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canViewMektekOrders(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id, reference: rawReference } = await params;
  const reference = rawReference.trim();
  if (!isUuid(id) || !reference || reference.length > 80) {
    return NextResponse.json(
      { error: "Surat Jalan tidak valid" },
      { status: 400 },
    );
  }

  const limit = checkRateLimit(
    `service-order-delivery-note:${getClientIp(request.headers)}:${id}`,
    20,
    10 * 60 * 1000,
  );
  if (!limit.ok) {
    return new Response("Terlalu banyak permintaan", {
      status: 429,
      headers: { "Retry-After": String(Math.ceil(limit.retryAfterMs / 1000)) },
    });
  }

  const purchaseOrder = await prismadb.logisticsPurchaseOrder.findFirst({
    where: {
      sourceServiceOrderId: id,
      flow: "OUTBOUND",
    },
    include: {
      items: {
        orderBy: { position: "asc" },
        include: {
          receipts: {
            where: { receivingReference: reference },
            orderBy: { createdAt: "asc" },
            include: {
              pic: {
                select: { name: true },
              },
            },
          },
        },
      },
    },
  });

  if (!purchaseOrder) {
    return new Response("Pesanan Logistics tidak ditemukan", { status: 404 });
  }

  const batchItems = purchaseOrder.items.flatMap((item) =>
    item.receipts.map((receipt) => ({ item, receipt })),
  );
  if (batchItems.length === 0) {
    return new Response("Surat Jalan tidak ditemukan", { status: 404 });
  }

  const firstReceipt = batchItems[0].receipt;
  const pdf = await renderMektekDeliveryNotePdf({
    deliveryNoteNumber: reference,
    receivedAt: firstReceipt.receivedAt,
    recipientName: purchaseOrder.userName,
    projectName: purchaseOrder.projectName,
    poNumber: purchaseOrder.poNumber,
    picName: firstReceipt.pic.name || "Logistics MekTek",
    isReceiving: false,
    items: batchItems.map(({ item, receipt }) => ({
      description: item.partName,
      partNumber: item.partNumber,
      quantity: receipt.quantity,
      note: receipt.note,
    })),
  });
  const filename = reference.replace(/[^A-Za-z0-9_-]+/g, "-");

  return new Response(pdf.buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="surat-jalan-${filename}.pdf"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
