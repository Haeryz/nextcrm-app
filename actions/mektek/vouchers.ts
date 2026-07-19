"use server";

import { revalidatePath } from "next/cache";
import type {
  CatalogCustomerType,
  MektekVoucherDiscountType,
  MektekVoucherScope,
  Prisma,
} from "@prisma/client";

import { authOptions } from "@/lib/auth";
import { canManageMektekVouchers } from "@/lib/mektek/permissions";
import { boundedText } from "@/lib/mektek/sanitize";
import {
  cleanMektekVoucherCode,
  normalizeMektekVoucherCode,
} from "@/lib/mektek/vouchers";
import { prismadb } from "@/lib/prisma";
import { getServerSession } from "@/lib/session";

const DEFAULT_PAGE_SIZE = 12;
const MAX_CODE_LEN = 40;
const MAX_TITLE_LEN = 120;
const MAX_DESCRIPTION_LEN = 300;

const voucherDiscountTypes = new Set(["FIXED", "PERCENTAGE"]);
const voucherScopes = new Set(["ALL", "CUSTOMER_TYPE", "CUSTOMER"]);
const customerTypes = new Set(["STANDARD", "B2B"]);

export type MektekVoucherInput = {
  code: string;
  title: string;
  description?: string;
  minSubtotal?: string | number;
  discountType: string;
  discountAmount?: string | number;
  discountPercent?: string | number;
  maxDiscount?: string | number;
  scope: string;
  customerType?: string;
  customerId?: string;
  isActive?: boolean;
  startsAt?: string;
  expiresAt?: string;
  usageLimit?: string | number;
};

export type MektekVoucherCustomerOption = {
  id: string;
  label: string;
  phone: string;
  customerType: CatalogCustomerType;
};

export type MektekVoucherAdminRow = {
  id: string;
  code: string;
  title: string;
  description: string;
  minSubtotal: number;
  discountType: MektekVoucherDiscountType;
  discountAmount: number | null;
  discountPercent: number | null;
  maxDiscount: number | null;
  scope: MektekVoucherScope;
  customerType: CatalogCustomerType | null;
  customerId: string | null;
  isActive: boolean;
  startsAt: Date | null;
  expiresAt: Date | null;
  usageLimit: number | null;
  usedCount: number;
  createdAt: Date;
  updatedAt: Date;
  customer: MektekVoucherCustomerOption | null;
};

async function ensureVoucherAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { error: "Unauthorized: silakan Login" };
  if (!canManageMektekVouchers(session.user)) {
    return { error: "Forbidden: hanya Admin yang dapat mengelola Voucher" };
  }
  return { session };
}

function compactText(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function parseWholeNumber(value: unknown, fallback = 0) {
  if (value === null || value === undefined || value === "") return fallback;
  const parsed = Number(String(value).replace(/[^\d]/g, ""));
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : fallback;
}

function parseOptionalWholeNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = parseWholeNumber(value, 0);
  return parsed > 0 ? parsed : null;
}

function parseDate(value: unknown, endOfDay = false) {
  const text = compactText(value);
  if (!text) return null;

  const date = new Date(
    /^\d{4}-\d{2}-\d{2}$/.test(text)
      ? `${text}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}`
      : text
  );

  return Number.isNaN(date.getTime()) ? null : date;
}

function buildCustomerOption(customer: {
  id: string;
  username: string;
  phone: string;
  customerType: CatalogCustomerType;
  user: { name: string | null; email: string } | null;
}): MektekVoucherCustomerOption {
  return {
    id: customer.id,
    label: customer.user?.name || customer.username,
    phone: customer.phone,
    customerType: customer.customerType,
  };
}

function formatPrismaError(error: unknown, fallback: string) {
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    error.code === "P2002"
  ) {
    return "Voucher dengan Code ini sudah tersedia";
  }
  return fallback;
}

function voucherWhere(input?: { query?: string }): Prisma.MektekVoucherWhereInput {
  const query = compactText(input?.query);
  if (!query) return {};

  return {
    OR: [
      { code: { contains: query, mode: "insensitive" } },
      { title: { contains: query, mode: "insensitive" } },
      { description: { contains: query, mode: "insensitive" } },
      { customer: { username: { contains: query, mode: "insensitive" } } },
      { customer: { phone: { contains: query } } },
      { customer: { user: { name: { contains: query, mode: "insensitive" } } } },
      { customer: { user: { email: { contains: query, mode: "insensitive" } } } },
    ],
  };
}

