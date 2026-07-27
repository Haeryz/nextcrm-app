"use server";

import type { Session } from "next-auth";
import {
  getMektekServiceOrderExportMonthKey,
  getMektekServiceOrderExportMonthRange,
  getMektekServiceOrderExportMonthSpan,
  getMektekServiceOrderExportYearRange,
  type MektekServiceOrderExportOrder,
} from "@/lib/mektek/service-order-export";
import { mektekOrderWhere, mektekPaymentSelect } from "@/lib/mektek/orders";
import { canViewMektekOrders } from "@/lib/mektek/permissions";
import { prismadb } from "@/lib/prisma";
import { getRequestSessionUser } from "@/lib/request-session";
import { getServerSession } from "@/lib/session";

type ResolvedRange = {
  start: Date;
  end: Date;
  label: string;
};

function resolveServiceOrderExportRange(
  month: string | undefined,
  fromMonth: string | undefined,
  toMonth: string | undefined,
  year: string | undefined,
): ResolvedRange {
  if (fromMonth || toMonth) {
    const from = fromMonth || toMonth || getMektekServiceOrderExportMonthKey();
    const to = toMonth || fromMonth || getMektekServiceOrderExportMonthKey();
    const span = getMektekServiceOrderExportMonthSpan(from, to);
    return {
      start: span.start,
      end: span.end,
      label:
        span.fromMonth === span.toMonth
          ? span.fromMonth
          : `${span.fromMonth}_${span.toMonth}`,
    };
  }
  if (month) {
    const range = getMektekServiceOrderExportMonthRange(month);
    return { start: range.start, end: range.end, label: range.month };
  }
  if (year) {
    const parsed = Number(year);
    const range = getMektekServiceOrderExportYearRange(parsed);
    return { start: range.start, end: range.end, label: String(range.year) };
  }
  const monthKey = getMektekServiceOrderExportMonthKey();
  const range = getMektekServiceOrderExportMonthRange(monthKey);
  return { start: range.start, end: range.end, label: range.month };
}

export async function getMektekServiceOrderExportData(
  inputOrMonth?:
    | {
        month?: string;
        fromMonth?: string;
        toMonth?: string;
        year?: string;
        request?: Request;
      }
    | string
    | undefined,
  legacyRequest?: Request,
) {
  const input =
    typeof inputOrMonth === "string"
      ? { month: inputOrMonth, request: legacyRequest }
      : (inputOrMonth ?? {});
  const month = input.month;
  const fromMonth = input.fromMonth;
  const toMonth = input.toMonth;
  const year = input.year;
  const request = input.request;
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

  const resolved = resolveServiceOrderExportRange(
    month,
    fromMonth,
    toMonth,
    year,
  );
  const orders = await prismadb.crm_Accounts_Tasks.findMany({
    where: {
      ...mektekOrderWhere(),
      createdAt: { gte: resolved.start, lt: resolved.end },
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

  return { month: resolved.label, orders };
}
