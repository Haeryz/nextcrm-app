import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { FinanceAttachmentKind } from "@prisma/client";
import { validateFinanceAttachment } from "@/lib/mektek/finance-attachment";
import { canViewMektekFinance } from "@/lib/mektek/permissions";
import { prismadb } from "@/lib/prisma";
import { getRequestSessionUser } from "@/lib/request-session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await getRequestSessionUser(request);
  if (!user?.id || !canViewMektekFinance(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const form = await request.formData();
  const file = form.get("file");
  const entityType = String(form.get("entityType") ?? "").trim().slice(0, 80);
  const entityId = String(form.get("entityId") ?? "").trim().slice(0, 120);
  const kind = String(form.get("kind") ?? "OTHER");
  if (!(file instanceof File) || !entityType || !entityId || !Object.values(FinanceAttachmentKind).includes(kind as FinanceAttachmentKind)) {
    return NextResponse.json({ error: "Data lampiran tidak valid" }, { status: 400 });
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const validation = validateFinanceAttachment(file.type, bytes);
  if ("error" in validation) return NextResponse.json({ error: validation.error }, { status: 400 });
  const attachment = await prismadb.$transaction(async (tx) => {
    const created = await tx.financeAttachment.create({ data: { entityType, entityId, kind: kind as FinanceAttachmentKind, fileName: file.name.slice(0, 240), mimeType: file.type, byteSize: bytes.byteLength, sha256: createHash("sha256").update(bytes).digest("hex"), data: bytes, uploadedBy: user.id } });
    await tx.financeAuditEvent.create({ data: { entityType, entityId, action: "ATTACHMENT_UPLOAD", actorId: user.id, after: { attachmentId: created.id, fileName: created.fileName, kind } } });
    return created;
  });
  return NextResponse.json({ id: attachment.id, fileName: attachment.fileName });
}
