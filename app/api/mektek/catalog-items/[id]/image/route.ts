import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import {
  MAX_CATALOG_IMAGE_BYTES,
  validateCatalogImageUpload,
} from "@/lib/mektek/catalog-image-upload";
import { canCreateMektekOrders } from "@/lib/mektek/permissions";
import { prismadb } from "@/lib/prisma";
import { getServerSession } from "@/lib/session";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function noImageResponse() {
  return new NextResponse(null, {
    status: 404,
    headers: { "Cache-Control": "no-store" },
  });
}

async function authorizeUpload() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (!canCreateMektekOrders(session.user)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { session };
}

function revalidateCatalog() {
  revalidatePath("/[locale]/(routes)/mektek/items", "page");
  revalidatePath("/[locale]/customer", "page");
}

export async function GET(request: Request, { params }: RouteContext) {
  const { id } = await params;
  const item = await prismadb.catalogItem.findUnique({
    where: { id },
    select: {
      imageData: true,
      imageMimeType: true,
      updatedAt: true,
    },
  });

  if (!item?.imageData || !item.imageMimeType) return noImageResponse();

  const etag = `W/\"${item.updatedAt.getTime()}-${item.imageData.byteLength}\"`;
  if (request.headers.get("if-none-match") === etag) {
    return new NextResponse(null, { status: 304, headers: { ETag: etag } });
  }

  return new Response(Buffer.from(item.imageData), {
    headers: {
      "Cache-Control": "public, max-age=0, must-revalidate",
      "Content-Length": String(item.imageData.byteLength),
      "Content-Type": item.imageMimeType,
      ETag: etag,
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function PUT(request: Request, { params }: RouteContext) {
  const access = await authorizeUpload();
  if ("error" in access) return access.error;

  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_CATALOG_IMAGE_BYTES) {
    return NextResponse.json(
      { error: "Ukuran Catalogue Image maksimal 4 MB" },
      { status: 413 },
    );
  }

  const bytes = new Uint8Array(await request.arrayBuffer());
  const validation = validateCatalogImageUpload(
    request.headers.get("content-type"),
    bytes,
  );
  if ("error" in validation) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const { id } = await params;
  const updated = await prismadb.catalogItem.updateMany({
    where: { id },
    data: {
      imageData: Buffer.from(bytes),
      imageMimeType: validation.contentType,
      imagePath: null,
    },
  });
  if (updated.count === 0) {
    return NextResponse.json({ error: "Catalogue Item tidak ditemukan" }, { status: 404 });
  }

  revalidateCatalog();
  return NextResponse.json({
    data: { imagePath: `/api/mektek/catalog-items/${encodeURIComponent(id)}/image` },
  });
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const access = await authorizeUpload();
  if ("error" in access) return access.error;

  const { id } = await params;
  const updated = await prismadb.catalogItem.updateMany({
    where: { id },
    data: { imageData: null, imageMimeType: null, imagePath: null },
  });
  if (updated.count === 0) {
    return NextResponse.json({ error: "Catalogue Item tidak ditemukan" }, { status: 404 });
  }

  revalidateCatalog();
  return NextResponse.json({ data: { id } });
}
