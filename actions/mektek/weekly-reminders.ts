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

/**
 * The cron route runs with `maxDuration = 60`, and every `sendWhatsAppMessage`
 * connects/sends/disconnects (3-8s). Stop the loop before Vercel kills the
 * invocation so the run ends cleanly and the leftovers are reported instead of
 * being silently dropped mid-write.
 */
const RUN_BUDGET_MS = 45_000;

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
  let remaining = 0;

  const deadline = Date.now() + RUN_BUDGET_MS;

  for (const [index, order] of orders.entries()) {
    if (Date.now() > deadline) {
      remaining = orders.length - index;
      console.warn(
        `[mektek-weekly-reminders] time budget reached after ${index}/${orders.length} orders (sent=${sent} skipped=${skipped} failed=${failed}); ${remaining} order(s) left for the next run`,
      );
      break;
    }
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
    // Tagged promotional on purpose: this is a recurring unsolicited nudge, not
    // something the recipient asked for. That classification is what subjects it
    // to the do-not-contact check and the daily cap in the send policy — an
    // untagged send defaults to transactional and bypasses both.
    const result = await sendWhatsAppMessage({
      to: phone,
      purpose: "weekly-reminder",
      category: "promotional",
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

    // Single atomic JSONB merge instead of read-modify-write: it halves the
    // round-trips and cannot clobber a concurrent edit of the other tag keys.
    // `updatedAt` is stamped by hand because `@updatedAt` is applied by Prisma,
    // not by the database — and the `updatedAt: "asc"` ordering above is what
    // makes a truncated run resume on the orders it never reached.
    await prismadb.$executeRaw`UPDATE "crm_Accounts_Tasks"
      SET "tags" = jsonb_set(
            CASE WHEN jsonb_typeof("tags") = 'object' THEN "tags" ELSE '{}'::jsonb END,
            '{whatsappWeeklyReminder}',
            ${JSON.stringify({ lastSentAt: now.toISOString() })}::jsonb,
            true
          ),
          "updatedAt" = ${now.toISOString()}::timestamp
      WHERE "id" = ${order.id}::uuid`;
    sent += 1;
  }

  return { sent, skipped, failed, remaining };
}
