"use server";

import { revalidatePath } from "next/cache";
import type { CatalogCustomerType, Prisma } from "@prisma/client";

import { authOptions } from "@/lib/auth";
import { canManageMektekCustomers } from "@/lib/mektek/permissions";
import {
  buildPhoneAccountEmail,
  isValidPhoneNumber,
  normalizePhoneNumber,
} from "@/lib/phone";
import { boundedText, MAX_NAME_LEN } from "@/lib/mektek/sanitize";
import { prismadb } from "@/lib/prisma";
import { getServerSession } from "@/lib/session";
import { hashPassword } from "@/lib/password";
import { normalizeEmail as normalizeRealEmail } from "@/lib/email/validation";

const DEFAULT_PAGE_SIZE = 12;
const customerTypes = new Set(["STANDARD", "B2B"]);

// Accounts created from a phone number only get a synthesized address that no
// inbox is ever behind. Staff must be able to tell those apart from a real one.
const PHONE_PLACEHOLDER_SUFFIX = "@phone.nextcrm.local";

// Not exported: this module is "use server", where every export must be an async
// server action. The client reads the precomputed flag on the row instead.
function isPlaceholderEmail(email: string | null | undefined): boolean {
  return String(email ?? "")
    .toLowerCase()
    .endsWith(PHONE_PLACEHOLDER_SUFFIX);
}

export type CustomerUserInput = {
  name: string;
  phone: string;
  customerType?: string;
  email?: string;
  password?: string;
  // Staff-set WhatsApp do-not-contact toggle.
  whatsappOptedOut?: boolean;
};

export type CustomerUserRow = {
  id: string;
  username: string;
  phone: string;
  phoneNormalized: string;
  customerType: CatalogCustomerType;
  createdAt: Date;
  updatedAt: Date;
  serviceCount: number;
  whatsappOptedOutAt: Date | null;
  whatsappOptedOutSource: string | null;
  user: {
    id: string;
    name: string | null;
    email: string;
    // True when `email` is the synthesized <digits>@phone.nextcrm.local
    // placeholder, i.e. the customer has no reachable inbox.
    emailIsPlaceholder: boolean;
    isAdmin: boolean;
    mektekRole: "CS" | "TECHNICIAN" | null;
    staffDivision: import("@/lib/auth/staff-divisions").StaffDivision | null;
    lastLoginAt: Date | null;
  } | null;
};

async function ensureCustomerAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { error: "Unauthorized: silakan Login" };
  if (!canManageMektekCustomers(session.user)) {
    return { error: "Forbidden: hanya Admin yang dapat mengelola Customer" };
  }
  return { session };
}

function compactText(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function normalizeEmail(value: unknown) {
  return compactText(value).toLowerCase();
}

function normalizeCustomerUserInput(input: CustomerUserInput) {
  const name = boundedText(input.name, MAX_NAME_LEN);
  const phone = compactText(input.phone);
  const phoneNormalized = normalizePhoneNumber(phone);
  const rawEmail = normalizeEmail(input.email);
  const password = String(input.password ?? "");
  const customerType = customerTypes.has(String(input.customerType))
    ? (String(input.customerType) as CatalogCustomerType)
    : ("STANDARD" as CatalogCustomerType);
  if (!name) return { error: "Nama Customer wajib diisi" };
  if (!isValidPhoneNumber(phone)) return { error: "Nomor telepon tidak valid" };

  // A typed-in address is validated strictly (lib/email/validation). Leaving it
  // blank — or re-submitting the synthesized placeholder unchanged — falls back
  // to the phone placeholder, which keeps walk-in creation working.
  let email: string;
  if (!rawEmail || isPlaceholderEmail(rawEmail)) {
    email = buildPhoneAccountEmail(phoneNormalized);
  } else {
    const validEmail = normalizeRealEmail(rawEmail);
    if (!validEmail) return { error: "Email tidak valid" };
    email = validEmail;
  }

  if (password && password.length < 8) {
    return { error: "Password minimal 8 karakter" };
  }

  return {
    data: {
      name,
      phone,
      phoneNormalized,
      email,
      password,
      customerType,
      whatsappOptedOut: input.whatsappOptedOut === true,
    },
  };
}

function customerWhere(input?: { query?: string }): Prisma.CatalogCustomerWhereInput {
  const query = compactText(input?.query);
  if (!query) return {};

  const phoneNormalized = normalizePhoneNumber(query);
  return {
    OR: [
      { username: { contains: query, mode: "insensitive" } },
      { phone: { contains: query } },
      { phoneNormalized: { contains: phoneNormalized || query } },
      { vehicleName: { contains: query, mode: "insensitive" } },
      { vehiclePlateNumber: { contains: query, mode: "insensitive" } },
      { vehicleFleetNumber: { contains: query, mode: "insensitive" } },
      {
        vehicles: {
          some: {
            OR: [
              { name: { contains: query, mode: "insensitive" } },
              { plateNumber: { contains: query, mode: "insensitive" } },
              { fleetNumber: { contains: query, mode: "insensitive" } },
            ],
          },
        },
      },
      { user: { name: { contains: query, mode: "insensitive" } } },
      { user: { username: { contains: query, mode: "insensitive" } } },
      { user: { email: { contains: query, mode: "insensitive" } } },
    ],
  };
}

function formatPrismaError(error: unknown, fallback: string) {
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    error.code === "P2002"
  ) {
    return "Customer atau User dengan nomor telepon/Email ini sudah tersedia";
  }
  return fallback;
}

