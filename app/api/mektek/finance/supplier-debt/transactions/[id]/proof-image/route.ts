import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { canManageMektekFinance } from "@/lib/mektek/permissions";
import { prismadb } from "@/lib/prisma";
import { getRequestSessionUser } from "@/lib/request-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_PROOF_IMAGE_BYTES = 5 * 1024 * 1024;

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

const isAllowedMimeType = (value: string | null): value is string =>
  Boolean(value && ALLOWED_MIME_TYPES.has(value));

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: NextRequest, { params }: RouteContext) {
  const user = await getRequestSessionUser(request);
  if (!user?.id || !canManageMektekFinance(user)) {
    return new Response("Forbidden", { status: 403 });
  }

  const { id } = await params;
  const download = request.nextUrl.searchParams.get("download") === "1";
  const transaction = await prismadb.mektekSupplierDebtTransaction.findUnique({
    where: { id },
    select: {
      proofImageData: true,
      proofImageMimeType: true,
      proofImageUpdatedAt: true,
    },
  });
  if (!transaction?.proofImageData || !transaction.proofImageMimeType) {
    return new Response(null, {
      status: 404,
      headers: { "Cache-Control": "private, no-store" },
    });
  }

  const etag = `W/"${transaction.proofImageUpdatedAt?.getTime() ?? 0}-${transaction.proofImageData.byteLength}"`;
  const extension = transaction.proofImageMimeType === "application/pdf" ? "pdf" : transaction.proofImageMimeType === "image/png" ? "png" : transaction.proofImageMimeType === "image/webp" ? "webp" : "jpg";
  const headers: Record<string, string> = {
    "Cache-Control": "private, no-store",
    "Content-Length": String(transaction.proofImageData.byteLength),
    "Content-Type": transaction.proofImageMimeType,
    ETag: etag,
    "X-Content-Type-Options": "nosniff",
  };
  if (download) {
    headers["Content-Disposition"] = `attachment; filename="bukti-pembayaran-${id}.${extension}"`;
  }
  return new Response(Buffer.from(transaction.proofImageData), { headers });
}

export async function PUT(request: NextRequest, { params }: RouteContext) {
  const user = await getRequestSessionUser(request);
  if (!user?.id || !canManageMektekFinance(user)) {
    return new Response("Forbidden", { status: 403 });
  }

  const { id } = await params;
  const contentType = request.headers.get("content-type");
  if (!isAllowedMimeType(contentType)) {
    return NextResponse.json(
      { error: "Bukti pembayaran harus berupa JPEG, PNG, WebP, atau PDF" },
      { status: 400 },
    );
  }

  const declaredLength = Number(request.headers.get("content-length"));
  if (
    Number.isFinite(declaredLength) &&
    declaredLength > MAX_PROOF_IMAGE_BYTES
  ) {
    return NextResponse.json(
      { error: "Ukuran bukti pembayaran maksimal 5 MB" },
      { status: 413 },
    );
  }

  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.byteLength > MAX_PROOF_IMAGE_BYTES) {
    return NextResponse.json(
      { error: "Ukuran bukti pembayaran maksimal 5 MB" },
      { status: 413 },
    );
  }

  const updated = await prismadb.mektekSupplierDebtTransaction.updateMany({
    where: { id },
    data: {
      proofImageData: Buffer.from(bytes),
      proofImageMimeType: contentType,
      proofImageUpdatedAt: new Date(),
    },
  });
  if (updated.count === 0) {
    return NextResponse.json(
      { error: "Transaksi pemasok tidak ditemukan" },
      { status: 404 },
    );
  }

  return NextResponse.json({
    data: {
      proofImageHref: `/api/mektek/finance/supplier-debt/transactions/${encodeURIComponent(id)}/proof-image`,
    },
  });
}
