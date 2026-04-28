import { NextRequest, NextResponse } from "next/server";
import { prismadb } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ imageId: string }> }
) {
  const { imageId } = await params;
  const image = await prismadb.catalogImage.findUnique({
    where: {
      id: imageId,
    },
    select: {
      bytes: true,
      mimeType: true,
    },
  });

  if (!image) {
    return new NextResponse("Image not found", { status: 404 });
  }

  return new NextResponse(image.bytes, {
    headers: {
      "Content-Type": image.mimeType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
