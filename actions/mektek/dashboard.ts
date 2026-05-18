"use server";

import { prismadb } from "@/lib/prisma";
import { buildMektekFinancialSummary } from "@/lib/mektek/financials";

const MEKTEK_TITLE_PREFIXES = ["MEKTEK Service -", "MEKTEK AC -"];

const startOfDay = (date = new Date()) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

const endOfDay = (date = new Date()) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);

export async function getMektekDashboardSummary(now = new Date()) {
  const orders = await prismadb.crm_Accounts_Tasks.findMany({
    where: {
      OR: MEKTEK_TITLE_PREFIXES.map((prefix) => ({
        title: {
          startsWith: prefix,
        },
      })),
    },
    select: {
      id: true,
      title: true,
      dueDateAt: true,
      taskStatus: true,
      updatedAt: true,
      createdAt: true,
      content: true,
      tags: true,
    },
    orderBy: {
      updatedAt: "desc",
    },
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
    const financials = buildMektekFinancialSummary(order.tags, order.content);

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
    recentOrders: orders.slice(0, 8),
  };
}
