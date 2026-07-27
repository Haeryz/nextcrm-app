import { NextResponse } from "next/server";
import { canViewMektekFinance } from "@/lib/mektek/permissions";
import { prismadb } from "@/lib/prisma";
import { getRequestSessionUser } from "@/lib/request-session";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getRequestSessionUser(request);
  if (!user?.id || !canViewMektekFinance(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const file = await prismadb.financeAttachment.findUnique({ where: { id } });
  if (!file) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const safeName = file.fileName.replace(/[\r\n"]/g, "_");
  return new Response(Buffer.from(file.data), { headers: { "Content-Type": file.mimeType, "Content-Length": String(file.byteSize), "Content-Disposition": `inline; filename="${safeName}"`, "Cache-Control": "private, no-store" } });
}
