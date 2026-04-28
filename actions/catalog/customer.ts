"use server";

import crypto from "crypto";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { prismadb } from "@/lib/prisma";
import { getCatalogItem } from "@/lib/catalog/data";
import type { InquiryItemInput, InquiryItemSnapshot } from "@/lib/catalog/types";
import { calculateProgress } from "@/app/[locale]/(routes)/mektek/_lib/constants";

const CUSTOMER_SESSION_COOKIE = "nextcrm_catalog_customer";
const SESSION_DAYS = 30;
const MEKTEK_TITLE_PREFIX = "MEKTEK AC -";

export type CatalogCustomerSessionUser = {
  id: string;
  username: string;
  phone: string;
  phoneNormalized: string;
};

function normalizeCustomerPhone(phone: string): string {
  const trimmed = String(phone || "").trim();
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  return hasPlus ? `+${digits}` : digits;
}

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function sessionExpiry(): Date {
  return new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
}

async function setCustomerCookie(token: string, expires: Date) {
  const cookieStore = await cookies();
  cookieStore.set(CUSTOMER_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires,
  });
}

async function clearCustomerCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(CUSTOMER_SESSION_COOKIE);
}

async function createCustomerSession(customerId: string) {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = sessionExpiry();

  await prismadb.catalogCustomerSession.create({
    data: {
      tokenHash: hashToken(token),
      customerId,
      expiresAt,
    },
  });

  await setCustomerCookie(token, expiresAt);
}

export async function getCurrentCatalogCustomer(): Promise<CatalogCustomerSessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(CUSTOMER_SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prismadb.catalogCustomerSession.findFirst({
    where: {
      tokenHash: hashToken(token),
      expiresAt: {
        gt: new Date(),
      },
    },
    include: {
      customer: true,
    },
  });

  if (!session?.customer) return null;

  return {
    id: session.customer.id,
    username: session.customer.username,
    phone: session.customer.phone,
    phoneNormalized: session.customer.phoneNormalized,
  };
}

export async function signUpCatalogCustomer(input: {
  username: string;
  phone: string;
}) {
  const username = String(input?.username ?? "").trim();
  const phone = String(input?.phone ?? "").trim();
  const phoneNormalized = normalizeCustomerPhone(phone);

  if (username.length < 2) {
    return { error: "Username must be at least 2 characters." };
  }

  if (phoneNormalized.replace(/\D/g, "").length < 6) {
    return { error: "Phone number is too short." };
  }

  try {
    const existingCustomer = await prismadb.catalogCustomer.findUnique({
      where: {
        phoneNormalized,
      },
      select: {
        id: true,
      },
    });

    if (existingCustomer) {
      return { error: "This phone number is already registered. Please login." };
    }

    const customer = await prismadb.catalogCustomer.create({
      data: {
        username,
        phone,
        phoneNormalized,
      },
    });

    await createCustomerSession(customer.id);
    revalidatePath("/customer");
    revalidatePath("/customer/profile");

    return {
      data: {
        id: customer.id,
        username: customer.username,
        phone: customer.phone,
      },
    };
  } catch (error) {
    console.error("[SIGN_UP_CATALOG_CUSTOMER]", error);
    return { error: "Unable to create customer account." };
  }
}

export async function loginCatalogCustomer(input: {
  username: string;
  phone: string;
}) {
  const username = String(input?.username ?? "").trim();
  const phoneNormalized = normalizeCustomerPhone(String(input?.phone ?? ""));

  if (!username || !phoneNormalized) {
    return { error: "Username and phone are required." };
  }

  try {
    const customer = await prismadb.catalogCustomer.findUnique({
      where: {
        phoneNormalized,
      },
    });

    if (!customer || customer.username.trim().toLowerCase() !== username.toLowerCase()) {
      return { error: "Customer account not found. Check username and phone." };
    }

    await createCustomerSession(customer.id);
    revalidatePath("/customer");
    revalidatePath("/customer/profile");

    return {
      data: {
        id: customer.id,
        username: customer.username,
        phone: customer.phone,
      },
    };
  } catch (error) {
    console.error("[LOGIN_CATALOG_CUSTOMER]", error);
    return { error: "Unable to login to customer mode." };
  }
}

