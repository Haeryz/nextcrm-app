import type { Prisma, PrismaClient } from "@prisma/client";

import {
  cleanMektekVoucherCode,
  isMektekVoucherAvailable,
  toMektekVoucher,
  type MektekCustomerTypeValue,
  type MektekVoucher,
} from "@/lib/mektek/vouchers";

export const mektekVoucherRecordSelect = {
  id: true,
  code: true,
  normalizedCode: true,
  title: true,
  description: true,
  minSubtotal: true,
  discountType: true,
  discountAmount: true,
  discountPercent: true,
  maxDiscount: true,
  scope: true,
  customerType: true,
  customerId: true,
  isActive: true,
  startsAt: true,
  expiresAt: true,
  usageLimit: true,
  usedCount: true,
} as const satisfies Prisma.MektekVoucherSelect;

export type MektekVoucherRecordFromDb = Prisma.MektekVoucherGetPayload<{
  select: typeof mektekVoucherRecordSelect;
}>;

type VoucherClient = PrismaClient | Prisma.TransactionClient;

export type MektekVoucherLookupContext = {
  customerId?: string | null;
  customerType?: MektekCustomerTypeValue | null;
  now?: Date;
};

function voucherScopeWhere(
  context: MektekVoucherLookupContext
): Prisma.MektekVoucherWhereInput {
  const scope: Prisma.MektekVoucherWhereInput[] = [{ scope: "ALL" }];

  if (context.customerType) {
    scope.push({
      scope: "CUSTOMER_TYPE",
      customerType: context.customerType,
    });
  }

  if (context.customerId) {
    scope.push({
      scope: "CUSTOMER",
      customerId: context.customerId,
    });
  }

  return { OR: scope };
}

function activeWindowWhere(now = new Date()): Prisma.MektekVoucherWhereInput {
  return {
    isActive: true,
    AND: [
      {
        OR: [{ startsAt: null }, { startsAt: { lte: now } }],
      },
      {
        OR: [{ expiresAt: null }, { expiresAt: { gte: now } }],
      },
    ],
  };
}

export async function listAvailableMektekVouchersForCustomer(
  client: VoucherClient,
  context: MektekVoucherLookupContext
): Promise<MektekVoucher[]> {
  const now = context.now ?? new Date();
  const vouchers = await client.mektekVoucher.findMany({
    where: {
      AND: [activeWindowWhere(now), voucherScopeWhere(context)],
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    select: mektekVoucherRecordSelect,
  });

  return vouchers
    .filter((voucher) => isMektekVoucherAvailable(voucher, { ...context, now }))
    .map((voucher) => toMektekVoucher(voucher, { ...context, now }));
}

export async function findMektekVoucherRecordByCode(
  client: VoucherClient,
  code: string
) {
  const normalizedCode = cleanMektekVoucherCode(code);
  if (!normalizedCode) return null;

  return client.mektekVoucher.findUnique({
    where: { normalizedCode },
    select: mektekVoucherRecordSelect,
  });
}

export async function reserveMektekVoucherUse(
  client: VoucherClient,
  voucher: MektekVoucherRecordFromDb
) {
  const where: Prisma.MektekVoucherWhereInput = voucher.usageLimit
    ? {
        id: voucher.id,
        usedCount: {
          lt: voucher.usageLimit,
        },
      }
    : { id: voucher.id };

  const result = await client.mektekVoucher.updateMany({
    where,
    data: {
      usedCount: {
        increment: 1,
      },
    },
  });

  return result.count === 1;
}
