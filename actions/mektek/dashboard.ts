"use server";

import { authOptions } from "@/lib/auth";
import { getServerSession } from "@/lib/session";
import { prismadb } from "@/lib/prisma";
import { buildMektekFinancialSummary } from "@/lib/mektek/financials";
import { buildMektekDashboardAnalytics } from "@/lib/mektek/dashboard-analytics";
import { mektekOrderWhere, mektekPaymentSelect } from "@/lib/mektek/orders";
import { canViewMektekDashboard } from "@/lib/mektek/permissions";

const startOfDay = (date = new Date()) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

const endOfDay = (date = new Date()) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);

export async function getMektekDashboardSummary(
  now = new Date(),
  options?: {
    recentOrdersPage?: number;
    recentOrdersPageSize?: number;
  }
) {
  // "use server" export → authorize independently of the calling page (which already
  // pre-gates). Exposes full financials, so gate on the admin-only dashboard
  // permission. Throw rather than return an error union so the page's direct field
  // access (summary.openOrders, …) and tsc stay valid.
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !canViewMektekDashboard(session.user)) {
    throw new Error("Forbidden");
  }

  const recentOrdersPageSize = Math.min(
    Math.max(Number(options?.recentOrdersPageSize) || 6, 1),
    20
  );
  const requestedRecentOrdersPage = Math.max(
    Number(options?.recentOrdersPage) || 1,
    1
  );

  const [orders, recentOrdersTotalCount, newestItems, quantityUpdates] = await Promise.all([
    prismadb.crm_Accounts_Tasks.findMany({
      where: mektekOrderWhere(),
      select: {
        id: true,
        createdAt: true,
        dueDateAt: true,
        taskStatus: true,
        updatedAt: true,
        content: true,
        tags: true,
        mektekPayments: {
          orderBy: {
            createdAt: "desc",
          },
          select: mektekPaymentSelect,
        },
      },
    }),
    prismadb.crm_Accounts_Tasks.count({
      where: mektekOrderWhere(),
    }),
    prismadb.catalogItem.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        machine: true,
        description: true,
        partNumber: true,
        quantity: true,
        createdAt: true,
      },
    }),
    prismadb.catalogItem.findMany({
      where: { quantityUpdatedAt: { not: null } },
      orderBy: { quantityUpdatedAt: "desc" },
      take: 5,
      select: {
        id: true,
        machine: true,
        description: true,
        partNumber: true,
        quantity: true,
        previousQuantity: true,
        quantityUpdatedAt: true,
      },
    }),
  ]);

  const recentOrdersTotalPages = Math.max(
    1,
    Math.ceil(recentOrdersTotalCount / recentOrdersPageSize)
  );
  const recentOrdersPage = Math.min(
    requestedRecentOrdersPage,
    recentOrdersTotalPages
  );
  const recentOrders = await prismadb.crm_Accounts_Tasks.findMany({
    where: mektekOrderWhere(),
    select: {
      id: true,
      serviceNumber: true,
      title: true,
      dueDateAt: true,
      taskStatus: true,
      updatedAt: true,
      createdAt: true,
      content: true,
      tags: true,
      mektekPayments: {
        orderBy: {
          createdAt: "desc",
        },
        select: mektekPaymentSelect,
      },
      assigned_user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
    orderBy: {
      updatedAt: "desc",
    },
    skip: (recentOrdersPage - 1) * recentOrdersPageSize,
    take: recentOrdersPageSize,
  });

  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  let openOrders = 0;
  let dueToday = 0;
  let overdue = 0;
  let completedToday = 0;
  let unpaidBalance = 0;

  for (const order of orders) {
    const isComplete = order.taskStatus === "COMPLETE";
    const dueDate = order.dueDateAt ? new Date(order.dueDateAt) : null;
    const updatedAt = order.updatedAt ? new Date(order.updatedAt) : null;
    const financials = buildMektekFinancialSummary(
      order.tags,
      order.content,
      order.mektekPayments
    );

    if (!isComplete) openOrders++;
    if (!isComplete && dueDate && dueDate >= todayStart && dueDate <= todayEnd) dueToday++;
    if (!isComplete && dueDate && dueDate < todayStart) overdue++;
    if (isComplete && updatedAt && updatedAt >= todayStart && updatedAt <= todayEnd) {
      completedToday++;
    }
    unpaidBalance += financials.balanceDue;
  }

  return {
    openOrders,
    dueToday,
    overdue,
    completedToday,
    unpaidBalance,
    recentOrders,
    recentOrdersPage,
    recentOrdersPageSize,
    recentOrdersTotalCount,
    recentOrdersTotalPages,
    analytics: buildMektekDashboardAnalytics(orders, now),
    itemActivity: { newestItems, quantityUpdates },
  };
}