async function normalizeVoucherInput(input: MektekVoucherInput) {
  const code = normalizeMektekVoucherCode(input.code).slice(0, MAX_CODE_LEN);
  const normalizedCode = cleanMektekVoucherCode(code);
  const title = boundedText(input.title, MAX_TITLE_LEN);
  const description = boundedText(input.description, MAX_DESCRIPTION_LEN);
  const minSubtotal = parseWholeNumber(input.minSubtotal, 0);
  const discountType = voucherDiscountTypes.has(String(input.discountType))
    ? (String(input.discountType) as MektekVoucherDiscountType)
    : ("FIXED" as MektekVoucherDiscountType);
  const scope = voucherScopes.has(String(input.scope))
    ? (String(input.scope) as MektekVoucherScope)
    : ("ALL" as MektekVoucherScope);
  const customerType =
    scope === "CUSTOMER_TYPE" && customerTypes.has(String(input.customerType))
      ? (String(input.customerType) as CatalogCustomerType)
      : null;
  const customerId = scope === "CUSTOMER" ? compactText(input.customerId) : null;
  const startsAt = parseDate(input.startsAt);
  const expiresAt = parseDate(input.expiresAt, true);
  const usageLimit = parseOptionalWholeNumber(input.usageLimit);

  if (normalizedCode.length < 3) return { error: "Voucher Code wajib diisi" };
  if (!title) return { error: "Voucher Title wajib diisi" };
  if (!description) return { error: "Voucher Description wajib diisi" };
  if (scope === "CUSTOMER_TYPE" && !customerType) {
    return { error: "Target Customer type wajib dipilih" };
  }
  if (scope === "CUSTOMER" && !customerId) {
    return { error: "Target Customer wajib dipilih" };
  }
  if (startsAt && expiresAt && expiresAt.getTime() < startsAt.getTime()) {
    return { error: "Expiry Date harus setelah Start Date" };
  }

  const discountAmount =
    discountType === "FIXED" ? parseWholeNumber(input.discountAmount, 0) : null;
  const discountPercent =
    discountType === "PERCENTAGE"
      ? Math.min(parseWholeNumber(input.discountPercent, 0), 100)
      : null;
  const maxDiscount =
    discountType === "PERCENTAGE" ? parseOptionalWholeNumber(input.maxDiscount) : null;

  if (discountType === "FIXED" && (!discountAmount || discountAmount <= 0)) {
    return { error: "Fixed Discount Amount harus lebih dari nol" };
  }
  if (discountType === "PERCENTAGE" && (!discountPercent || discountPercent <= 0)) {
    return { error: "Percentage Discount harus antara 1 dan 100" };
  }

  if (customerId) {
    const customer = await prismadb.catalogCustomer.findUnique({
      where: { id: customerId },
      select: { id: true },
    });
    if (!customer) return { error: "Customer yang dipilih tidak ditemukan" };
  }

  return {
    data: {
      code,
      normalizedCode,
      title,
      description,
      minSubtotal,
      discountType,
      discountAmount,
      discountPercent,
      maxDiscount,
      scope,
      customerType,
      customerId,
      isActive: input.isActive !== false,
      startsAt,
      expiresAt,
      usageLimit,
    },
  };
}

function serializeVoucher(
  voucher: Prisma.MektekVoucherGetPayload<{
    include: {
      customer: {
        select: {
          id: true;
          username: true;
          phone: true;
          customerType: true;
          user: { select: { name: true; email: true } };
        };
      };
    };
  }>
): MektekVoucherAdminRow {
  return {
    id: voucher.id,
    code: voucher.code,
    title: voucher.title,
    description: voucher.description,
    minSubtotal: voucher.minSubtotal,
    discountType: voucher.discountType,
    discountAmount: voucher.discountAmount,
    discountPercent: voucher.discountPercent,
    maxDiscount: voucher.maxDiscount,
    scope: voucher.scope,
    customerType: voucher.customerType,
    customerId: voucher.customerId,
    isActive: voucher.isActive,
    startsAt: voucher.startsAt,
    expiresAt: voucher.expiresAt,
    usageLimit: voucher.usageLimit,
    usedCount: voucher.usedCount,
    createdAt: voucher.createdAt,
    updatedAt: voucher.updatedAt,
    customer: voucher.customer ? buildCustomerOption(voucher.customer) : null,
  };
}