export async function signOutCatalogCustomer() {
  const cookieStore = await cookies();
  const token = cookieStore.get(CUSTOMER_SESSION_COOKIE)?.value;

  if (token) {
    await prismadb.catalogCustomerSession.deleteMany({
      where: {
        tokenHash: hashToken(token),
      },
    });
  }

  await clearCustomerCookie();
  revalidatePath("/customer");
  revalidatePath("/customer/profile");
  return { data: true };
}

async function normalizeInquiryItemsFromDb(
  items: InquiryItemInput[]
): Promise<InquiryItemSnapshot[]> {
  const snapshots: InquiryItemSnapshot[] = [];

  for (const item of items) {
    const catalogItem = await getCatalogItem(item.itemId);
    const quantity = Number(item.quantity);
    if (!catalogItem || !Number.isFinite(quantity) || quantity < 1) continue;

    snapshots.push({
      itemId: catalogItem.id,
      quantity: Math.min(Math.floor(quantity), 999),
      machine: catalogItem.machine,
      description: catalogItem.description,
      partNumber: catalogItem.partNumber,
      catalogPartNumber: catalogItem.catalogPartNumber,
      price: catalogItem.price,
      imageUrl: catalogItem.imageUrl,
    });
  }

  return snapshots;
}

export async function submitCatalogInquiry(input: {
  items: InquiryItemInput[];
  note?: string;
}) {
  const customer = await getCurrentCatalogCustomer();
  if (!customer) {
    return { error: "Please sign up before submitting an inquiry." };
  }

  const items = await normalizeInquiryItemsFromDb(
    Array.isArray(input?.items) ? input.items : []
  );
  const note = String(input?.note ?? "").trim();

  if (items.length === 0) {
    return { error: "Add at least one catalogue item before submitting." };
  }

  try {
    const inquiry = await prismadb.catalogInquiry.create({
      data: {
        customerId: customer.id,
        items,
        note: note || null,
      },
    });

    revalidatePath("/customer/profile");
    revalidatePath("/admin/catalog-inquiries");
    return { data: { id: inquiry.id } };
  } catch (error) {
    console.error("[SUBMIT_CATALOG_INQUIRY]", error);
    return { error: "Unable to submit inquiry." };
  }
}