export async function listMektekCustomerUsers(input?: {
  query?: string;
  page?: number;
  pageSize?: number;
}) {
  const access = await ensureCustomerAdmin();
  if ("error" in access) return { error: access.error };

  const pageSize = Math.min(Math.max(Number(input?.pageSize) || DEFAULT_PAGE_SIZE, 1), 50);
  const requestedPage = Math.max(Number(input?.page) || 1, 1);
  const where = customerWhere(input);
  const totalCount = await prismadb.catalogCustomer.count({ where });
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const page = Math.min(requestedPage, totalPages);

  const customers = await prismadb.catalogCustomer.findMany({
    where,
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    skip: (page - 1) * pageSize,
    take: pageSize,
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          is_admin: true,
          mektekRole: true,
          staffDivision: true,
          lastLoginAt: true,
        },
      },
      _count: {
        select: {
          serviceLinks: true,
        },
      },
    },
  });

  const items: CustomerUserRow[] = customers.map((customer) => ({
    id: customer.id,
    username: customer.username,
    phone: customer.phone,
    phoneNormalized: customer.phoneNormalized,
    customerType: customer.customerType,
    createdAt: customer.createdAt,
    updatedAt: customer.updatedAt,
    serviceCount: customer._count.serviceLinks,
    whatsappOptedOutAt: customer.whatsappOptedOutAt,
    whatsappOptedOutSource: customer.whatsappOptedOutSource,
    user: customer.user
      ? {
          id: customer.user.id,
          name: customer.user.name,
          email: customer.user.email,
          emailIsPlaceholder: isPlaceholderEmail(customer.user.email),
          isAdmin: customer.user.is_admin,
          mektekRole: customer.user.mektekRole,
          staffDivision: customer.user.staffDivision,
          lastLoginAt: customer.user.lastLoginAt,
        }
      : null,
  }));

  return {
    data: {
      items,
      page,
      pageSize,
      totalCount,
      totalPages,
    },
  };
}

export async function createMektekCustomerUser(input: CustomerUserInput) {
  const access = await ensureCustomerAdmin();
  if ("error" in access) return { error: access.error };

  const normalized = normalizeCustomerUserInput(input);
  if ("error" in normalized) return { error: normalized.error };
  const data = normalized.data;

  try {
    const customer = await prismadb.$transaction(async (tx) => {
      const password = data.password
        ? await hashPassword(data.password)
        : undefined;
      const user = await tx.users.create({
        data: {
          name: data.name,
          username: data.name,
          avatar: "",
          account_name: "Mektek Customer",
          is_account_admin: false,
          is_admin: false,
          email: data.email,
          phone: data.phone,
          phoneNormalized: data.phoneNormalized,
          userLanguage: "id",
          userStatus: "ACTIVE",
          mektekRole: null,
          ...(password ? { password } : {}),
        },
      });

      return tx.catalogCustomer.create({
        data: {
          username: data.name,
          phone: data.phone,
          phoneNormalized: data.phoneNormalized,
          customerType: data.customerType,
          userId: user.id,
          ...(data.whatsappOptedOut
            ? {
                whatsappOptedOutAt: new Date(),
                whatsappOptedOutSource: "staff",
              }
            : {}),
        },
      });
    });

    revalidatePath("/[locale]/(routes)/mektek/customers", "page");
    return { data: customer };
  } catch (error) {
    console.log("[CREATE_MEKTEK_CUSTOMER_USER]", error);
    return { error: formatPrismaError(error, "Gagal membuat Customer") };
  }
}

