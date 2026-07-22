import "server-only";

import { areExternalApisDisabled } from "@/lib/external-apis";
import { mektekOrderWhere } from "@/lib/mektek/orders";
import {
  buildMektekWeeklyReminderMessage,
  shouldSendMektekWeeklyReminder,
} from "@/lib/mektek/weekly-reminder";
import { prismadb } from "@/lib/prisma";
import { normalizePhoneNumber } from "@/lib/phone";
import { getWhatsAppState, sendWhatsAppMessage } from "@/lib/whatsapp";

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

function productionBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "")
  ).replace(/\/+$/, "");
}

export async function sendMektekWeeklyServiceReminders(now = new Date()) {
  if (areExternalApisDisabled()) {
    return { sent: 0, skipped: 0, failed: 0, error: "External API dinonaktifkan" };
  }
  if ((await getWhatsAppState()).status !== "ready") {
    return { sent: 0, skipped: 0, failed: 0, error: "WhatsApp belum terhubung" };
  }
  const baseUrl = productionBaseUrl();
  if (!baseUrl) {
    return { sent: 0, skipped: 0, failed: 0, error: "URL aplikasi belum dikonfigurasi" };
  }

  const orders = await prismadb.crm_Accounts_Tasks.findMany({
    where: {
      ...mektekOrderWhere(),
      taskStatus: { in: ["ACTIVE", "PENDING", "AWAITING_PAYMENT"] },
    },
    orderBy: { updatedAt: "asc" },
    take: 100,
    select: { id: true, tags: true },
  });
  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const order of orders) {
    const tags = record(order.tags);
    const reminder = record(tags.whatsappWeeklyReminder);
    if (!shouldSendMektekWeeklyReminder(reminder.lastSentAt, now)) {
      skipped += 1;
      continue;
    }
    const phone = normalizePhoneNumber(String(tags.phone ?? ""));
    const token = typeof tags.customerToken === "string" ? tags.customerToken : "";
    if (!phone || !token) {
      skipped += 1;
      continue;
    }
    const trackingLink = `${baseUrl}/id/service-status/${order.id}?token=${encodeURIComponent(token)}`;
    const result = await sendWhatsAppMessage({
      to: phone,
      message: buildMektekWeeklyReminderMessage({
        customerName: typeof tags.customerName === "string" ? tags.customerName : "Pelanggan",
        vehicle: typeof tags.vehicle === "string" ? tags.vehicle : "kendaraan Anda",
        trackingLink,
      }),
    });
    if (!result.ok) {
      failed += 1;
      continue;
    }

    const latest = await prismadb.crm_Accounts_Tasks.findUnique({
      where: { id: order.id },
      select: { tags: true },
    });
    const latestTags = record(latest?.tags);
    await prismadb.crm_Accounts_Tasks.update({
      where: { id: order.id },
      data: {
        tags: {
          ...latestTags,
          whatsappWeeklyReminder: {
            lastSentAt: now.toISOString(),
          },
        },
      },
    });
    sent += 1;
  }

  return { sent, skipped, failed };
}
