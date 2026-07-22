"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth-guards";
import { prismadb } from "@/lib/prisma";

const MANAGEMENT_PATH = "/mektek/receiving/pics";
const LOGISTICS_PATH = "/mektek/receiving";

function text(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

function parseName(formData: FormData) {
  const name = text(formData, "name").slice(0, 120);
  if (!name) throw new Error("Nama PIC wajib diisi.");
  return name;
}

function revalidatePicPaths() {
  revalidatePath(MANAGEMENT_PATH);
  revalidatePath(LOGISTICS_PATH);
}

export async function createMektekLogisticsPic(formData: FormData) {
  await requireAdmin();
  const name = parseName(formData);
  await prismadb.logisticsPic.create({ data: { name, isActive: true } });
  revalidatePicPaths();
}

export async function updateMektekLogisticsPic(formData: FormData) {
  await requireAdmin();
  const id = text(formData, "id");
  if (!id) throw new Error("ID PIC tidak valid.");
  const name = parseName(formData);
  const isActive = text(formData, "isActive") === "true";
  await prismadb.logisticsPic.update({
    where: { id },
    data: { name, isActive },
  });
  revalidatePicPaths();
}

export async function deleteMektekLogisticsPic(formData: FormData) {
  await requireAdmin();
  const id = text(formData, "id");
  if (!id) throw new Error("ID PIC tidak valid.");

  const assignedShipments = await prismadb.logisticsReceipt.count({
    where: { picId: id },
  });
  if (assignedShipments > 0) {
    throw new Error(
      "PIC sudah digunakan pada shipment. Nonaktifkan PIC untuk menjaga riwayat.",
    );
  }

  await prismadb.logisticsPic.delete({ where: { id } });
  revalidatePicPaths();
}
