"use server";

import { authOptions } from "@/lib/auth";
import { prismadb } from "@/lib/prisma";
import { getServerSession } from "@/lib/session";

/**
 * Read side of the WhatsApp send log. The write side (populating
 * `WhatsAppMessageLog` from the send path) lives with the sender in
 * `lib/whatsapp/**` — this file only reads, so it never imports it.
 *
 * Everything here is deliberately aggregate-only or database-paginated: the log
 * grows one row per outbound message forever, so loading rows into memory to
 * count or slice them would stop working the moment the number gets busy.
 */

// Kept local: a "use server" module may only export async functions, so the
// shared labels/options live in the route's _components/whatsapp-log-view.ts.
const WHATSAPP_LOG_STATUSES = ["sent", "failed", "suppressed"] as const;

const DEFAULT_RANGE_DAYS = 30;
const MAX_RANGE_DAYS = 365;
const PAGE_SIZE = 25;

// Indonesia has no daylight saving, so a fixed WIB offset is exact. Vercel runs
// the server in UTC; "hari ini" has to mean the workshop's day, not UTC's.
const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000;

function startOfJakartaDay(now: Date) {
  const shifted = new Date(now.getTime() + JAKARTA_OFFSET_MS);
  shifted.setUTCHours(0, 0, 0, 0);
  return new Date(shifted.getTime() - JAKARTA_OFFSET_MS);
}

export type WhatsAppSendActivityInput = {
  days?: unknown;
  purpose?: unknown;
  status?: unknown;
  page?: unknown;
};

export type WhatsAppSendActivityRow = {
  id: string;
  sentAt: Date;
  recipientMasked: string;
  purpose: string;
  category: string;
  status: string;
  error: string | null;
  sentByLabel: string | null;
};

export type WhatsAppSendActivityBreakdown = {
  total: number;
  transactional: number;
  promotional: number;
};

export type WhatsAppSendActivityPurposeRow = {
  purpose: string;
  total: number;
  transactional: number;
  promotional: number;
};

export type WhatsAppSendActivityData = {
  rangeDays: number;
  purpose: string | null;
  status: string | null;
  page: number;
  pageSize: number;
  totalRows: number;
  pageCount: number;
  rows: WhatsAppSendActivityRow[];
  today: WhatsAppSendActivityBreakdown;
  week: WhatsAppSendActivityBreakdown;
  range: WhatsAppSendActivityBreakdown & {
    sent: number;
    failed: number;
    suppressed: number;
  };
  purposes: WhatsAppSendActivityPurposeRow[];
};

/**
 * Same gate as the WhatsApp template actions: the log exposes who was messaged
 * and why, which is exactly the data the owner needs and staff do not.
 */
async function ensureWhatsAppLogAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { error: "Unauthorized" as const };
  if (session.user.userStatus !== "ACTIVE" || !session.user.isAdmin) {
    return {
      error:
        "Forbidden: only active admins can read the WhatsApp send log" as const,
    };
  }
  return { userId: session.user.id };
}

function normalizeRangeDays(value: unknown) {
  const parsed = Math.trunc(Number(value));
  if (!Number.isFinite(parsed) || parsed < 1) return DEFAULT_RANGE_DAYS;
  return Math.min(parsed, MAX_RANGE_DAYS);
}

function normalizeFilter(value: unknown, allowed: readonly string[]) {
  const text = String(value ?? "").trim();
  if (!text || text === "all") return null;
  return allowed.length === 0 || allowed.includes(text) ? text : null;
}

function normalizePurpose(value: unknown) {
  const text = String(value ?? "").trim().slice(0, 40);
  if (!text || text === "all") return null;
  return text;
}

type CategoryStatusGroup = {
  category: string;
  status: string;
  _count: { _all: number };
};

function summarize(groups: CategoryStatusGroup[]): WhatsAppSendActivityBreakdown {
  let total = 0;
  let transactional = 0;
  let promotional = 0;
  for (const group of groups) {
    const count = group._count._all;
    total += count;
    if (group.category === "promotional") promotional += count;
    else if (group.category === "transactional") transactional += count;
  }
  return { total, transactional, promotional };
}

