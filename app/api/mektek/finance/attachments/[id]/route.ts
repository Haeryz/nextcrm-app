import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { canViewMektekFinance } from "@/lib/mektek/permissions";
import { prismadb } from "@/lib/prisma";
import { getServerSession } from "@/lib/session";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !canViewMektekFinance(session.user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const file = await prismadb.financeAttachment.findUnique({ where: { id } });
  if (!file) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const safeName = file.fileName.replace(/[\r\n"]/g, "_");
  return new Response(Buffer.from(file.data), { headers: { "Content-Type": file.mimeType, "Content-Length": String(file.byteSize), "Content-Disposition": `inline; filename="${safeName}"`, "Cache-Control": "private, no-store" } });
}
