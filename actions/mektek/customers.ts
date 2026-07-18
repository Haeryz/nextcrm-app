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

const DEFAULT_PAGE_SIZE = 12;
const customerTypes = new Set(["STANDARD", "B2B"]);

export type CustomerUserInput = {
  name: string;
  phone: string;
  customerType?: string;
  email?: string;
  password?: string;
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
  user: {
    id: string;
    name: string | null;
    email: string;
    isAdmin: boolean;
    mektekRole: "CS" | "TECHNICIAN" | null;
    lastLoginAt: Date | null;
  } | null;
};

async function ensureCustomerAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { error: "Unauthorized" };
  if (!canManageMektekCustomers(session.user)) {
    return { error: "Forbidden: only admins can manage customers" };
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
  const email = normalizeEmail(input.email) || buildPhoneAccountEmail(phoneNormalized);
  const password = String(input.password ?? "");
  const customerType = customerTypes.has(String(input.customerType))
    ? (String(input.customerType) as CatalogCustomerType)
    : ("STANDARD" as CatalogCustomerType);
  if (!name) return { error: "Customer name is required" };
  if (!isValidPhoneNumber(phone)) return { error: "Phone number is invalid" };
  if (!email.includes("@")) return { error: "Email is invalid" };
  if (password && password.length < 8) {
    return { error: "Password must be at least 8 characters" };
  }

  return {
    data: {
      name,
      phone,
      phoneNormalized,
      email,
      password,
      customerType,
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
    return "A customer or user with this phone/email already exists";
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
    user: customer.user
      ? {
          id: customer.user.id,
          name: customer.user.name,
          email: customer.user.email,
          isAdmin: customer.user.is_admin,
          mektekRole: customer.user.mektekRole,
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
          userLanguage: "en",
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
        },
      });
    });

    revalidatePath("/[locale]/(routes)/mektek/customers", "page");
    return { data: customer };
  } catch (error) {
    console.log("[CREATE_MEKTEK_CUSTOMER_USER]", error);
    return { error: formatPrismaError(error, "Failed to create customer") };
  }
}

export async function updateMektekCustomerUser(id: string, input: CustomerUserInput) {
  const access = await ensureCustomerAdmin();
  if ("error" in access) return { error: access.error };

  const customerId = compactText(id);
  if (!customerId) return { error: "Customer ID is required" };

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
          user: {
            select: {
              is_admin: true,
              mektekRole: true,
            },
          },
        },
      });

      if (!existing) {
        throw new Error("CUSTOMER_NOT_FOUND");
      }

      if (existing.user?.is_admin || existing.user?.mektekRole) {
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
            userLanguage: "en",
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
      return { error: "Customer not found" };
    }
    if (error instanceof Error && error.message === "PROTECTED_ACCOUNT") {
      return { error: "Admin and staff accounts cannot be edited from customer management" };
    }
    return { error: formatPrismaError(error, "Failed to update customer") };
  }
}

export async function deleteMektekCustomerUser(id: string) {
  const access = await ensureCustomerAdmin();
  if ("error" in access) return { error: access.error };

  const customerId = compactText(id);
  if (!customerId) return { error: "Customer ID is required" };

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
            },
          },
        },
      });

      if (!customer) {
        throw new Error("CUSTOMER_NOT_FOUND");
      }

      if (customer.user?.is_admin || customer.user?.mektekRole) {
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
      if (error.message === "CUSTOMER_NOT_FOUND") return { error: "Customer not found" };
      if (error.message === "SELF_DELETE") return { error: "You cannot delete your own user account" };
      if (error.message === "PROTECTED_ACCOUNT") {
        return { error: "Admin and staff accounts cannot be deleted from customer management" };
      }
    }
    return { error: "Failed to delete customer" };
  }
}
