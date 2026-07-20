"use server";

import { authOptions } from "@/lib/auth";
import {
  getMektekServiceOrderExportMonthKey,
  getMektekServiceOrderExportMonthRange,
} from "@/lib/mektek/service-order-export";
import { mektekOrderWhere, mektekPaymentSelect } from "@/lib/mektek/orders";
import { canAccessMektekStaffArea } from "@/lib/mektek/permissions";
import { prismadb } from "@/lib/prisma";
import { getServerSession } from "@/lib/session";

export async function getMektekServiceOrderExportData(month?: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !canAccessMektekStaffArea(session.user)) {
    throw new Error("Forbidden");
  }

  const range = getMektekServiceOrderExportMonthRange(
    month || getMektekServiceOrderExportMonthKey(),
  );
  const orders = await prismadb.crm_Accounts_Tasks.findMany({
    where: {
      ...mektekOrderWhere(),
      createdAt: { gte: range.start, lt: range.end },
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      serviceNumber: true,
      title: true,
      taskStatus: true,
      dueDateAt: true,
      createdAt: true,
      updatedAt: true,
      content: true,
      tags: true,
      mektekPayments: {
        orderBy: { createdAt: "desc" },
        select: mektekPaymentSelect,
      },
      assigned_user: {
        select: { id: true, name: true, email: true },
      },
    },
  });

  return { month: range.month, orders };
}
