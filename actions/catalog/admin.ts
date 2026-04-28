"use server";

import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/auth";
import { prismadb } from "@/lib/prisma";
import { getServerSession } from "@/lib/session";

const MEKTEK_TITLE_PREFIX = "MEKTEK AC -";
const INQUIRY_STATUSES = new Set(["NEW", "CONTACTED", "CLOSED"]);

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { error: "Unauthorized" };
  if (!session.user.isAdmin) return { error: "Forbidden" };
  return { session };
}

function parseTagsObject(tags: unknown): Record<string, unknown> {
  if (!tags || typeof tags !== "object" || Array.isArray(tags)) return {};
  return tags as Record<string, unknown>;
}

export async function getAdminCatalogInquiries() {
  const admin = await requireAdmin();
  if ("error" in admin) return [];

  return prismadb.catalogInquiry.findMany({
    include: {
      customer: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

export async function updateCatalogInquiryStatus(input: {
  inquiryId: string;
  status: string;
}) {
  const admin = await requireAdmin();
  if ("error" in admin) return { error: admin.error };

  const inquiryId = String(input?.inquiryId ?? "").trim();
  const status = String(input?.status ?? "").trim();

  if (!inquiryId || !INQUIRY_STATUSES.has(status)) {
    return { error: "Invalid inquiry status update." };
  }

  try {
    await prismadb.catalogInquiry.update({
      where: {
        id: inquiryId,
      },
      data: {
        status: status as any,
      },
    });

    revalidatePath("/admin/catalog-inquiries");
    revalidatePath("/customer/profile");
    return { data: true };
  } catch (error) {
    console.error("[UPDATE_CATALOG_INQUIRY_STATUS]", error);
    return { error: "Unable to update inquiry status." };
  }
}

export async function getAdminCatalogCustomers() {
  const admin = await requireAdmin();
  if ("error" in admin) return [];

  return prismadb.catalogCustomer.findMany({
    include: {
      _count: {
        select: {
          inquiries: true,
          serviceLinks: true,
        },
      },
      serviceLinks: {
        include: {
          serviceOrder: {
            select: {
              id: true,
              title: true,
              taskStatus: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

export async function getAssignableMektekOrders() {
  const admin = await requireAdmin();
  if ("error" in admin) return [];

  const orders = await prismadb.crm_Accounts_Tasks.findMany({
    where: {
      title: {
        startsWith: MEKTEK_TITLE_PREFIX,
      },
    },
    include: {
      crm_accounts: {
        select: {
          name: true,
          office_phone: true,
        },
      },
    },
    orderBy: {
      updatedAt: "desc",
    },
  });

  return orders.map((order) => {
    const tags = parseTagsObject(order.tags);
    return {
      id: order.id,
      title: order.title,
      status: String(order.taskStatus || "ACTIVE"),
      customerName: order.crm_accounts?.name || String(tags.customerName || "Customer"),
      vehicle: typeof tags.vehicle === "string" ? tags.vehicle : "Unknown vehicle",
      phone: order.crm_accounts?.office_phone || String(tags.phone || ""),
    };
  });
}

export async function assignCatalogServiceToCustomer(input: {
  customerId: string;
  serviceOrderId: string;
}) {
  const admin = await requireAdmin();
  if ("error" in admin) return { error: admin.error };

  const customerId = String(input?.customerId ?? "").trim();
  const serviceOrderId = String(input?.serviceOrderId ?? "").trim();

  if (!customerId || !serviceOrderId) {
    return { error: "Customer and service order are required." };
  }

  const serviceOrder = await prismadb.crm_Accounts_Tasks.findFirst({
    where: {
      id: serviceOrderId,
      title: {
        startsWith: MEKTEK_TITLE_PREFIX,
      },
    },
    select: {
      id: true,
      tags: true,
    },
  });

  if (!serviceOrder) return { error: "Service order not found." };

  const tags = parseTagsObject(serviceOrder.tags);
  const token = typeof tags.customerToken === "string" ? tags.customerToken : null;

  try {
    await prismadb.catalogServiceLink.upsert({
      where: {
        customerId_serviceOrderId: {
          customerId,
          serviceOrderId,
        },
      },
      update: {
        source: "ADMIN_ASSIGN",
        token,
      },
      create: {
        customerId,
        serviceOrderId,
        source: "ADMIN_ASSIGN",
        token,
      },
    });

    revalidatePath("/admin/catalog-customers");
    revalidatePath("/customer/profile");
    return { data: true };
  } catch (error) {
    console.error("[ASSIGN_CATALOG_SERVICE_TO_CUSTOMER]", error);
    return { error: "Unable to assign service." };
  }
}
