import "server-only";

import { prismadb } from "@/lib/prisma";
import type { WhatsAppMessageTemplatePurpose } from "@/lib/mektek/whatsapp-message-templates";

export async function getActiveWhatsAppMessageTemplateBody(
  purpose: WhatsAppMessageTemplatePurpose,
) {
  try {
    const template = await prismadb.mektekWhatsAppMessageTemplate.findFirst({
      where: { purpose, isActive: true },
      orderBy: { updatedAt: "desc" },
      select: { body: true },
    });
    return template?.body?.trim() || null;
  } catch (error) {
    console.log("[GET_ACTIVE_WHATSAPP_MESSAGE_TEMPLATE]", error);
    return null;
  }
}
