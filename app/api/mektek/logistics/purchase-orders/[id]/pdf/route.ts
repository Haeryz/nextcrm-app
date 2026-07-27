import type { NextRequest } from "next/server";

import { renderMektekPurchaseOrderPdf } from "@/actions/mektek/logistics-purchase-order-pdf";
import { requireMektekLogisticsApiSession } from "@/lib/mektek/logistics-api";
import { prismadb } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const access = await requireMektekLogisticsApiSession("RECEIVING", request);
  if (access.response) return access.response;
  const { id } = await params;
  const limit = checkRateLimit(
    `logistics-po-pdf:${getClientIp(request.headers)}:${id}`,
    20,
    10 * 60 * 1000,
  );
  if (!limit.ok) return new Response("Terlalu banyak Request", { status: 429 });

  const purchaseOrder = await prismadb.logisticsPurchaseOrder.findFirst({
    where: { id, flow: "RECEIVING" },
    include: { items: { orderBy: { position: "asc" } } },
  });
  if (!purchaseOrder) return new Response("Purchase Order tidak ditemukan", { status: 404 });
  const pdf = await renderMektekPurchaseOrderPdf({
    ...purchaseOrder,
    items: purchaseOrder.items.map((item) => ({
      position: item.position,
      partName: item.partName,
      partNumber: item.partNumber,
      orderedQuantity: item.orderedQuantity,
      unitPrice: Number(item.agreedUnitPrice || 0),
      note: item.note,
    })),
  });
  const filename = purchaseOrder.poNumber.replace(/[^A-Za-z0-9_-]+/g, "-");

  return new Response(pdf.buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="purchase-order-${filename}.pdf"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
