"use server";

import { authOptions } from "@/lib/auth";
import { prismadb } from "@/lib/prisma";
import { getServerSession } from "@/lib/session";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import crypto from "crypto";
import type { Prisma } from "@prisma/client";
import {
  notifyMektekOrderCompleted,
  notifyMektekOrderCreated,
} from "@/actions/mektek/whatsapp-notifications";
import {
  buildMektekStoredItems,
  normalizeMektekLineItems,
  type MektekLineItemInput,
} from "@/lib/mektek/items";
import { buildMektekFinancialSummary } from "@/lib/mektek/financials";
import {
  canCreateMektekOrders,
  canManageMektekPayments,
  canUpdateMektekProgress,
  canUseMektekCustomerTools,
} from "@/lib/mektek/permissions";
import { calculateMektekDiscountAmount } from "@/lib/mektek/loyalty";
import { parseMoney } from "@/lib/mektek/items";
import {
  findMektekVoucherRecordByCode,
  reserveMektekVoucherUse,
} from "@/lib/mektek/voucher-db";
import {
  MEKTEK_TITLE_PREFIX,
  mektekOrderWhere,
  mektekPaymentSelect,
} from "@/lib/mektek/orders";
import { isValidPhoneNumber, normalizePhoneNumber } from "@/lib/phone";
import {
  boundedText,
  MAX_ADDRESS_LEN,
  MAX_COMPLAINT_LEN,
  MAX_NAME_LEN,
  MAX_VEHICLE_LEN,
} from "@/lib/mektek/sanitize";
import {
  calculateMektekVoucherDiscount,
  isMektekVoucherAvailable,
  toMektekVoucher,
} from "@/lib/mektek/vouchers";

const DEFAULT_TIMELINE_MESSAGE =
  "Layanan Anda telah terbuat. Tim kami sedang menyiapkan pemeriksaan awal kendaraan.";

/**
 * Constant-time string comparison for access secrets (customer tokens). Hashing
 * both sides to a fixed-length digest lets us compare with `timingSafeEqual`
 * without leaking length and without it throwing on differing input lengths.
 * Low risk at 20-byte entropy, but keeps this consistent with the webhook's
 * `timingSafeEqual` signature check.
 */
const constantTimeEqual = (a: string, b: string): boolean => {
  const ha = crypto.createHash("sha256").update(a).digest();
  const hb = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
};

type MektekTimelineEntry = {
  id: string;
  description: string;
  createdAt: string;
  completed: boolean;
};

const parseTagsObject = (tags: unknown): Record<string, unknown> => {
  if (!tags || typeof tags !== "object" || Array.isArray(tags)) {
    return {};
  }
  return tags as Record<string, unknown>;
};

const parseWhatsappMeta = (tags: Record<string, unknown>): Record<string, unknown> => {
  const whatsapp = tags.whatsapp;
  if (!whatsapp || typeof whatsapp !== "object" || Array.isArray(whatsapp)) return {};
  return whatsapp as Record<string, unknown>;
};

type CreateMektekServiceOrderInput = {
  customerName: string;
  vehicle: string;
  complaint: string;
  technicianId?: string;
  phone?: string;
  address?: string;
  customerType?: "STANDARD" | "B2B";
  estimatedDone?: string;
  manualDiscount?: string | number;
  voucherCode?: string;
  serviceItems?: MektekLineItemInput[];
  sparepartItems?: MektekLineItemInput[];
};

export type MektekCustomerSearchResult = {
  id: string;
  name: string;
  phone: string;
  phoneNormalized: string;
  customerType: "STANDARD" | "B2B";
  address: string | null;
  source: "customer" | "user";
};

export type MektekTechnicianOption = {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
};

const parseTimeline = (tags: unknown): MektekTimelineEntry[] => {
  const tagsObject = parseTagsObject(tags);
  const timeline = tagsObject.timeline;
  if (!Array.isArray(timeline)) return [];

  return timeline
    .map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return null;
      const row = item as Record<string, unknown>;
      const description = typeof row.description === "string" ? row.description.trim() : "";
      const createdAt = typeof row.createdAt === "string" ? row.createdAt : new Date().toISOString();
      const completed = typeof row.completed === "boolean" ? row.completed : true;
      const id = typeof row.id === "string" ? row.id : crypto.randomUUID();

      if (!description) return null;
      return { id, description, createdAt, completed };
    })
    .filter((row): row is MektekTimelineEntry => !!row)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
};

