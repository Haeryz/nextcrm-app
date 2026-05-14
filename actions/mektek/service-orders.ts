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

const MEKTEK_TITLE_PREFIX = "MEKTEK Service -";
const LEGACY_MEKTEK_TITLE_PREFIX = "MEKTEK AC -";
const MEKTEK_TITLE_PREFIXES = [MEKTEK_TITLE_PREFIX, LEGACY_MEKTEK_TITLE_PREFIX];
const DEFAULT_TIMELINE_MESSAGE =
  "Layanan Anda telah terbuat. Tim kami sedang menyiapkan pemeriksaan awal kendaraan.";

const mektekOrderWhere = (): Prisma.crm_Accounts_TasksWhereInput => ({
  OR: MEKTEK_TITLE_PREFIXES.map((prefix) => ({
    title: {
      startsWith: prefix,
    },
  })),
});

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

const parseMoney = (value: unknown) => {
  const cleaned = String(value ?? "").replace(/\D/g, "");
  const amount = Number(cleaned);
  return Number.isFinite(amount) && amount > 0 ? amount : 0;
};

type CreateMektekServiceOrderInput = {
  customerName: string;
  vehicle: string;
  complaint: string;
  phone?: string;
  address?: string;
  estimatedDone?: string;
  damageItems?: {
    description?: string;
    estimatedCost?: string;
    quantity?: number;
    catalogItemId?: string;
    machine?: string;
    partNumber?: string;
    catalogPartNumber?: string;
  }[];
};

const buildInvoiceItems = (damageItems?: CreateMektekServiceOrderInput["damageItems"]) =>
  (Array.isArray(damageItems) ? damageItems : [])
    .map((item) => {
      const name = String(item?.description ?? "").trim();
      if (!name) return null;
      const unitPrice = parseMoney(item?.estimatedCost);
      const quantity = Math.max(1, Math.floor(Number(item?.quantity) || 1));
      return {
        catalogItemId: item?.catalogItemId || null,
        name,
        machine: item?.machine || null,
        partNumber: item?.partNumber || null,
        catalogPartNumber: item?.catalogPartNumber || null,
        quantity,
        unit: "JOB",
        unitPrice,
        total: unitPrice * quantity,
      };
    })
    .filter(
      (
        item
      ): item is {
        catalogItemId: string | null;
        name: string;
        machine: string | null;
        partNumber: string | null;
        catalogPartNumber: string | null;
        quantity: number;
        unit: string;
        unitPrice: number;
        total: number;
      } => !!item
    );

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

