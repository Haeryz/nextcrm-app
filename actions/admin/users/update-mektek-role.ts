"use server";

import { authOptions } from "@/lib/auth";
import { prismadb } from "@/lib/prisma";
import { getServerSession } from "@/lib/session";
import { revalidatePath } from "next/cache";

const ALLOWED_ROLES = new Set(["CS", "TECHNICIAN"]);

export const updateMektekRole = async (input: {
  userId: string;
  role: "CS" | "TECHNICIAN" | null;
}) => {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) return { error: "Unauthorized" };

  const userId = String(input?.userId ?? "").trim();
  const role = input?.role ?? null;

  if (!userId) return { error: "User ID is required" };
  if (role !== null && !ALLOWED_ROLES.has(role)) return { error: "Invalid MekTek role" };

  try {
    await prismadb.users.update({
      where: { id: userId },
      data: { mektekRole: role },
    });
    revalidatePath("/[locale]/(routes)/admin/users", "page");
    return { data: true };
  } catch (error) {
    console.log("[UPDATE_MEKTEK_ROLE]", error);
    return { error: "Failed to update MekTek role" };
  }
};