// These links are sent to customers over WhatsApp, so the base URL must come
// from trusted server-side config — NEVER from attacker-controllable
// `Host`/`X-Forwarded-Host` request headers (host-header injection → phishing).
// Request headers are used only as a last resort, and only when the host is a
// loopback/local address so a spoofed Host header can't poison the link.
const buildAppUrl = async () => {
  const configuredUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "") ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");

  if (configuredUrl) {
    return configuredUrl.replace(/\/+$/, "");
  }

  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "";
  const hostname = host.split(":")[0];
  const isLocal =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "0.0.0.0" ||
    hostname.endsWith(".local");
  if (host && isLocal) {
    const proto = requestHeaders.get("x-forwarded-proto") || "http";
    return `${proto}://${host}`;
  }

  return "http://localhost:3000";
};

const createCustomerCode = () => crypto.randomBytes(12).toString("base64url");

const buildCustomerTrackingLink = async (code: string, locale?: string) => {
  const appUrl = await buildAppUrl();
  const safeLocale = locale || "en";
  return `${appUrl}/${safeLocale}/s/${code}`;
};

export const createMektekServiceOrder = async (
  input: CreateMektekServiceOrderInput
) => {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { error: "Unauthorized" };
  }
  if (!canCreateMektekOrders(session.user)) {
    return { error: "Forbidden: only MekTek admin or CS can create service orders" };
  }

  const customerName = boundedText(input?.customerName, MAX_NAME_LEN);
  const vehicle = boundedText(input?.vehicle, MAX_VEHICLE_LEN);
  const complaint = boundedText(input?.complaint, MAX_COMPLAINT_LEN);
  const phone = String(input?.phone ?? "").trim();
  const address = boundedText(input?.address, MAX_ADDRESS_LEN);
  const customerType = input?.customerType === "B2B" ? "B2B" : "STANDARD";
  const technicianId = String(input?.technicianId ?? "").trim();
  const phoneNormalized = normalizePhoneNumber(phone);
  const manualDiscount = parseMoney(input?.manualDiscount);
  const voucherCode = String(input?.voucherCode ?? "").trim();

  if (!customerName || !vehicle || !complaint) {
    return { error: "Customer name, vehicle, and complaint are required" };
  }
  if (!isValidPhoneNumber(phone)) {
    return { error: "Phone number is required to add the customer to Customer/Users" };
  }

  let dueDateAt: Date | undefined;
  const estimatedDone = String(input?.estimatedDone ?? "").trim();
  if (estimatedDone) {
    const parsedDate = new Date(estimatedDone);
    if (Number.isNaN(parsedDate.getTime())) {
      return { error: "Estimated done date is invalid" };
    }
    dueDateAt = parsedDate;
  }

  const customerToken = crypto.randomBytes(20).toString("hex");
  const customerCode = createCustomerCode();
  const serviceItems = buildMektekStoredItems(input?.serviceItems, "service");
  const sparepartItems = buildMektekStoredItems(input?.sparepartItems, "sparepart");
  const locale = session.user.userLanguage || "en";

  try {
    const task = await prismadb.$transaction(async (tx) => {
      const technician = technicianId
        ? await tx.users.findFirst({
            where: {
              id: technicianId,
              mektekRole: "TECHNICIAN",
              userStatus: "ACTIVE",
            },
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
            },
          })
        : null;

      if (technicianId && !technician) {
        throw new Error("INVALID_TECHNICIAN");
      }

      const catalogCustomer = await tx.catalogCustomer.upsert({
        where: {
          phoneNormalized,
        },
        update: {
          phone,
          customerType,
        },
        create: {
          username: customerName,
          phone,
          phoneNormalized,
          customerType,
        },
        select: {
          id: true,
          customerType: true,
        },
      });
      const completedVisitCount = await tx.catalogServiceLink.count({
        where: {
          customerId: catalogCustomer.id,
          serviceOrder: {
            taskStatus: "COMPLETE",
          },
        },
      });
      const subtotal = normalizeMektekLineItems(
        {
          serviceItems,
          sparepartItems,
        },
        complaint
      ).subtotal;
      const loyalty = calculateMektekDiscountAmount(subtotal, completedVisitCount);
      const voucherRecord = voucherCode
        ? await findMektekVoucherRecordByCode(tx, voucherCode)
        : null;
      const voucherContext = {
        customerId: catalogCustomer.id,
        customerType: catalogCustomer.customerType,
      };
      const voucher = voucherRecord
        ? toMektekVoucher(voucherRecord, voucherContext)
        : null;
      const voucherDiscount = voucher
        ? calculateMektekVoucherDiscount(voucher, subtotal)
        : 0;

      if (voucherCode && !voucherRecord) {
        throw new Error("INVALID_VOUCHER");
      }
      if (voucherRecord && !isMektekVoucherAvailable(voucherRecord, voucherContext)) {
        throw new Error("LOCKED_VOUCHER");
      }
      if (voucher && voucherDiscount <= 0) {
        throw new Error("VOUCHER_MINIMUM_NOT_MET");
      }

      const appliesVoucher = manualDiscount <= 0 && voucherDiscount > 0;
      const discount = manualDiscount > 0
        ? manualDiscount
        : appliesVoucher
          ? voucherDiscount
          : loyalty.discountAmount;

      const serviceOrder = await tx.crm_Accounts_Tasks.create({
        data: {
          v: 0,
          title: `${MEKTEK_TITLE_PREFIX} ${vehicle}`,
          content: complaint,
          priority: "medium",
          taskStatus: "ACTIVE",
          user: technician?.id ?? null,
          createdBy: session.user.id,
          updatedBy: session.user.id,
          dueDateAt,
          tags: {
            module: "mektek",
            serviceType: "Vehicle Service",
            customerToken,
            customerCode,
            vehicle,
            customerName,
            phone,
            phoneNormalized,
            customerType: catalogCustomer.customerType,
            address: address || null,
            technician: technician
              ? {
                  id: technician.id,
                  name: technician.name,
                  email: technician.email,
                  phone: technician.phone,
                }
              : null,
            catalogCustomerId: catalogCustomer.id,
            completedVisitCount,
            loyaltyTier: loyalty.tier?.label ?? null,
            loyaltyDiscountRate: loyalty.discountRate,
            manualDiscount: manualDiscount || null,
            voucher: voucher && appliesVoucher
              ? {
                  id: voucher.id,
                  code: voucher.code,
                  title: voucher.title,
                  discountAmount: voucherDiscount,
                }
              : null,
            serviceItems,
            sparepartItems,
            discount,
            tax: 0,
            payment: {
              method: "cash",
              amountPaid: 0,
              status: "unpaid",
              updatedAt: null,
            },
            timeline: [
              {
                id: crypto.randomUUID(),
                description: DEFAULT_TIMELINE_MESSAGE,
                createdAt: new Date().toISOString(),
                completed: true,
              },
            ],
          },
        },
      });

      await tx.catalogServiceLink.upsert({
        where: {
          customerId_serviceOrderId: {
            customerId: catalogCustomer.id,
            serviceOrderId: serviceOrder.id,
          },
        },
        update: {
          source: "ADMIN_ASSIGN",
          token: customerToken,
        },
        create: {
          customerId: catalogCustomer.id,
          serviceOrderId: serviceOrder.id,
          source: "ADMIN_ASSIGN",
          token: customerToken,
        },
      });

      if (voucherRecord && appliesVoucher) {
        const reserved = await reserveMektekVoucherUse(tx, voucherRecord);
        if (!reserved) {
          throw new Error("LOCKED_VOUCHER");
        }
      }

      return serviceOrder;
    });

    if (!task?.id) {
      return { error: "Service order was not created" };
    }

    const customerTrackingLink = await buildCustomerTrackingLink(customerCode, locale);

    const tags = parseTagsObject(task.tags);
    const whatsappMeta = parseWhatsappMeta(tags);

    let whatsappResult: { ok: boolean; error?: string } = { ok: false, error: "Skipped" };
    try {
      whatsappResult = await notifyMektekOrderCreated({
        order: task,
        trackingLink: customerTrackingLink,
      });
    } catch (error) {
      console.log("[MEKTEK_WHATSAPP_ORDER_CREATED]", error);
    }

    if (whatsappResult.ok) {
      await prismadb.crm_Accounts_Tasks.update({
        where: { id: task.id },
        data: {
          tags: {
            ...tags,
            whatsapp: {
              ...whatsappMeta,
              orderCreatedAt: new Date().toISOString(),
              lastStatus: "ACTIVE",
            },
          },
        },
      });
    }

    revalidatePath("/[locale]/(routes)/mektek", "page");
    revalidatePath("/[locale]/(routes)/mektek/[id]", "page");
    revalidatePath("/[locale]/service-status/[id]", "page");
    return {
      data: {
        ...task,
        customerTrackingLink,
      },
    };
  } catch (error) {
    console.log("[CREATE_MEKTEK_SERVICE_ORDER]", error);
    if (error instanceof Error) {
      if (error.message === "INVALID_VOUCHER") return { error: "Voucher code is invalid" };
      if (error.message === "LOCKED_VOUCHER") return { error: "Voucher is not available for this customer" };
      if (error.message === "VOUCHER_MINIMUM_NOT_MET") return { error: "Voucher minimum purchase is not met" };
      if (error.message === "INVALID_TECHNICIAN") return { error: "Selected technician is not available" };
    }
    return { error: "Failed to create service order" };
  }
};

