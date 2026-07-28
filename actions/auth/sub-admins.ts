"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth-guards";
import type { StaffDivision } from "@/lib/auth/staff-divisions";
import type { LogisticsStaffArea } from "@/lib/auth/logistics-staff-areas";
import {
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

// Auto-derive the display-only division and logistics area from the selected
// capabilities. The capability set is the authoritative access control; the
// division is retained as metadata for grouping/display only.
function deriveDivisionFromCapabilities(
  capabilities: StaffCapability[],
): { staffDivision: StaffDivision | null; logisticsStaffArea: LogisticsStaffArea | null } {
  if (capabilities.includes("MEKTEK_MONITORING_PO")) {
    return { staffDivision: "LOGISTICS", logisticsStaffArea: "MONITORING_PO" };
  }
  if (capabilities.includes("MEKTEK_RECEIVING")) {
    return { staffDivision: "LOGISTICS", logisticsStaffArea: "RECEIVING" };
  }
  if (capabilities.includes("MEKTEK_CATALOG")) {
    return { staffDivision: "LOGISTICS", logisticsStaffArea: null };
  }
  if (
    capabilities.includes("MEKTEK_FINANCE") ||
    capabilities.includes("MEKTEK_ACCOUNTING")
  ) {
    return { staffDivision: "FINANCE", logisticsStaffArea: null };
  }
  if (capabilities.includes("MEKTEK_CUSTOMER_SERVICE")) {
    return { staffDivision: "CUSTOMER_SERVICE", logisticsStaffArea: null };
  }
  return { staffDivision: null, logisticsStaffArea: null };
}

function parseIdentity(formData: FormData) {
  const name = text(formData, "name").slice(0, 120);
  const email = text(formData, "email").toLowerCase();
  const staffCapabilities = parseCapabilities(formData);

  if (!name) throw new Error("Nama wajib diisi.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Alamat email tidak valid.");
  }
  if (staffCapabilities.length === 0) {
    throw new Error("Pilih minimal satu kapabilitas akses sub-admin.");
  }

  // The division and logistics area are auto-derived from the capability set so
  // the admin only needs to pick capabilities — the dropdown is removed from
  // the form. The division is metadata for display; capabilities drive access.
  const { staffDivision, logisticsStaffArea } =
    deriveDivisionFromCapabilities(staffCapabilities);

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
  if (password.length < 8 || password.length > 50) {
    throw new Error("Password harus berisi 8 sampai 50 karakter.");
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

// Updating a sub-admin only changes identity and capabilities — it must NOT
// touch userStatus. The admin accidentally disabling an account while only
// trying to change access was a real bug: the old form included a userStatus
// select that could silently send INACTIVE. Status changes are now a separate
// concern from capability changes.
export async function updateSubAdmin(formData: FormData) {
  await requireAdmin();
  const id = text(formData, "id");
  const identity = parseIdentity(formData);
  if (!id) throw new Error("ID sub-admin tidak valid.");

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