const buildAppUrl = async () => {
  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ||
    requestHeaders.get("host") ||
    "";
  if (host) {
    const proto =
      requestHeaders.get("x-forwarded-proto") ||
      (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");
    return `${proto}://${host}`;
  }

  const vercelUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "";
  return process.env.NEXT_PUBLIC_APP_URL || vercelUrl || "http://localhost:3000";
};

const createCustomerCode = () => crypto.randomBytes(12).toString("base64url");

const buildCustomerTrackingLink = async (code: string, locale?: string) => {
  const appUrl = await buildAppUrl();
  const safeLocale = locale || "en";
  return `${appUrl}/${safeLocale}/s/${code}`;
};

const normalizeCustomerPhone = (phone: string): string => {
  const trimmed = String(phone || "").trim();
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  return hasPlus ? `+${digits}` : digits;
};

export const createMektekServiceOrder = async (
  input: CreateMektekServiceOrderInput
) => {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { error: "Unauthorized" };
  }
  if (!session.user.isAdmin) {
    return { error: "Forbidden: only admin can create service orders" };
  }

  const customerName = String(input?.customerName ?? "").trim();
  const vehicle = String(input?.vehicle ?? "").trim();
  const complaint = String(input?.complaint ?? "").trim();
  const phone = String(input?.phone ?? "").trim();
  const address = String(input?.address ?? "").trim();
  const phoneNormalized = normalizeCustomerPhone(phone);

  if (!customerName || !vehicle || !complaint) {
    return { error: "Customer name, vehicle, and complaint are required" };
  }
  if (phoneNormalized.replace(/\D/g, "").length < 6) {
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
  const invoiceItems = buildInvoiceItems(input?.damageItems);
  const locale = session.user.userLanguage || "en";

  try {
    const task = await prismadb.$transaction(async (tx) => {
      const catalogCustomer = await tx.catalogCustomer.upsert({
        where: {
          phoneNormalized,
        },
        update: {
          phone,
        },
        create: {
          username: customerName,
          phone,
          phoneNormalized,
        },
        select: {
          id: true,
        },
      });

      const serviceOrder = await tx.crm_Accounts_Tasks.create({
        data: {
          v: 0,
          title: `${MEKTEK_TITLE_PREFIX} ${vehicle}`,
          content: complaint,
          priority: "medium",
          taskStatus: "ACTIVE",
          user: session.user.id,
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
            address: address || null,
            catalogCustomerId: catalogCustomer.id,
            items: invoiceItems,
            discount: 0,
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
        include: {
          crm_accounts: {
            select: {
              id: true,
              name: true,
              office_phone: true,
              billing_street: true,
            },
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
    revalidatePath("/[locale]/(routes)/admin/catalog-customers", "page");
    revalidatePath("/[locale]/customer/profile", "page");
    return {
      data: {
        ...task,
        customerTrackingLink,
      },
    };
  } catch (error) {
    console.log("[CREATE_MEKTEK_SERVICE_ORDER]", error);
    return { error: "Failed to create service order" };
  }
};

export const searchMektekCatalogItems = async (query: string) => {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { error: "Unauthorized" };
  }
  if (!session.user.isAdmin) {
    return { error: "Forbidden: only admin can search catalog items" };
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
      crm_accounts: {
        select: {
          id: true,
          name: true,
          office_phone: true,
          billing_street: true,
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
      crm_accounts: {
        select: {
          id: true,
          name: true,
          office_phone: true,
          billing_street: true,
        },
      },
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
      crm_accounts: {
        select: {
          name: true,
        },
      },
    },
  });

  if (!order) return null;

  const tags =
    order.tags && typeof order.tags === "object" && !Array.isArray(order.tags)
      ? (order.tags as Record<string, unknown>)
      : null;

  if (!tags || tags.customerToken !== token) {
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
      crm_accounts: {
        select: {
          name: true,
        },
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
  if (!session.user.isAdmin) return { error: "Forbidden: only admin can update timeline" };

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
  if (!session.user.isAdmin) return { error: "Forbidden: only admin can change order status" };

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
        crm_accounts: {
          select: {
            name: true,
            office_phone: true,
            billing_street: true,
          },
        },
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
  if (!session.user.isAdmin) return { error: "Forbidden: only admin can update payment" };

  const serviceOrderId = String(input?.serviceOrderId ?? "").trim();
  if (!serviceOrderId) return { error: "Service order ID is required" };
  if (!["cash", "transfer", "qris"].includes(input.method)) {
    return { error: "Invalid payment method" };
  }

  try {
    const serviceOrder = await prismadb.crm_Accounts_Tasks.findFirst({
      where: { id: serviceOrderId, ...mektekOrderWhere() },
      select: { id: true, tags: true },
    });

    if (!serviceOrder) return { error: "Service order not found" };

    const tags = parseTagsObject(serviceOrder.tags);
    const items = Array.isArray(tags.items) ? tags.items : [];
    const subtotal = items.reduce((sum, item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return sum;
      const row = item as Record<string, unknown>;
      const total = parseMoney(row.total);
      const unitPrice = parseMoney(row.unitPrice);
      const quantity = Number(row.quantity ?? 1) || 1;
      return sum + (total || unitPrice * quantity);
    }, 0);
    const discount = parseMoney(input.discount);
    const tax = parseMoney(input.tax);
    const grandTotal = Math.max(0, subtotal - discount + tax);
    const amountPaid = Math.min(parseMoney(input.amountPaid), grandTotal);
    const status =
      grandTotal <= 0
        ? "unpaid"
        : amountPaid >= grandTotal
        ? "paid"
        : amountPaid > 0
        ? "partial"
        : "unpaid";

    await prismadb.crm_Accounts_Tasks.update({
      where: { id: serviceOrder.id },
      data: {
        tags: {
          ...tags,
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
    return { data: { discount, tax, amountPaid, grandTotal, status } };
  } catch (error) {
    console.log("[UPDATE_MEKTEK_PAYMENT]", error);
    return { error: "Failed to update payment" };
  }
};

export const getMektekCustomerTrackingLink = async (serviceOrderId: string) => {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { error: "Unauthorized" };

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
