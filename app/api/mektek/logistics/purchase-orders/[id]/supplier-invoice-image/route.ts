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
      supplierInvoiceImageData: true,
      supplierInvoiceImageMimeType: true,
      supplierInvoiceImageUpdatedAt: true,
    },
  });
  if (
    !purchaseOrder?.supplierInvoiceImageData ||
    !purchaseOrder.supplierInvoiceImageMimeType
  ) {
    return new Response("Faktur supplier tidak ditemukan", { status: 404 });
  }

  const etag = `"${purchaseOrder.supplierInvoiceImageUpdatedAt?.getTime() || 0}-${purchaseOrder.supplierInvoiceImageData.byteLength}"`;
  return new Response(Buffer.from(purchaseOrder.supplierInvoiceImageData), {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Length": String(
        purchaseOrder.supplierInvoiceImageData.byteLength,
      ),
      "Content-Type": purchaseOrder.supplierInvoiceImageMimeType,
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
      { error: "Ukuran gambar Faktur maksimal 5 MB" },
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
      { error: validation.error.replace("foto kondisi barang", "gambar Faktur") },
      { status: 400 },
    );
  }

  const { id } = await params;
  const updated = await prismadb.logisticsPurchaseOrder.updateMany({
    where: { id, flow: "RECEIVING" },
    data: {
      supplierInvoiceImageData: Buffer.from(bytes),
      supplierInvoiceImageMimeType: validation.contentType,
      supplierInvoiceImageUpdatedAt: new Date(),
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
      imagePath: `/api/mektek/logistics/purchase-orders/${encodeURIComponent(id)}/supplier-invoice-image`,
    },
  });
}
