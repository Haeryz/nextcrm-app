"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth-guards";
import {
  isMektekTechnicianRole,
  type MektekTechnicianRole,
} from "@/lib/mektek/technicians";
import { prismadb } from "@/lib/prisma";

const MANAGEMENT_PATH = "/mektek/technicians";

function text(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

function parseTechnician(formData: FormData) {
  const name = text(formData, "name").slice(0, 120);
  const rawRole = text(formData, "role");
  if (!name) throw new Error("Nama technician wajib diisi.");
  if (!isMektekTechnicianRole(rawRole)) {
    throw new Error("Role technician tidak valid.");
  }
  return { name, role: rawRole as MektekTechnicianRole };
}

export async function createMektekTechnician(formData: FormData) {
  await requireAdmin();
  const technician = parseTechnician(formData);
  await prismadb.mektekTechnician.create({
    data: { ...technician, isActive: true },
  });
  revalidatePath(MANAGEMENT_PATH);
  revalidatePath("/mektek");
}

export async function updateMektekTechnician(formData: FormData) {
  await requireAdmin();
  const id = text(formData, "id");
  if (!id) throw new Error("ID technician tidak valid.");
  const technician = parseTechnician(formData);
  const isActive = text(formData, "isActive") === "true";
  await prismadb.mektekTechnician.updateMany({
    where: { id },
    data: { ...technician, isActive },
  });
  revalidatePath(MANAGEMENT_PATH);
  revalidatePath("/mektek");
}

export async function deleteMektekTechnician(formData: FormData) {
  await requireAdmin();
  const id = text(formData, "id");
  if (!id) throw new Error("ID technician tidak valid.");
  await prismadb.mektekTechnician.deleteMany({ where: { id } });
  revalidatePath(MANAGEMENT_PATH);
  revalidatePath("/mektek");
}