export async function listWhatsAppSendActivity(
  input: WhatsAppSendActivityInput = {},
) {
  const access = await ensureWhatsAppLogAdmin();
  if ("error" in access) return { error: access.error };

  const rangeDays = normalizeRangeDays(input?.days);
  const purpose = normalizePurpose(input?.purpose);
  const status = normalizeFilter(input?.status, WHATSAPP_LOG_STATUSES);
  const requestedPage = Math.trunc(Number(input?.page));
  const page =
    Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;

  const now = new Date();
  const todayStart = startOfJakartaDay(now);
  const weekStart = new Date(todayStart.getTime() - 6 * 24 * 60 * 60 * 1000);
  const rangeStart = new Date(
    todayStart.getTime() - (rangeDays - 1) * 24 * 60 * 60 * 1000,
  );

  const tableWhere = {
    sentAt: { gte: rangeStart },
    ...(purpose ? { purpose } : {}),
    ...(status ? { status } : {}),
  };

  try {
    const [
      todayGroups,
      weekGroups,
      rangeGroups,
      purposeGroups,
      totalRows,
      logRows,
    ] = await Promise.all([
      // Tiles are computed by the database. Never fetch rows and count in JS —
      // this table only ever grows.
      prismadb.whatsAppMessageLog.groupBy({
        by: ["category", "status"],
        where: { sentAt: { gte: todayStart } },
        _count: { _all: true },
      }),
      prismadb.whatsAppMessageLog.groupBy({
        by: ["category", "status"],
        where: { sentAt: { gte: weekStart } },
        _count: { _all: true },
      }),
      prismadb.whatsAppMessageLog.groupBy({
        by: ["category", "status"],
        where: { sentAt: { gte: rangeStart } },
        _count: { _all: true },
      }),
      prismadb.whatsAppMessageLog.groupBy({
        by: ["purpose", "category"],
        where: { sentAt: { gte: rangeStart } },
        _count: { _all: true },
      }),
      prismadb.whatsAppMessageLog.count({ where: tableWhere }),
      prismadb.whatsAppMessageLog.findMany({
        where: tableWhere,
        orderBy: { sentAt: "desc" },
        // Database pagination — the page is a window over the index, not a
        // slice of an array we already paid to load.
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        select: {
          id: true,
          sentAt: true,
          recipientMasked: true,
          purpose: true,
          category: true,
          status: true,
          error: true,
          sentById: true,
        },
      }),
    ]);

    const senderIds = Array.from(
      new Set(
        logRows
          .map((row) => row.sentById)
          .filter((id): id is string => Boolean(id)),
      ),
    );
    const senders = senderIds.length
      ? await prismadb.users.findMany({
          where: { id: { in: senderIds } },
          select: { id: true, name: true, email: true },
        })
      : [];
    const senderById = new Map(
      senders.map((sender) => [sender.id, sender.name || sender.email]),
    );

    const rangeSummary = summarize(rangeGroups);
    const rangeStatus = { sent: 0, failed: 0, suppressed: 0 };
    for (const group of rangeGroups) {
      if (group.status === "sent") rangeStatus.sent += group._count._all;
      else if (group.status === "failed") rangeStatus.failed += group._count._all;
      else if (group.status === "suppressed") {
        rangeStatus.suppressed += group._count._all;
      }
    }

    const purposeMap = new Map<string, WhatsAppSendActivityPurposeRow>();
    for (const group of purposeGroups) {
      const entry = purposeMap.get(group.purpose) ?? {
        purpose: group.purpose,
        total: 0,
        transactional: 0,
        promotional: 0,
      };
      entry.total += group._count._all;
      if (group.category === "promotional") {
        entry.promotional += group._count._all;
      } else if (group.category === "transactional") {
        entry.transactional += group._count._all;
      }
      purposeMap.set(group.purpose, entry);
    }

    const data: WhatsAppSendActivityData = {
      rangeDays,
      purpose,
      status,
      page,
      pageSize: PAGE_SIZE,
      totalRows,
      pageCount: Math.max(1, Math.ceil(totalRows / PAGE_SIZE)),
      rows: logRows.map((row) => ({
        id: row.id,
        sentAt: row.sentAt,
        recipientMasked: row.recipientMasked,
        purpose: row.purpose,
        category: row.category,
        status: row.status,
        error: row.error,
        sentByLabel: row.sentById
          ? senderById.get(row.sentById) ?? "Staf terhapus"
          : null,
      })),
      today: summarize(todayGroups),
      week: summarize(weekGroups),
      range: { ...rangeSummary, ...rangeStatus },
      purposes: [...purposeMap.values()].sort(
        (left, right) => right.total - left.total,
      ),
    };

    return { data };
  } catch (error) {
    console.log("[LIST_WHATSAPP_SEND_ACTIVITY]", error);
    return { error: "Gagal memuat aktivitas pengiriman WhatsApp" };
  }
}