export async function getCustomerInquiries(customerId: string) {
  return prismadb.catalogInquiry.findMany({
    where: {
      customerId,
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

function parseTagsObject(tags: unknown): Record<string, unknown> {
  if (!tags || typeof tags !== "object" || Array.isArray(tags)) return {};
  return tags as Record<string, unknown>;
}

function parseTimeline(tags: unknown) {
  const timeline = parseTagsObject(tags).timeline;
  if (!Array.isArray(timeline)) return [];

  return timeline
    .map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return null;
      const row = item as Record<string, unknown>;
      const description = typeof row.description === "string" ? row.description.trim() : "";
      const createdAt =
        typeof row.createdAt === "string" ? row.createdAt : new Date().toISOString();
      const completed = typeof row.completed === "boolean" ? row.completed : true;
      if (!description) return null;
      return { description, createdAt, completed };
    })
    .filter(
      (item): item is { description: string; createdAt: string; completed: boolean } =>
        Boolean(item)
    )
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

function buildTrackingLink(taskId: string, token: string | null | undefined) {
  if (!token) return null;
  return `/service-status/${taskId}?token=${encodeURIComponent(token)}`;
}

function serviceRowFromTask(task: any, source: string, token?: string | null) {
  const tags = parseTagsObject(task.tags);
  const timeline = parseTimeline(task.tags);
  const latestTimeline = timeline[timeline.length - 1] ?? null;
  const vehicle = typeof tags.vehicle === "string" ? tags.vehicle : "Unknown vehicle";
  const customerToken =
    token || (typeof tags.customerToken === "string" ? tags.customerToken : null);

  return {
    id: task.id,
    source,
    title: task.title,
    vehicle,
    status: String(task.taskStatus || "ACTIVE"),
    progress: calculateProgress(timeline, String(task.taskStatus || "ACTIVE")),
    latestUpdate: latestTimeline,
    dueDateAt: task.dueDateAt ? task.dueDateAt.toISOString() : null,
    updatedAt: task.updatedAt ? task.updatedAt.toISOString() : null,
    customerName: task.crm_accounts?.name ?? "Customer",
    trackingHref: buildTrackingLink(task.id, customerToken),
  };
}

export async function getCustomerServiceProgress(customer: CatalogCustomerSessionUser) {
  const explicitLinks = await prismadb.catalogServiceLink.findMany({
    where: {
      customerId: customer.id,
    },
    include: {
      serviceOrder: {
        include: {
          crm_accounts: {
            select: {
              name: true,
              office_phone: true,
            },
          },
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  const services = new Map<string, ReturnType<typeof serviceRowFromTask>>();

  for (const link of explicitLinks) {
    if (!link.serviceOrder) continue;
    services.set(
      link.serviceOrderId,
      serviceRowFromTask(link.serviceOrder, link.source, link.token)
    );
  }

  const allMektekOrders = await prismadb.crm_Accounts_Tasks.findMany({
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

  for (const order of allMektekOrders) {
    if (services.has(order.id)) continue;
    const tags = parseTagsObject(order.tags);
    const tagPhone = typeof tags.phone === "string" ? tags.phone : "";
    const accountPhone = order.crm_accounts?.office_phone || "";
    const matchesPhone =
      normalizeCustomerPhone(tagPhone) === customer.phoneNormalized ||
      normalizeCustomerPhone(accountPhone) === customer.phoneNormalized;

    if (matchesPhone) {
      services.set(order.id, serviceRowFromTask(order, "PHONE_MATCH"));
    }
  }

  return Array.from(services.values()).sort((a, b) => {
    const aDone = a.status === "COMPLETE";
    const bDone = b.status === "COMPLETE";
    if (aDone !== bDone) return aDone ? 1 : -1;
    return String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""));
  });
}

function parseTrackingInput(value: string) {
  const trimmed = String(value || "").trim();
  const match = trimmed.match(/service-status\/([0-9a-fA-F-]{36}).*?[?&]token=([^&#]+)/);
  if (match) {
    return {
      id: match[1],
      token: decodeURIComponent(match[2]),
    };
  }

  return {
    id: "",
    token: "",
  };
}

export async function linkCustomerServiceByToken(input: { trackingLink: string }) {
  const customer = await getCurrentCatalogCustomer();
  if (!customer) return { error: "Please sign up before linking a service." };

  const parsed = parseTrackingInput(input?.trackingLink);
  if (!parsed.id || !parsed.token) {
    return { error: "Paste a valid service tracking link." };
  }

  const serviceOrder = await prismadb.crm_Accounts_Tasks.findFirst({
    where: {
      id: parsed.id,
      title: {
        startsWith: MEKTEK_TITLE_PREFIX,
      },
    },
    select: {
      id: true,
      tags: true,
    },
  });

  const tags = parseTagsObject(serviceOrder?.tags);
  if (!serviceOrder || tags.customerToken !== parsed.token) {
    return { error: "Service tracking link could not be verified." };
  }

  try {
    await prismadb.catalogServiceLink.upsert({
      where: {
        customerId_serviceOrderId: {
          customerId: customer.id,
          serviceOrderId: serviceOrder.id,
        },
      },
      update: {
        source: "TOKEN_LINK",
        token: parsed.token,
      },
      create: {
        customerId: customer.id,
        serviceOrderId: serviceOrder.id,
        source: "TOKEN_LINK",
        token: parsed.token,
      },
    });

    revalidatePath("/customer/profile");
    return { data: true };
  } catch (error) {
    console.error("[LINK_CUSTOMER_SERVICE_BY_TOKEN]", error);
    return { error: "Unable to link service." };
  }
}
