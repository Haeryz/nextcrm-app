"use server";

import { authOptions } from "@/lib/auth";
import { buildMektekPublicSnapshot } from "@/lib/mektek/public-status";
import { prismadb } from "@/lib/prisma";
import { getServerSession } from "@/lib/session";
import { normalizePhoneNumber } from "@/lib/phone";
import { buildMektekVouchers } from "@/lib/mektek/vouchers";

const parseTags = (tags: unknown): Record<string, unknown> => {
  if (!tags || typeof tags !== "object" || Array.isArray(tags)) return {};
  return tags as Record<string, unknown>;
};

export async function getMektekCustomerProfile(locale = "en") {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { error: "Unauthorized" };
  }

  const user = await prismadb.users.findUnique({
    where: {
      id: session.user.id,
    },
    select: {
      id: true,
      name: true,
      phone: true,
      phoneNormalized: true,
    },
  });

  if (!user) {
    return { error: "User not found" };
  }

  const phoneNormalized = user.phoneNormalized || normalizePhoneNumber(user.phone || "");
  if (!phoneNormalized) {
    return {
      data: {
        user,
        customer: null,
        services: [],
        needsPhoneAccount: true,
        vouchers: [],
      },
    };
  }

  const customer = await prismadb.catalogCustomer.findFirst({
    where: {
      OR: [{ userId: user.id }, { phoneNormalized }],
    },
    include: {
      serviceLinks: {
        orderBy: {
          createdAt: "desc",
        },
        include: {
          serviceOrder: {
            select: {
              id: true,
              content: true,
              dueDateAt: true,
              taskStatus: true,
              createdAt: true,
              updatedAt: true,
              tags: true,
            },
          },
        },
      },
    },
  });

  if (!customer) {
    return {
      data: {
        user,
        customer: null,
        services: [],
        needsPhoneAccount: false,
        vouchers: buildMektekVouchers({
          phoneNormalized,
          completedVisitCount: 0,
        }),
      },
    };
  }

  if (!customer.userId) {
    await prismadb.catalogCustomer.update({
      where: {
        id: customer.id,
      },
      data: {
        userId: user.id,
      },
    });
  }

  const services = customer.serviceLinks
    .map((link) => {
      const tags = parseTags(link.serviceOrder.tags);
      const token =
        link.token ||
        (typeof tags.customerToken === "string" ? tags.customerToken : "");

      return {
        id: link.serviceOrder.id,
        token,
        snapshot: buildMektekPublicSnapshot(link.serviceOrder),
        streamHref: token
          ? `/api/mektek/service-orders/${link.serviceOrder.id}/stream?token=${encodeURIComponent(
              token
            )}`
          : null,
        invoiceHref: token
          ? `/api/mektek/service-orders/${link.serviceOrder.id}/invoice?token=${encodeURIComponent(
              token
            )}`
          : null,
        receiptHref: token
          ? `/api/mektek/service-orders/${link.serviceOrder.id}/receipt?token=${encodeURIComponent(
              token
            )}`
          : null,
        publicHref:
          typeof tags.customerCode === "string" && tags.customerCode
            ? `/${locale}/s/${tags.customerCode}`
            : null,
      };
    })
    .sort((a, b) => {
      const aTime = a.snapshot.updatedAt ? new Date(a.snapshot.updatedAt).getTime() : 0;
      const bTime = b.snapshot.updatedAt ? new Date(b.snapshot.updatedAt).getTime() : 0;
      return bTime - aTime;
    });

  const completedVisitCount = services.filter(
    (service) => service.snapshot.taskStatus === "COMPLETE"
  ).length;

  return {
    data: {
      user,
      customer: {
        id: customer.id,
        username: customer.username,
        phone: customer.phone,
        phoneNormalized: customer.phoneNormalized,
      },
      services,
      vouchers: buildMektekVouchers({
        customerId: customer.id,
        phoneNormalized: customer.phoneNormalized,
        completedVisitCount,
      }),
      needsPhoneAccount: false,
    },
  };
}
