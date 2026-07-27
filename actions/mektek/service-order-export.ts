"use server";

import type { Session } from "next-auth";
import {
  getMektekServiceOrderExportMonthKey,
  getMektekServiceOrderExportMonthRange,
} from "@/lib/mektek/service-order-export";
import { mektekOrderWhere, mektekPaymentSelect } from "@/lib/mektek/orders";
import { canViewMektekOrders } from "@/lib/mektek/permissions";
import { prismadb } from "@/lib/prisma";
import { getRequestSessionUser } from "@/lib/request-session";
import { getServerSession } from "@/lib/session";

export async function getMektekServiceOrderExportData(
  month?: string,
  request?: Request,
) {
  let session: Session | null = await getServerSession();
  if (!session?.user?.id && request) {
    const user = await getRequestSessionUser(request);
    if (user?.id) {
      session = {
        user,
        expires: new Date(Date.now() + 1000 * 60 * 60).toISOString(),
      } as Session;
    }
  }
  if (!session?.user?.id || !canViewMektekOrders(session.user)) {
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
