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

function revalidateLogistics() {
  revalidatePath("/[locale]/(routes)/mektek/logistics", "page");
  revalidatePath("/[locale]/(routes)/mektek/logistics/spreadsheet", "page");
}

export async function GET(_request: Request, { params }: RouteContext) {
  const access = await requireMektekLogisticsApiSession();
  if (access.response) return access.response;

  const { id } = await params;
  const receipt = await prismadb.logisticsReceipt.findUnique({
    where: { id },
    select: {
      imageData: true,
      imageMimeType: true,
      imageUpdatedAt: true,
    },
  });
  if (!receipt?.imageData || !receipt.imageMimeType) {
    return new NextResponse(null, {
      status: 404,
      headers: { "Cache-Control": "private, no-store" },
    });
  }

  const etag = `W/"${receipt.imageUpdatedAt?.getTime() ?? 0}-${receipt.imageData.byteLength}"`;
  return new Response(Buffer.from(receipt.imageData), {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Length": String(receipt.imageData.byteLength),
      "Content-Type": receipt.imageMimeType,
      ETag: etag,
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function PUT(request: Request, { params }: RouteContext) {
  const access = await requireMektekLogisticsApiSession();
  if (access.response) return access.response;

  const declaredLength = Number(request.headers.get("content-length"));
  if (
    Number.isFinite(declaredLength) &&
    declaredLength > MAX_LOGISTICS_RECEIPT_IMAGE_BYTES
  ) {
    return NextResponse.json(
      { error: "Ukuran foto kondisi barang maksimal 5 MB" },
      { status: 413 },
    );
  }

  const bytes = new Uint8Array(await request.arrayBuffer());
  const validation = validateLogisticsReceiptImageUpload(
    request.headers.get("content-type"),
    bytes,
  );
  if ("error" in validation) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const { id } = await params;
  const updated = await prismadb.logisticsReceipt.updateMany({
    where: { id },
    data: {
      imageData: Buffer.from(bytes),
      imageMimeType: validation.contentType,
      imageUpdatedAt: new Date(),
    },
  });
  if (updated.count === 0) {
    return NextResponse.json({ error: "Riwayat penerimaan tidak ditemukan" }, { status: 404 });
  }

  revalidateLogistics();
  return NextResponse.json({
    data: { imagePath: `/api/mektek/logistics/receipts/${encodeURIComponent(id)}/image` },
  });
}