export async function listMektekVoucherCustomerOptions(input?: { query?: string }) {
  const access = await ensureVoucherAdmin();
  if ("error" in access) return { error: access.error };

  const query = compactText(input?.query);
  const customers = await prismadb.catalogCustomer.findMany({
    where: query
      ? {
          OR: [
            { username: { contains: query, mode: "insensitive" } },
            { phone: { contains: query } },
            { user: { name: { contains: query, mode: "insensitive" } } },
            { user: { email: { contains: query, mode: "insensitive" } } },
          ],
        }
      : {},
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    take: 200,
    select: {
      id: true,
      username: true,
      phone: true,
      customerType: true,
      user: {
        select: {
          name: true,
          email: true,
        },
      },
    },
  });

  return {
    data: customers.map(buildCustomerOption),
  };
}

export async function listMektekVouchers(input?: {
  query?: string;
  page?: number;
  pageSize?: number;
}) {
  const access = await ensureVoucherAdmin();
  if ("error" in access) return { error: access.error };

  const pageSize = Math.min(Math.max(Number(input?.pageSize) || DEFAULT_PAGE_SIZE, 1), 50);
  const requestedPage = Math.max(Number(input?.page) || 1, 1);
  const where = voucherWhere(input);
  const totalCount = await prismadb.mektekVoucher.count({ where });
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const page = Math.min(requestedPage, totalPages);

  const vouchers = await prismadb.mektekVoucher.findMany({
    where,
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    skip: (page - 1) * pageSize,
    take: pageSize,
    include: {
      customer: {
        select: {
          id: true,
          username: true,
          phone: true,
          customerType: true,
          user: {
            select: {
              name: true,
              email: true,
            },
          },
        },
      },
    },
  });

  return {
    data: {
      items: vouchers.map(serializeVoucher),
      page,
      pageSize,
      totalCount,
      totalPages,
    },
  };
}

export async function createMektekVoucher(input: MektekVoucherInput) {
  const access = await ensureVoucherAdmin();
  if ("error" in access) return { error: access.error };

  const normalized = await normalizeVoucherInput(input);
  if ("error" in normalized) return { error: normalized.error };

  try {
    const voucher = await prismadb.mektekVoucher.create({
      data: normalized.data,
    });

    revalidatePath("/[locale]/(routes)/mektek/vouchers", "page");
    revalidatePath("/[locale]/customer/profile", "page");
    return { data: voucher };
  } catch (error) {
    console.log("[CREATE_MEKTEK_VOUCHER]", error);
    return { error: formatPrismaError(error, "Gagal membuat Voucher") };
  }
}

export async function updateMektekVoucher(id: string, input: MektekVoucherInput) {
  const access = await ensureVoucherAdmin();
  if ("error" in access) return { error: access.error };

  const voucherId = compactText(id);
  if (!voucherId) return { error: "Voucher ID wajib diisi" };

  const normalized = await normalizeVoucherInput(input);
  if ("error" in normalized) return { error: normalized.error };

  try {
    const voucher = await prismadb.mektekVoucher.update({
      where: { id: voucherId },
      data: normalized.data,
    });

    revalidatePath("/[locale]/(routes)/mektek/vouchers", "page");
    revalidatePath("/[locale]/customer/profile", "page");
    return { data: voucher };
  } catch (error) {
    console.log("[UPDATE_MEKTEK_VOUCHER]", error);
    return { error: formatPrismaError(error, "Gagal memperbarui Voucher") };
  }
}

export async function deleteMektekVoucher(id: string) {
  const access = await ensureVoucherAdmin();
  if ("error" in access) return { error: access.error };

  const voucherId = compactText(id);
  if (!voucherId) return { error: "Voucher ID wajib diisi" };

  try {
    const voucher = await prismadb.mektekVoucher.findUnique({
      where: { id: voucherId },
      select: {
        id: true,
        usedCount: true,
      },
    });

    if (!voucher) return { error: "Voucher tidak ditemukan" };
    if (voucher.usedCount > 0) {
      return { error: "Voucher yang sudah digunakan tidak dapat dihapus. Ubah Status menjadi Inactive." };
    }

    await prismadb.mektekVoucher.delete({
      where: { id: voucher.id },
    });

    revalidatePath("/[locale]/(routes)/mektek/vouchers", "page");
    revalidatePath("/[locale]/customer/profile", "page");
    return { data: { id: voucher.id } };
  } catch (error) {
    console.log("[DELETE_MEKTEK_VOUCHER]", error);
    return { error: "Gagal menghapus Voucher" };
  }
}
