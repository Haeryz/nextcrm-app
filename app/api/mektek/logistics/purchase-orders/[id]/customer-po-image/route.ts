import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { requireMektekLogisticsApiSession } from "@/lib/mektek/logistics-api";
import {
  MAX_LOGISTICS_RECEIPT_IMAGE_BYTES,
  validateLogisticsReceiptImageUpload,
} from "@/lib/mektek/logistics-receipt-image";
import { prismadb } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function revalidateOutbound() {
  revalidatePath("/[locale]/(routes)/mektek/logistics", "page");
  revalidatePath("/[locale]/(routes)/mektek/logistics/spreadsheet", "page");
}

export async function GET(_request: Request, { params }: RouteContext) {
  const access = await requireMektekLogisticsApiSession("MONITORING_PO");
  if (access.response) return access.response;

  const { id } = await params;
  const purchaseOrder = await prismadb.logisticsPurchaseOrder.findFirst({
    where: { id, flow: "OUTBOUND" },
    select: {
      customerPoImageData: true,
      customerPoImageMimeType: true,
      customerPoImageUpdatedAt: true,
    },
  });
  if (
    !purchaseOrder?.customerPoImageData ||
    !purchaseOrder.customerPoImageMimeType
  ) {
    return new Response("PO Customer tidak ditemukan", {
      status: 404,
    });
  }

  const etag = `"${purchaseOrder.customerPoImageUpdatedAt?.getTime() || 0}-${purchaseOrder.customerPoImageData.byteLength}"`;
  return new Response(Buffer.from(purchaseOrder.customerPoImageData), {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Length": String(purchaseOrder.customerPoImageData.byteLength),
      "Content-Type": purchaseOrder.customerPoImageMimeType,
      ETag: etag,
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function PUT(request: Request, { params }: RouteContext) {
  const access = await requireMektekLogisticsApiSession("MONITORING_PO");
  if (access.response) return access.response;

  const declaredLength = Number(request.headers.get("content-length"));
  if (
    Number.isFinite(declaredLength) &&
    declaredLength > MAX_LOGISTICS_RECEIPT_IMAGE_BYTES
  ) {
    return NextResponse.json(
      { error: "Ukuran PO Customer maksimal 5 MB" },
      { status: 413 },
    );
  }

  const bytes = new Uint8Array(await request.arrayBuffer());
  const validation = validateLogisticsReceiptImageUpload(
    request.headers.get("content-type"),
    bytes,
  );
  if ("error" in validation) {
    return NextResponse.json(
      { error: validation.error.replace("foto kondisi barang", "PO Customer") },
      { status: 400 },
    );
  }

  const { id } = await params;
  const updated = await prismadb.logisticsPurchaseOrder.updateMany({
    where: { id, flow: "OUTBOUND" },
    data: {
      customerPoImageData: Buffer.from(bytes),
      customerPoImageMimeType: validation.contentType,
      customerPoImageUpdatedAt: new Date(),
    },
  });
  if (updated.count === 0) {
    return NextResponse.json(
      { error: "Monitoring PO tidak ditemukan" },
      { status: 404 },
    );
  }

  revalidateOutbound();
  return NextResponse.json({
    data: {
      imagePath: `/api/mektek/logistics/purchase-orders/${encodeURIComponent(id)}/customer-po-image`,
    },
  });
}
