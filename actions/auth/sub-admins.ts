"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth-guards";
import {
  isStaffDivision,
  type StaffDivision,
} from "@/lib/auth/staff-divisions";
import {
  isLogisticsStaffArea,
  type LogisticsStaffArea,
} from "@/lib/auth/logistics-staff-areas";
import { hashPassword } from "@/lib/password";
import { prismadb } from "@/lib/prisma";

const MANAGEMENT_PATH = "/mektek/staff";

function text(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

function parseIdentity(formData: FormData) {
  const name = text(formData, "name").slice(0, 120);
  const email = text(formData, "email").toLowerCase();
  const rawDivision = text(formData, "staffDivision");
  const rawLogisticsArea = text(formData, "logisticsStaffArea");

  if (!name) throw new Error("Nama wajib diisi.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Alamat email tidak valid.");
  }
  if (!isStaffDivision(rawDivision)) {
    throw new Error("Divisi staff tidak valid.");
  }

  const logisticsStaffArea =
    rawDivision === "LOGISTICS" && isLogisticsStaffArea(rawLogisticsArea)
      ? (rawLogisticsArea as LogisticsStaffArea)
      : null;
  if (rawDivision === "LOGISTICS" && !logisticsStaffArea) {
    throw new Error("Bagian Logistics wajib dipilih.");
  }

  return {
    name,
    email,
    staffDivision: rawDivision as StaffDivision,
    logisticsStaffArea,
  };
}

export async function createSubAdmin(formData: FormData) {
  await requireAdmin();
  const identity = parseIdentity(formData);
  const password = text(formData, "password");
  if (password.length < 12 || password.length > 50) {
    throw new Error("Password harus berisi 12 sampai 50 karakter.");
  }

  await prismadb.users.create({
    data: {
      ...identity,
      username: identity.name,
      password: await hashPassword(password),
      is_admin: false,
      is_account_admin: false,
      mektekRole: null,
      userStatus: "ACTIVE",
      userLanguage: "id",
    },
  });

  revalidatePath(MANAGEMENT_PATH);
}

export async function updateSubAdmin(formData: FormData) {
  await requireAdmin();
  const id = text(formData, "id");
  const identity = parseIdentity(formData);
  const userStatus = text(formData, "userStatus");
  if (!id) throw new Error("ID sub-admin tidak valid.");
  if (userStatus !== "ACTIVE" && userStatus !== "INACTIVE") {
    throw new Error("Status sub-admin tidak valid.");
  }

  await prismadb.users.updateMany({
    where: { id, is_admin: false, staffDivision: { not: null } },
    data: {
      ...identity,
      userStatus,
      authVersion: { increment: 1 },
    },
  });

  revalidatePath(MANAGEMENT_PATH);
}

export async function deleteSubAdmin(formData: FormData) {
  await requireAdmin();
  const id = text(formData, "id");
  if (!id) throw new Error("ID sub-admin tidak valid.");

  // The predicate makes the owner and any other full admin undeletable through
  // this surface even if a forged form posts their UUID.
  await prismadb.users.deleteMany({
    where: { id, is_admin: false, staffDivision: { not: null } },
  });

  revalidatePath(MANAGEMENT_PATH);
}
