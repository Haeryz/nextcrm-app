"use server";

import { revalidatePath } from "next/cache";

import { authOptions } from "@/lib/auth";
import {
  validateMektekEmailTemplateInput,
  type MektekEmailTemplateInput,
} from "@/lib/mektek/email-templates";
import { prismadb } from "@/lib/prisma";
import { getServerSession } from "@/lib/session";

export type MektekEmailTemplateRow = {
  id: string;
  name: string;
  subject: string;
  body: string;
  purpose: string;
  isActive: boolean;
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
};

async function ensureEmailTemplateAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { error: "Unauthorized" as const };
  if (session.user.userStatus !== "ACTIVE" || !session.user.isAdmin) {
    return {
      error: "Forbidden: only active admins can manage email templates" as const,
    };
  }
  return { userId: session.user.id };
}

function revalidateEmailTemplates() {
  revalidatePath("/[locale]/(routes)/mektek/email", "page");
}

function isUniqueActiveTemplateError(error: unknown) {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "P2002",
  );
}

export async function listMektekEmailTemplates() {
  const access = await ensureEmailTemplateAdmin();
  if ("error" in access) return { error: access.error };

  const templates = await prismadb.mektekEmailTemplate.findMany({
    orderBy: [{ purpose: "asc" }, { isActive: "desc" }, { updatedAt: "desc" }],
  });
  return { data: templates satisfies MektekEmailTemplateRow[] };
}

export async function createMektekEmailTemplate(
  input: MektekEmailTemplateInput,
) {
  const access = await ensureEmailTemplateAdmin();
  if ("error" in access) return { error: access.error };

  const validated = validateMektekEmailTemplateInput(input);
  if ("error" in validated) return { error: validated.error };

  try {
    const template = await prismadb.$transaction(async (transaction) => {
      if (validated.data.isActive) {
        await transaction.mektekEmailTemplate.updateMany({
          where: { purpose: validated.data.purpose, isActive: true },
          data: { isActive: false },
        });
      }
      return transaction.mektekEmailTemplate.create({
        data: { ...validated.data, createdById: access.userId },
      });
    });
    revalidateEmailTemplates();
    return { data: template };
  } catch (error) {
    if (isUniqueActiveTemplateError(error)) {
      return { error: "Template aktif berubah. Silakan coba simpan lagi." };
    }
    console.log("[CREATE_EMAIL_TEMPLATE]", error);
    return { error: "Gagal membuat template email" };
  }
}

export async function updateMektekEmailTemplate(
  id: string,
  input: MektekEmailTemplateInput,
) {
  const access = await ensureEmailTemplateAdmin();
  if ("error" in access) return { error: access.error };

  const templateId = String(id ?? "").trim();
  if (!templateId) return { error: "Template ID wajib diisi" };
  const validated = validateMektekEmailTemplateInput(input);
  if ("error" in validated) return { error: validated.error };

  try {
    const existing = await prismadb.mektekEmailTemplate.findUnique({
      where: { id: templateId },
      select: { id: true },
    });
    if (!existing) return { error: "Template email tidak ditemukan" };

    const template = await prismadb.$transaction(async (transaction) => {
      if (validated.data.isActive) {
        await transaction.mektekEmailTemplate.updateMany({
          where: {
            purpose: validated.data.purpose,
            isActive: true,
            id: { not: templateId },
          },
          data: { isActive: false },
        });
      }
      return transaction.mektekEmailTemplate.update({
        where: { id: templateId },
        data: validated.data,
      });
    });
    revalidateEmailTemplates();
    return { data: template };
  } catch (error) {
    if (isUniqueActiveTemplateError(error)) {
      return { error: "Template aktif berubah. Silakan coba simpan lagi." };
    }
    console.log("[UPDATE_EMAIL_TEMPLATE]", error);
    return { error: "Gagal menyimpan template email" };
  }
}

export async function deleteMektekEmailTemplate(id: string) {
  const access = await ensureEmailTemplateAdmin();
  if ("error" in access) return { error: access.error };

  const templateId = String(id ?? "").trim();
  if (!templateId) return { error: "Template ID wajib diisi" };

  try {
    await prismadb.mektekEmailTemplate.delete({
      where: { id: templateId },
    });
    revalidateEmailTemplates();
    return { data: { id: templateId } };
  } catch (error) {
    console.log("[DELETE_EMAIL_TEMPLATE]", error);
    return { error: "Template email tidak ditemukan" };
  }
}