export const getMektekTechnicians = async (): Promise<{
  data?: MektekTechnicianOption[];
  error?: string;
}> => {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { error: "Unauthorized" };
  }
  if (!canCreateMektekOrders(session.user)) {
    return { error: "Forbidden: only MekTek admin or CS can view technicians" };
  }

  try {
    const technicians = await prismadb.users.findMany({
      where: {
        mektekRole: "TECHNICIAN",
        userStatus: "ACTIVE",
      },
      orderBy: [{ name: "asc" }, { email: "asc" }],
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
      },
    });

    return { data: technicians };
  } catch (error) {
    console.log("[GET_MEKTEK_TECHNICIANS]", error);
    return { error: "Failed to load technicians" };
  }
};

export const searchMektekCustomers = async (
  query: string
): Promise<{ data?: MektekCustomerSearchResult[]; error?: string }> => {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { error: "Unauthorized" };
  }
  if (!canCreateMektekOrders(session.user)) {
    return { error: "Forbidden: only MekTek admin or CS can search customers" };
  }

  const search = String(query ?? "").trim();
  if (search.length < 2) {
    return { data: [] };
  }

  const normalizedSearch = normalizePhoneNumber(search);
  const searchDigits = normalizedSearch.replace(/\D/g, "");
  const customerWhere: Prisma.CatalogCustomerWhereInput[] = [
    { username: { contains: search, mode: "insensitive" } },
    { phone: { contains: search } },
  ];
  const userWhere: Prisma.UsersWhereInput[] = [
    { name: { contains: search, mode: "insensitive" } },
    { username: { contains: search, mode: "insensitive" } },
    { phone: { contains: search } },
  ];

  if (normalizedSearch) {
    customerWhere.push({ phoneNormalized: { contains: normalizedSearch } });
    userWhere.push({ phoneNormalized: { contains: normalizedSearch } });
  }
  if (searchDigits && searchDigits !== normalizedSearch) {
    customerWhere.push({ phoneNormalized: { contains: searchDigits } });
    userWhere.push({ phoneNormalized: { contains: searchDigits } });
  }

  try {
    const [customers, users] = await Promise.all([
      prismadb.catalogCustomer.findMany({
        where: { OR: customerWhere },
        orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
        take: 8,
        select: {
          id: true,
          username: true,
          phone: true,
          phoneNormalized: true,
          customerType: true,
          serviceLinks: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: {
              serviceOrder: {
                select: {
                  tags: true,
                },
              },
            },
          },
        },
      }),
      prismadb.users.findMany({
        where: { OR: userWhere },
        orderBy: [{ lastLoginAt: "desc" }, { created_on: "desc" }],
        take: 8,
        select: {
          id: true,
          name: true,
          username: true,
          phone: true,
          phoneNormalized: true,
        },
      }),
    ]);

    const results: MektekCustomerSearchResult[] = customers.map((customer) => {
      const tags = parseTagsObject(customer.serviceLinks[0]?.serviceOrder?.tags);
      const address = typeof tags.address === "string" ? tags.address : null;

      return {
        id: customer.id,
        name: customer.username,
        phone: customer.phone,
        phoneNormalized: customer.phoneNormalized,
        customerType: customer.customerType,
        address,
        source: "customer",
      };
    });

    const seenPhones = new Set(results.map((customer) => customer.phoneNormalized));
    for (const user of users) {
      const phoneNormalized = user.phoneNormalized || normalizePhoneNumber(user.phone || "");
      if (!phoneNormalized || seenPhones.has(phoneNormalized)) continue;

      results.push({
        id: user.id,
        name: user.name || user.username || "Customer",
        phone: user.phone || phoneNormalized,
        phoneNormalized,
        customerType: "STANDARD",
        address: null,
        source: "user",
      });
      seenPhones.add(phoneNormalized);
    }

    return { data: results.slice(0, 8) };
  } catch (error) {
    console.log("[SEARCH_MEKTEK_CUSTOMERS]", error);
    return { error: "Failed to search customers" };
  }
};

