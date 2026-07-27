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

function revalidateReceiving() {
  revalidatePath("/[locale]/(routes)/mektek/receiving", "page");
}

export async function GET(request: Request, { params }: RouteContext) {
  const access = await requireMektekLogisticsApiSession("RECEIVING", request);
  if (access.response) return access.response;

  const { id } = await params;
  const purchaseOrder = await prismadb.logisticsPurchaseOrder.findFirst({
    where: { id, flow: "RECEIVING" },
    select: {
      mektekDeliveryNoteImageData: true,
      mektekDeliveryNoteImageMimeType: true,
      mektekDeliveryNoteImageUpdatedAt: true,
    },
  });
  if (
    !purchaseOrder?.mektekDeliveryNoteImageData ||
    !purchaseOrder.mektekDeliveryNoteImageMimeType
  ) {
    return new Response("Surat Jalan Mektek yang ditandatangani tidak ditemukan", {
      status: 404,
    });
  }

  const etag = `"${purchaseOrder.mektekDeliveryNoteImageUpdatedAt?.getTime() || 0}-${purchaseOrder.mektekDeliveryNoteImageData.byteLength}"`;
  return new Response(Buffer.from(purchaseOrder.mektekDeliveryNoteImageData), {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Length": String(purchaseOrder.mektekDeliveryNoteImageData.byteLength),
      "Content-Type": purchaseOrder.mektekDeliveryNoteImageMimeType,
      ETag: etag,
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function PUT(request: Request, { params }: RouteContext) {
  const access = await requireMektekLogisticsApiSession("RECEIVING", request);
  if (access.response) return access.response;

  const declaredLength = Number(request.headers.get("content-length"));
  if (
    Number.isFinite(declaredLength) &&
    declaredLength > MAX_LOGISTICS_RECEIPT_IMAGE_BYTES
  ) {
    return NextResponse.json(
      { error: "Ukuran foto Surat Jalan Mektek maksimal 5 MB" },
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
      {
        error: validation.error.replace(
          "foto kondisi barang",
          "foto Surat Jalan Mektek",
        ),
      },
      { status: 400 },
    );
  }

  const { id } = await params;
  const updated = await prismadb.logisticsPurchaseOrder.updateMany({
    where: { id, flow: "RECEIVING" },
    data: {
      mektekDeliveryNoteImageData: Buffer.from(bytes),
      mektekDeliveryNoteImageMimeType: validation.contentType,
      mektekDeliveryNoteImageUpdatedAt: new Date(),
      receivingDeliveryNoteSource: "MEKTEK",
    },
  });
  if (updated.count === 0) {
    return NextResponse.json(
      { error: "Purchase Order Receiving tidak ditemukan" },
      { status: 404 },
    );
  }

  revalidateReceiving();
  return NextResponse.json({
    data: {
      imagePath: `/api/mektek/logistics/purchase-orders/${encodeURIComponent(id)}/mektek-delivery-note-image`,
    },
  });
}
