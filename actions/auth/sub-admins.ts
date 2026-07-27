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
import {
  isStaffCapability,
  normalizeStaffCapabilities,
  type StaffCapability,
} from "@/lib/auth/staff-capabilities";
import { hashPassword } from "@/lib/password";
import { prismadb } from "@/lib/prisma";

const MANAGEMENT_PATH = "/mektek/staff";

function text(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

function parseCapabilities(formData: FormData): StaffCapability[] {
  const raw = formData.getAll("staffCapabilities");
  return normalizeStaffCapabilities(raw);
}

function parseIdentity(formData: FormData) {
  const name = text(formData, "name").slice(0, 120);
  const email = text(formData, "email").toLowerCase();
  const rawDivision = text(formData, "staffDivision");
  const rawLogisticsArea = text(formData, "logisticsStaffArea");
  const staffCapabilities = parseCapabilities(formData);

  if (!name) throw new Error("Nama wajib diisi.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Alamat email tidak valid.");
  }
  if (staffCapabilities.length === 0) {
    throw new Error("Pilih minimal satu kapabilitas akses sub-admin.");
  }

  // staffDivision is retained as optional metadata for grouping/display only; the
  // authoritative access control is the capability set above. A division without
  // an area is allowed because capabilities now drive enforcement.
  const staffDivision = isStaffDivision(rawDivision)
    ? (rawDivision as StaffDivision)
    : null;
  const logisticsStaffArea =
    staffDivision === "LOGISTICS" && isLogisticsStaffArea(rawLogisticsArea)
      ? (rawLogisticsArea as LogisticsStaffArea)
      : null;

  return {
    name,
    email,
    staffDivision,
    logisticsStaffArea,
    staffCapabilities,
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
      name: identity.name,
      email: identity.email,
      staffDivision: identity.staffDivision,
      logisticsStaffArea: identity.logisticsStaffArea,
      staffCapabilities: identity.staffCapabilities,
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
    where: {
      id,
      is_admin: false,
      OR: [
        { staffDivision: { not: null } },
        { staffCapabilities: { isEmpty: false } },
      ],
    },
    data: {
      name: identity.name,
      email: identity.email,
      staffDivision: identity.staffDivision,
      logisticsStaffArea: identity.logisticsStaffArea,
      staffCapabilities: identity.staffCapabilities,
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
  // this surface even if a forged form posts their UUID. A sub-admin is any
  // non-admin account that carries a legacy division or an assigned capability.
  await prismadb.users.deleteMany({
    where: {
      id,
      is_admin: false,
      OR: [
        { staffDivision: { not: null } },
        { staffCapabilities: { isEmpty: false } },
      ],
    },
  });

  revalidatePath(MANAGEMENT_PATH);
}
