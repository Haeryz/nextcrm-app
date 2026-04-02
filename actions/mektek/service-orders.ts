"use server";

import { authOptions } from "@/lib/auth";
import { prismadb } from "@/lib/prisma";
import { getServerSession } from "@/lib/session";
import { revalidatePath } from "next/cache";
import crypto from "crypto";

const MEKTEK_TITLE_PREFIX = "MEKTEK AC -";

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
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";
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

    const customerTrackingLink = `${appUrl}/${locale}/service-status/${task.id}?token=${customerToken}`;

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