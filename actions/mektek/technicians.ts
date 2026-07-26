"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth-guards";
import {
  isMektekTechnicianRole,
  type MektekTechnicianRole,
} from "@/lib/mektek/technicians";
import { prismadb } from "@/lib/prisma";

// Must include the route group: Next derives the implicit cache tag from the
// app-manifest page path ("/[locale]/(routes)/mektek/technicians/page"), so the
// bare "/mektek/technicians" form used previously never matched anything and
// every revalidation here was silently a no-op.
const MANAGEMENT_PATH = "/[locale]/(routes)/mektek/technicians";
const MEKTEK_HOME_PATH = "/[locale]/(routes)/mektek";

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
  revalidatePath(MANAGEMENT_PATH, "page");
  revalidatePath(MEKTEK_HOME_PATH, "page");
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
  revalidatePath(MANAGEMENT_PATH, "page");
  revalidatePath(MEKTEK_HOME_PATH, "page");
}

export async function deleteMektekTechnician(formData: FormData) {
  await requireAdmin();
  const id = text(formData, "id");
  if (!id) throw new Error("ID technician tidak valid.");
  await prismadb.mektekTechnician.deleteMany({ where: { id } });
  revalidatePath(MANAGEMENT_PATH, "page");
  revalidatePath(MEKTEK_HOME_PATH, "page");
}