export const searchMektekCatalogItems = async (query: string) => {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { error: "Unauthorized" };
  }
  if (!canCreateMektekOrders(session.user)) {
    return { error: "Forbidden: only MekTek admin or CS can search catalog items" };
  }

  const search = String(query ?? "").trim();
  if (search.length < 2) {
    return { data: [] };
  }

  try {
    const normalized = search.toLowerCase();
    const items = await prismadb.catalogItem.findMany({
      where: {
        OR: [
          { searchText: { contains: normalized } },
          { description: { contains: search, mode: "insensitive" } },
          { machine: { contains: search, mode: "insensitive" } },
          { partNumber: { contains: search, mode: "insensitive" } },
          { catalogPartNumber: { contains: search, mode: "insensitive" } },
        ],
      },
      orderBy: [{ machine: "asc" }, { rowNumber: "asc" }],
      take: 12,
      select: {
        id: true,
        machine: true,
        rowNumber: true,
        imagePath: true,
        description: true,
        partNumber: true,
        catalogPartNumber: true,
        price: true,
      },
    });

    return { data: items };
  } catch (error) {
    console.log("[SEARCH_MEKTEK_CATALOG_ITEMS]", error);
    return { error: "Failed to search catalog items" };
  }
};

export const getMektekServiceOrders = async (input?: {
  page?: number;
  pageSize?: number;
  dateFrom?: string;
  dateTo?: string;
}) => {
  const pageSize = Math.min(Math.max(Number(input?.pageSize) || 10, 1), 50);
  const requestedPage = Math.max(Number(input?.page) || 1, 1);
  const createdAt: Prisma.DateTimeNullableFilter<"crm_Accounts_Tasks"> = {};
  const dateFrom = String(input?.dateFrom ?? "").trim();
  const dateTo = String(input?.dateTo ?? "").trim();

  if (dateFrom) {
    const parsedFrom = new Date(`${dateFrom}T00:00:00.000`);
    if (!Number.isNaN(parsedFrom.getTime())) {
      createdAt.gte = parsedFrom;
    }
  }
  if (dateTo) {
    const parsedTo = new Date(`${dateTo}T23:59:59.999`);
    if (!Number.isNaN(parsedTo.getTime())) {
      createdAt.lte = parsedTo;
    }
  }

  const where: Prisma.crm_Accounts_TasksWhereInput = {
    ...mektekOrderWhere(),
    ...(Object.keys(createdAt).length > 0 ? { createdAt } : {}),
  };

  const totalCount = await prismadb.crm_Accounts_Tasks.count({ where });
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const page = Math.min(requestedPage, totalPages);

  const orders = await prismadb.crm_Accounts_Tasks.findMany({
    where,
    include: {
      assigned_user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    skip: (page - 1) * pageSize,
    take: pageSize,
  });

  return {
    orders,
    page,
    pageSize,
    totalCount,
    totalPages,
  };
};

export const getMektekServiceOrderById = async (id: string) => {
  return prismadb.crm_Accounts_Tasks.findFirst({
    where: {
      id,
      ...mektekOrderWhere(),
    },
    include: {
      assigned_user: {
        select: {
          id: true,
          name: true,
        },
      },
      comments: {
        orderBy: {
          createdAt: "asc",
        },
        select: {
          id: true,
          comment: true,
          createdAt: true,
          assigned_user: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
      mektekPayments: {
        orderBy: {
          createdAt: "desc",
        },
        select: mektekPaymentSelect,
      },
    },
  });
};

export const getPublicMektekServiceOrder = async (id: string, token: string) => {
  if (!id || !token) return null;

  const order = await prismadb.crm_Accounts_Tasks.findFirst({
    where: {
      id,
      ...mektekOrderWhere(),
    },
    select: {
      id: true,
      content: true,
      dueDateAt: true,
      taskStatus: true,
      createdAt: true,
      updatedAt: true,
      tags: true,
      mektekPayments: {
        orderBy: {
          createdAt: "desc",
        },
        select: mektekPaymentSelect,
      },
    },
  });

  if (!order) return null;

  const tags =
    order.tags && typeof order.tags === "object" && !Array.isArray(order.tags)
      ? (order.tags as Record<string, unknown>)
      : null;

  const storedToken =
    typeof tags?.customerToken === "string" ? tags.customerToken : "";
  if (!tags || !storedToken || !constantTimeEqual(storedToken, token)) {
    return null;
  }

  return order;
};

export const getPublicMektekServiceOrderByCode = async (code: string) => {
  const safeCode = String(code ?? "").trim();
  if (!safeCode) return null;

  return prismadb.crm_Accounts_Tasks.findFirst({
    where: {
      ...mektekOrderWhere(),
      tags: {
        path: ["customerCode"],
        equals: safeCode,
      },
    },
    select: {
      id: true,
      content: true,
      dueDateAt: true,
      taskStatus: true,
      createdAt: true,
      updatedAt: true,
      tags: true,
      mektekPayments: {
        orderBy: {
          createdAt: "desc",
        },
        select: mektekPaymentSelect,
      },
    },
  });
};

export const addMektekTimelineEntry = async (data: {
  serviceOrderId: string;
  description: string;
  completed: boolean;
}) => {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { error: "Unauthorized" };
  if (!canUpdateMektekProgress(session.user)) {
    return { error: "Forbidden: only MekTek admin or technician can update timeline" };
  }

  const serviceOrderId = String(data?.serviceOrderId ?? "").trim();
  const description = String(data?.description ?? "").trim();
  const completed = !!data?.completed;

  if (!serviceOrderId) return { error: "Service order ID is required" };
  if (!description) return { error: "Timeline description is required" };

  try {
    const serviceOrder = await prismadb.crm_Accounts_Tasks.findFirst({
      where: {
        id: serviceOrderId,
        ...mektekOrderWhere(),
      },
      select: {
        id: true,
        tags: true,
      },
    });

    if (!serviceOrder) return { error: "Service order not found" };

    const tags = parseTagsObject(serviceOrder.tags);
    const timeline = parseTimeline(serviceOrder.tags);
    const nextTimeline: MektekTimelineEntry[] = [
      ...timeline,
      {
        id: crypto.randomUUID(),
        description,
        createdAt: new Date().toISOString(),
        completed,
      },
    ];

    await prismadb.crm_Accounts_Tasks.update({
      where: { id: serviceOrder.id },
      data: {
        tags: {
          ...tags,
          timeline: nextTimeline,
        },
        updatedBy: session.user.id,
      },
    });

    revalidatePath("/[locale]/(routes)/mektek/[id]", "page");
    revalidatePath("/[locale]/service-status/[id]", "page");
    revalidatePath("/[locale]/s/[code]", "page");
    return { data: nextTimeline };
  } catch (error) {
    console.log("[ADD_MEKTEK_TIMELINE_ENTRY]", error);
    return { error: "Failed to add timeline entry" };
  }
};

export const updateMektekServiceOrderStatus = async (input: {
  serviceOrderId: string;
  newStatus: "ACTIVE" | "PENDING" | "COMPLETE";
  markAllTimelineComplete?: boolean;
}) => {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { error: "Unauthorized" };
  if (!canUpdateMektekProgress(session.user)) {
    return { error: "Forbidden: only MekTek admin or technician can change order status" };
  }

  const serviceOrderId = String(input?.serviceOrderId ?? "").trim();
  const newStatus = input?.newStatus;
  if (!serviceOrderId) return { error: "Service order ID is required" };
  if (!["ACTIVE", "PENDING", "COMPLETE"].includes(newStatus)) return { error: "Invalid status" };

  try {
    const serviceOrder = await prismadb.crm_Accounts_Tasks.findFirst({
      where: { id: serviceOrderId, ...mektekOrderWhere() },
      select: {
        id: true,
        tags: true,
        content: true,
        createdAt: true,
      },
    });
    if (!serviceOrder) return { error: "Service order not found" };

    const tags = parseTagsObject(serviceOrder.tags);
    const whatsappMeta = parseWhatsappMeta(tags);
    const lastStatus = typeof whatsappMeta.lastStatus === "string" ? whatsappMeta.lastStatus : "";
    const shouldNotifyComplete = newStatus === "COMPLETE" && lastStatus !== "COMPLETE";
    let timeline = parseTimeline(serviceOrder.tags);

    if (newStatus === "COMPLETE" && input?.markAllTimelineComplete && timeline.length > 0) {
      timeline = timeline.map((e) => ({ ...e, completed: true }));
    }

    await prismadb.crm_Accounts_Tasks.update({
      where: { id: serviceOrder.id },
      data: { taskStatus: newStatus, tags: { ...tags, timeline }, updatedBy: session.user.id },
    });

    if (shouldNotifyComplete) {
      let customerToken = typeof tags.customerToken === "string" ? tags.customerToken : "";
      let customerCode = typeof tags.customerCode === "string" ? tags.customerCode : "";
      if (!customerCode) {
        customerToken = customerToken || crypto.randomBytes(20).toString("hex");
        customerCode = createCustomerCode();
        await prismadb.crm_Accounts_Tasks.update({
          where: { id: serviceOrder.id },
          data: {
            tags: {
              ...tags,
              timeline,
              customerToken,
              customerCode,
            },
          },
        });
      }
      const trackingLink = customerCode
        ? await buildCustomerTrackingLink(customerCode, session.user.userLanguage || "en")
        : "";

      let notifyResult: { ok: boolean; error?: string } = { ok: false, error: "Skipped" };
      try {
        notifyResult = await notifyMektekOrderCompleted({
          order: { ...serviceOrder, tags },
          trackingLink,
        });
      } catch (error) {
        console.log("[MEKTEK_WHATSAPP_ORDER_COMPLETED]", error);
      }

      if (notifyResult.ok) {
        await prismadb.crm_Accounts_Tasks.update({
          where: { id: serviceOrder.id },
          data: {
            tags: {
              ...tags,
              timeline,
              customerToken,
              customerCode,
              whatsapp: {
                ...whatsappMeta,
                lastStatus: "COMPLETE",
                completedNotifiedAt: new Date().toISOString(),
              },
            },
          },
        });
      }
    }

    revalidatePath("/[locale]/(routes)/mektek", "page");
    revalidatePath("/[locale]/(routes)/mektek/[id]", "page");
    revalidatePath("/[locale]/service-status/[id]", "page");
    revalidatePath("/[locale]/s/[code]", "page");
    return { data: { status: newStatus } };
  } catch (error) {
    console.log("[UPDATE_MEKTEK_SERVICE_ORDER_STATUS]", error);
    return { error: "Failed to update service order status" };
  }
};

export const updateMektekPayment = async (input: {
  serviceOrderId: string;
  method: "cash" | "transfer" | "qris";
  discount?: string | number;
  tax?: string | number;
  amountPaid?: string | number;
}) => {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { error: "Unauthorized" };
  if (!canManageMektekPayments(session.user)) {
    return { error: "Forbidden: only admin can update payment" };
  }

  const serviceOrderId = String(input?.serviceOrderId ?? "").trim();
  if (!serviceOrderId) return { error: "Service order ID is required" };
  if (!["cash", "transfer", "qris"].includes(input.method)) {
    return { error: "Invalid payment method" };
  }

  try {
    const serviceOrder = await prismadb.crm_Accounts_Tasks.findFirst({
      where: { id: serviceOrderId, ...mektekOrderWhere() },
      select: {
        id: true,
        tags: true,
        content: true,
        mektekPayments: {
          orderBy: {
            createdAt: "desc",
          },
          select: mektekPaymentSelect,
        },
      },
    });

    if (!serviceOrder) return { error: "Service order not found" };

    const tags = parseTagsObject(serviceOrder.tags);
    const discount = parseMoney(input.discount);
    const tax = parseMoney(input.tax);
    const nextTags = {
      ...tags,
      discount,
      tax,
    };
    const summary = buildMektekFinancialSummary(
      nextTags,
      serviceOrder.content,
      serviceOrder.mektekPayments
    );
    const amountPaid = Math.min(
      Math.max(parseMoney(input.amountPaid), summary.payment.providerAmountPaid),
      summary.grandTotal
    );
    const status =
      summary.grandTotal <= 0
        ? "unpaid"
        : amountPaid >= summary.grandTotal
        ? "paid"
        : amountPaid > 0
        ? "partial"
        : "unpaid";

    await prismadb.crm_Accounts_Tasks.update({
      where: { id: serviceOrder.id },
      data: {
        tags: {
          ...nextTags,
          discount,
          tax,
          payment: {
            method: input.method,
            amountPaid,
            status,
            updatedAt: new Date().toISOString(),
          },
        },
        updatedBy: session.user.id,
      },
    });

    revalidatePath("/[locale]/(routes)/mektek/[id]", "page");
    revalidatePath("/[locale]/service-status/[id]", "page");
    revalidatePath("/[locale]/s/[code]", "page");
    revalidatePath("/[locale]/customer/profile", "page");
    return { data: { discount, tax, amountPaid, grandTotal: summary.grandTotal, status } };
  } catch (error) {
    console.log("[UPDATE_MEKTEK_PAYMENT]", error);
    return { error: "Failed to update payment" };
  }
};

export const getMektekCustomerTrackingLink = async (serviceOrderId: string) => {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { error: "Unauthorized" };
  if (!canUseMektekCustomerTools(session.user) && !canUpdateMektekProgress(session.user)) {
    return { error: "Forbidden" };
  }

  const id = String(serviceOrderId ?? "").trim();
  if (!id) return { error: "Service order ID is required" };

  try {
    const serviceOrder = await prismadb.crm_Accounts_Tasks.findFirst({
      where: {
        id,
        ...mektekOrderWhere(),
      },
      select: {
        id: true,
        tags: true,
      },
    });

    if (!serviceOrder) return { error: "Service order not found" };

    const tags = parseTagsObject(serviceOrder.tags);
    let customerToken = typeof tags.customerToken === "string" ? tags.customerToken : "";
    let customerCode = typeof tags.customerCode === "string" ? tags.customerCode : "";

    if (!customerToken || !customerCode) {
      const nextTags = { ...tags };
      customerToken = crypto.randomBytes(20).toString("hex");
      customerCode = createCustomerCode();
      if (typeof tags.customerToken === "string") {
        customerToken = tags.customerToken;
      } else {
        nextTags.customerToken = customerToken;
      }
      if (typeof tags.customerCode === "string") {
        customerCode = tags.customerCode;
      } else {
        nextTags.customerCode = customerCode;
      }

      await prismadb.crm_Accounts_Tasks.update({
        where: { id: serviceOrder.id },
        data: {
          tags: nextTags as Prisma.InputJsonValue,
        },
      });
    }

    return {
      data: {
        link: await buildCustomerTrackingLink(customerCode, session.user.userLanguage || "en"),
      },
    };
  } catch (error) {
    console.log("[GET_MEKTEK_CUSTOMER_TRACKING_LINK]", error);
    return { error: "Failed to build customer tracking link" };
  }
};
