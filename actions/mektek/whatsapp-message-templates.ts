"use server";

import { revalidatePath } from "next/cache";

import { authOptions } from "@/lib/auth";
import {
  validateWhatsAppMessageTemplateInput,
  type WhatsAppMessageTemplateInput,
} from "@/lib/mektek/whatsapp-message-templates";
import { prismadb } from "@/lib/prisma";
import { getServerSession } from "@/lib/session";

export type MektekWhatsAppMessageTemplateRow = {
  id: string;
  name: string;
  body: string;
  purpose: string;
  isActive: boolean;
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
};

async function ensureWhatsAppTemplateAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { error: "Unauthorized" as const };
  if (session.user.userStatus !== "ACTIVE" || !session.user.isAdmin) {
    return {
      error: "Forbidden: only active admins can manage WhatsApp templates" as const,
    };
  }
  return { userId: session.user.id };
}

function revalidateWhatsAppTemplates() {
  revalidatePath("/[locale]/(routes)/mektek/whatsapp", "page");
}

function isUniqueActiveTemplateError(error: unknown) {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "P2002",
  );
}

export async function listMektekWhatsAppMessageTemplates() {
  const access = await ensureWhatsAppTemplateAdmin();
  if ("error" in access) return { error: access.error };

  const templates = await prismadb.mektekWhatsAppMessageTemplate.findMany({
    orderBy: [{ purpose: "asc" }, { isActive: "desc" }, { updatedAt: "desc" }],
  });
  return { data: templates satisfies MektekWhatsAppMessageTemplateRow[] };
}

export async function createMektekWhatsAppMessageTemplate(
  input: WhatsAppMessageTemplateInput,
) {
  const access = await ensureWhatsAppTemplateAdmin();
  if ("error" in access) return { error: access.error };

  const validated = validateWhatsAppMessageTemplateInput(input);
  if ("error" in validated) return { error: validated.error };

  try {
    const template = await prismadb.$transaction(async (transaction) => {
      if (validated.data.isActive) {
        await transaction.mektekWhatsAppMessageTemplate.updateMany({
          where: { purpose: validated.data.purpose, isActive: true },
          data: { isActive: false },
        });
      }
      return transaction.mektekWhatsAppMessageTemplate.create({
        data: { ...validated.data, createdById: access.userId },
      });
    });
    revalidateWhatsAppTemplates();
    return { data: template };
  } catch (error) {
    if (isUniqueActiveTemplateError(error)) {
      return { error: "Template aktif berubah. Silakan coba simpan lagi." };
    }
    console.log("[CREATE_WHATSAPP_MESSAGE_TEMPLATE]", error);
    return { error: "Gagal membuat template WhatsApp" };
  }
}

export async function updateMektekWhatsAppMessageTemplate(
  id: string,
  input: WhatsAppMessageTemplateInput,
) {
  const access = await ensureWhatsAppTemplateAdmin();
  if ("error" in access) return { error: access.error };

  const templateId = String(id ?? "").trim();
  if (!templateId) return { error: "Template ID wajib diisi" };
  const validated = validateWhatsAppMessageTemplateInput(input);
  if ("error" in validated) return { error: validated.error };

  try {
    const existing = await prismadb.mektekWhatsAppMessageTemplate.findUnique({
      where: { id: templateId },
      select: { id: true },
    });
    if (!existing) return { error: "Template WhatsApp tidak ditemukan" };

    const template = await prismadb.$transaction(async (transaction) => {
      if (validated.data.isActive) {
        await transaction.mektekWhatsAppMessageTemplate.updateMany({
          where: {
            purpose: validated.data.purpose,
            isActive: true,
            id: { not: templateId },
          },
          data: { isActive: false },
        });
      }
      return transaction.mektekWhatsAppMessageTemplate.update({
        where: { id: templateId },
        data: validated.data,
      });
    });
    revalidateWhatsAppTemplates();
    return { data: template };
  } catch (error) {
    if (isUniqueActiveTemplateError(error)) {
      return { error: "Template aktif berubah. Silakan coba simpan lagi." };
    }
    console.log("[UPDATE_WHATSAPP_MESSAGE_TEMPLATE]", error);
    return { error: "Gagal menyimpan template WhatsApp" };
  }
}

export async function deleteMektekWhatsAppMessageTemplate(id: string) {
  const access = await ensureWhatsAppTemplateAdmin();
  if ("error" in access) return { error: access.error };

  const templateId = String(id ?? "").trim();
  if (!templateId) return { error: "Template ID wajib diisi" };

  try {
    await prismadb.mektekWhatsAppMessageTemplate.delete({
      where: { id: templateId },
    });
    revalidateWhatsAppTemplates();
    return { data: { id: templateId } };
  } catch (error) {
    console.log("[DELETE_WHATSAPP_MESSAGE_TEMPLATE]", error);
    return { error: "Template WhatsApp tidak ditemukan" };
  }
}
