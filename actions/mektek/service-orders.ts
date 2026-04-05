"use server";

import { authOptions } from "@/lib/auth";
import { prismadb } from "@/lib/prisma";
import { getServerSession } from "@/lib/session";
import { revalidatePath } from "next/cache";
import crypto from "crypto";

const MEKTEK_TITLE_PREFIX = "MEKTEK AC -";
const DEFAULT_TIMELINE_MESSAGE =
  "Layanan Anda telah terbuat. Tim kami sedang menyiapkan pemeriksaan awal kendaraan.";

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

const buildCustomerTrackingLink = (taskId: string, token: string, locale?: string) => {
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";
  const safeLocale = locale || "en";
  return `${appUrl}/${safeLocale}/service-status/${taskId}?token=${token}`;
};

type CreateMektekServiceOrderInput = {
  customerName: string;
  vehicle: string;
  complaint: string;
  phone?: string;
  address?: string;
  estimatedDone?: string;
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

  if (!customerName || !vehicle || !complaint) {
    return { error: "Customer name, vehicle, and complaint are required" };
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
  const locale = session.user.userLanguage || "en";
  let accountId: string | undefined;

  try {
    try {
      const account = await prismadb.crm_Accounts.create({
        data: {
          v: 0,
          name: customerName,
          type: "Customer",
          status: "Active",
          office_phone: phone,
          billing_street: address,
          description: `Kendaraan: ${vehicle}`,
          createdBy: session.user.id,
          updatedBy: session.user.id,
        },
        select: {
          id: true,
        },
      });
      accountId = account?.id;
    } catch (error) {
      console.log("[CREATE_MEKTEK_SERVICE_ORDER_ACCOUNT]", error);
    }

    const task = await prismadb.crm_Accounts_Tasks.create({
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
        account: accountId,
        tags: {
          module: "mektek",
          serviceType: "AC",
          customerToken,
          vehicle,
          customerName,
          phone: phone || null,
          address: address || null,
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

    if (!task?.id) {
      return { error: "Service order was not created" };
    }

    const customerTrackingLink = buildCustomerTrackingLink(task.id, customerToken, locale);

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
    return { error: "Failed to create service order" };
  }
};

export const getMektekServiceOrders = async () => {
  return prismadb.crm_Accounts_Tasks.findMany({
    where: {
      title: {
        startsWith: MEKTEK_TITLE_PREFIX,
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
    orderBy: {
      createdAt: "desc",
    },
  });
};

export const getMektekServiceOrderById = async (id: string) => {
  return prismadb.crm_Accounts_Tasks.findFirst({
    where: {
      id,
      title: {
        startsWith: MEKTEK_TITLE_PREFIX,
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
      title: {
        startsWith: MEKTEK_TITLE_PREFIX,
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
        title: { startsWith: MEKTEK_TITLE_PREFIX },
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
      where: { id: serviceOrderId, title: { startsWith: MEKTEK_TITLE_PREFIX } },
      select: { id: true, tags: true },
    });
    if (!serviceOrder) return { error: "Service order not found" };

    const tags = parseTagsObject(serviceOrder.tags);
    let timeline = parseTimeline(serviceOrder.tags);

    if (newStatus === "COMPLETE" && input?.markAllTimelineComplete && timeline.length > 0) {
      timeline = timeline.map((e) => ({ ...e, completed: true }));
    }

    await prismadb.crm_Accounts_Tasks.update({
      where: { id: serviceOrder.id },
      data: { taskStatus: newStatus, tags: { ...tags, timeline }, updatedBy: session.user.id },
    });

    revalidatePath("/[locale]/(routes)/mektek", "page");
    revalidatePath("/[locale]/(routes)/mektek/[id]", "page");
    revalidatePath("/[locale]/service-status/[id]", "page");
    return { data: { status: newStatus } };
  } catch (error) {
    console.log("[UPDATE_MEKTEK_SERVICE_ORDER_STATUS]", error);
    return { error: "Failed to update service order status" };
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
        title: { startsWith: MEKTEK_TITLE_PREFIX },
      },
      select: {
        id: true,
        tags: true,
      },
    });

    if (!serviceOrder) return { error: "Service order not found" };

    const tags = parseTagsObject(serviceOrder.tags);
    let customerToken = typeof tags.customerToken === "string" ? tags.customerToken : "";

    if (!customerToken) {
      customerToken = crypto.randomBytes(20).toString("hex");
      await prismadb.crm_Accounts_Tasks.update({
        where: { id: serviceOrder.id },
        data: {
          tags: {
            ...tags,
            customerToken,
          },
        },
      });
    }

    return {
      data: {
        link: buildCustomerTrackingLink(
          serviceOrder.id,
          customerToken,
          session.user.userLanguage || "en"
        ),
      },
    };
  } catch (error) {
    console.log("[GET_MEKTEK_CUSTOMER_TRACKING_LINK]", error);
    return { error: "Failed to build customer tracking link" };
  }
};