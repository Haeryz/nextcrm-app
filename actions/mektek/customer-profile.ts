"use server";

import { buildMektekPublicSnapshot } from "@/lib/mektek/public-status";
import { prismadb } from "@/lib/prisma";
import { getCustomerAuthSession } from "@/lib/customer-auth";
import { normalizePhoneNumber } from "@/lib/phone";
import { listAvailableMektekVouchersForCustomer } from "@/lib/mektek/voucher-db";
import { verifyOtpCode } from "@/lib/otp";
import { hasTrustedMutationOrigin } from "@/lib/trusted-origin";

const mektekPaymentSelect = {
  id: true,
  midtransOrderId: true,
  grossAmount: true,
  paymentType: true,
  transactionStatus: true,
  fraudStatus: true,
  paidAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

const parseTags = (tags: unknown): Record<string, unknown> => {
  if (!tags || typeof tags !== "object" || Array.isArray(tags)) return {};
  return tags as Record<string, unknown>;
};

export async function getMektekCustomerProfile(locale = "en") {
  const session = await getCustomerAuthSession();
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
        claimAvailable: false,
        vouchers: [],
      },
    };
  }

  // Match the customer record by verified ownership (userId) ONLY. A phoneNormalized
  // fallback here would let any logged-in user read another person's walk-in record
  // just by having a matching phone on their account. Linking a walk-in record now
  // happens exclusively through claimMektekCustomerByPhone (OTP-verified) below.
  const customer = await prismadb.catalogCustomer.findFirst({
    where: {
      userId: user.id,
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
              mektekPayments: {
                orderBy: {
                  createdAt: "desc",
                },
                select: mektekPaymentSelect,
              },
            },
          },
        },
      },
    },
  });

  if (!customer) {
    // Offer to claim an existing unclaimed (walk-in) record with a matching phone,
    // but never return its data until the user proves phone ownership via OTP.
    const claimable = await prismadb.catalogCustomer.findFirst({
      where: { phoneNormalized, userId: null },
      select: { id: true },
    });

    const vouchers = await listAvailableMektekVouchersForCustomer(prismadb, {
      customerId: null,
      customerType: null,
    });

    return {
      data: {
        user,
        customer: null,
        services: [],
        needsPhoneAccount: false,
        claimAvailable: !!claimable,
        vouchers,
      },
    };
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

  return {
    data: {
      user,
      customer: {
        id: customer.id,
        username: customer.username,
        phone: customer.phone,
        phoneNormalized: customer.phoneNormalized,
        customerType: customer.customerType,
      },
      services,
      vouchers: await listAvailableMektekVouchersForCustomer(prismadb, {
        customerId: customer.id,
        customerType: customer.customerType,
      }),
      needsPhoneAccount: false,
      claimAvailable: false,
    },
  };
}

// Claim an unclaimed (walk-in) CatalogCustomer record for the logged-in user after
// verifying ownership of their phone via WhatsApp OTP. This replaces the previous
// silent phoneNormalized auto-link, which let anyone bind another person's record.
export async function claimMektekCustomerByPhone(
  otpCode: string
): Promise<{ success?: true; error?: string }> {
  if (!(await hasTrustedMutationOrigin())) {
    return { error: "Request could not be verified" };
  }

  const session = await getCustomerAuthSession();
  if (!session?.user?.id) {
    return { error: "Unauthorized" };
  }

  const user = await prismadb.users.findUnique({
    where: { id: session.user.id },
    select: { id: true, phone: true, phoneNormalized: true },
  });
  if (!user) {
    return { error: "User not found" };
  }

  const phoneNormalized =
    user.phoneNormalized || normalizePhoneNumber(user.phone || "");
  if (!phoneNormalized) {
    return { error: "Akun Anda tidak memiliki nomor telepon" };
  }

  const code = String(otpCode ?? "").trim();
  if (!code) {
    return { error: "Kode verifikasi wajib diisi" };
  }

  const otpValid = await verifyOtpCode(phoneNormalized, code);
  if (!otpValid) {
    return { error: "Kode verifikasi salah atau kedaluwarsa" };
  }

  const target = await prismadb.catalogCustomer.findFirst({
    where: { phoneNormalized },
    select: { id: true, userId: true },
  });

  if (!target) {
    return { error: "Tidak ada riwayat untuk nomor ini" };
  }
  if (target.userId && target.userId !== user.id) {
    return { error: "Nomor ini sudah tertaut ke akun lain" };
  }
  if (target.userId === user.id) {
    return { success: true };
  }

  await prismadb.catalogCustomer.update({
    where: { id: target.id },
    data: { userId: user.id },
  });

  return { success: true };
}