export async function updateMektekCustomerUser(id: string, input: CustomerUserInput) {
  const access = await ensureCustomerAdmin();
  if ("error" in access) return { error: access.error };

  const customerId = compactText(id);
  if (!customerId) return { error: "Customer ID wajib diisi" };

  const normalized = normalizeCustomerUserInput(input);
  if ("error" in normalized) return { error: normalized.error };
  const data = normalized.data;

  try {
    const customer = await prismadb.$transaction(async (tx) => {
      const existing = await tx.catalogCustomer.findUnique({
        where: { id: customerId },
        select: {
          id: true,
          userId: true,
          whatsappOptedOutAt: true,
          whatsappOptedOutSource: true,
          user: {
            select: {
              is_admin: true,
              mektekRole: true,
              staffDivision: true,
            },
          },
        },
      });

      if (!existing) {
        throw new Error("CUSTOMER_NOT_FOUND");
      }

      if (existing.user?.is_admin || existing.user?.mektekRole || existing.user?.staffDivision) {
        throw new Error("PROTECTED_ACCOUNT");
      }

      const password = data.password
        ? await hashPassword(data.password)
        : undefined;
      const userPayload = {
        name: data.name,
        username: data.name,
        account_name: "Mektek Customer",
        is_admin: false,
        email: data.email,
        phone: data.phone,
        phoneNormalized: data.phoneNormalized,
        mektekRole: null,
        ...(password ? { password } : {}),
      };

      let userId = existing.userId;
      if (userId) {
        await tx.users.update({
          where: { id: userId },
          data: {
            ...userPayload,
            ...(password ? { authVersion: { increment: 1 } } : {}),
          },
        });
        if (password) {
          await tx.customerSession.updateMany({
            where: { userId, revokedAt: null },
            data: { revokedAt: new Date() },
          });
        }
      } else {
        const user = await tx.users.create({
          data: {
            ...userPayload,
            avatar: "",
            is_account_admin: false,
            userLanguage: "id",
            userStatus: "ACTIVE",
          },
        });
        userId = user.id;
      }

      return tx.catalogCustomer.update({
        where: { id: customerId },
        data: {
          username: data.name,
          phone: data.phone,
          phoneNormalized: data.phoneNormalized,
          customerType: data.customerType,
          userId,
        },
      });
    });

    revalidatePath("/[locale]/(routes)/mektek/customers", "page");
    revalidatePath("/[locale]/customer/profile", "page");
    return { data: customer };
  } catch (error) {
    console.log("[UPDATE_MEKTEK_CUSTOMER_USER]", error);
    if (error instanceof Error && error.message === "CUSTOMER_NOT_FOUND") {
      return { error: "Customer tidak ditemukan" };
    }
    if (error instanceof Error && error.message === "PROTECTED_ACCOUNT") {
      return { error: "Admin dan Staff Account tidak dapat diedit dari Customer Management" };
    }
    return { error: formatPrismaError(error, "Gagal memperbarui Customer") };
  }
}

export async function deleteMektekCustomerUser(id: string) {
  const access = await ensureCustomerAdmin();
  if ("error" in access) return { error: access.error };

  const customerId = compactText(id);
  if (!customerId) return { error: "Customer ID wajib diisi" };

  try {
    await prismadb.$transaction(async (tx) => {
      const customer = await tx.catalogCustomer.findUnique({
        where: { id: customerId },
        include: {
          user: {
            select: {
              id: true,
              is_admin: true,
              mektekRole: true,
              staffDivision: true,
            },
          },
        },
      });

      if (!customer) {
        throw new Error("CUSTOMER_NOT_FOUND");
      }

      if (customer.user?.is_admin || customer.user?.mektekRole || customer.user?.staffDivision) {
        throw new Error("PROTECTED_ACCOUNT");
      }

      if (customer.userId === access.session.user.id) {
        throw new Error("SELF_DELETE");
      }

      await tx.catalogCustomer.delete({
        where: { id: customer.id },
      });

      if (customer.userId) {
        await tx.users.delete({
          where: { id: customer.userId },
        });
      }
    });

    revalidatePath("/[locale]/(routes)/mektek/customers", "page");
    return { data: { id: customerId } };
  } catch (error) {
    console.log("[DELETE_MEKTEK_CUSTOMER_USER]", error);
    if (error instanceof Error) {
      if (error.message === "CUSTOMER_NOT_FOUND") return { error: "Customer tidak ditemukan" };
      if (error.message === "SELF_DELETE") return { error: "Anda tidak dapat menghapus User Account sendiri" };
      if (error.message === "PROTECTED_ACCOUNT") {
        return { error: "Admin dan Staff Account tidak dapat dihapus dari Customer Management" };
      }
    }
    return { error: "Gagal menghapus Customer" };
  }
}
