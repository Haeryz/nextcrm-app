import "server-only";
import { areExternalApisDisabled } from "@/lib/external-apis";
import { getContractReminderMilestones } from "@/lib/mektek/finance";
import { prismadb } from "@/lib/prisma";
import { normalizePhoneNumber } from "@/lib/phone";
import { getWhatsAppState, sendWhatsAppMessage } from "@/lib/whatsapp";

/**
 * The cron route runs with `maxDuration = 60`, and every `sendWhatsAppMessage`
 * connects/sends/disconnects (3-8s). Stop the loop before Vercel kills the
 * invocation so the run ends cleanly and the leftovers show up in the logs.
 */
const RUN_BUDGET_MS = 45_000;

export async function sendFinanceContractReminders(now = new Date()) {
  if (areExternalApisDisabled()) return { sent: 0, skipped: 0, failed: 0, error: "External API dinonaktifkan" };
  if ((await getWhatsAppState()).status !== "ready") return { sent: 0, skipped: 0, failed: 0, error: "WhatsApp belum terhubung" };
  const [contracts, recipients] = await Promise.all([
    prismadb.financeContract.findMany({ where: { status: "ACTIVE", endDate: { gte: now, lte: new Date(now.getTime() + 31 * 86_400_000) } }, include: { counterparty: { select: { legalName: true } }, reminders: true } }),
    prismadb.users.findMany({ where: { userStatus: "ACTIVE", OR: [{ is_admin: true }, { staffCapabilities: { has: "MEKTEK_ACCOUNTING" } }, { staffCapabilities: { has: "MEKTEK_FINANCE" } }] }, select: { id: true, name: true, phoneNormalized: true, phone: true } }),
  ]);
  let sent = 0, skipped = 0, failed = 0, processedContracts = 0, outOfTime = false;
  const deadline = Date.now() + RUN_BUDGET_MS;
  for (const contract of contracts) {
    if (Date.now() > deadline) { outOfTime = true; break; }
    const due = getContractReminderMilestones({ endDate: contract.endDate, now, sentMilestones: contract.reminders.filter((row) => row.status === "SENT").map((row) => row.milestoneDays) });
    for (const milestone of due) {
      if (outOfTime) break;
      for (const recipient of recipients) {
        if (Date.now() > deadline) { outOfTime = true; break; }
        const phone = normalizePhoneNumber(recipient.phoneNormalized || recipient.phone || "");
        if (!phone) { skipped += 1; continue; }
        const delivery = await prismadb.financeReminderDelivery.upsert({
          where: { contractId_milestoneDays_recipientUserId_channel: { contractId: contract.id, milestoneDays: milestone, recipientUserId: recipient.id, channel: "WHATSAPP" } },
          create: { contractId: contract.id, milestoneDays: milestone, recipientUserId: recipient.id },
          update: {},
        });
        if (delivery.status === "SENT") { skipped += 1; continue; }
        const result = await sendWhatsAppMessage({ to: phone, message: `Pengingat Finance MekTek\n\nKontrak ${contract.contractNumber} dengan ${contract.counterparty.legalName} akan berakhir dalam ${milestone} hari (${contract.endDate.toLocaleDateString("id-ID")}). Mohon review perpanjangan, sisa supply, dan tagihan terkait.` });
        await prismadb.financeReminderDelivery.update({ where: { id: delivery.id }, data: result.ok ? { status: "SENT", attempts: { increment: 1 }, attemptedAt: now, sentAt: now, lastError: null } : { status: "FAILED", attempts: { increment: 1 }, attemptedAt: now, lastError: result.error?.slice(0, 500) || "Pengiriman gagal" } });
        if (result.ok) sent += 1; else failed += 1;
      }
    }
    processedContracts += 1;
  }
  const remaining = contracts.length - processedContracts;
  if (outOfTime) console.warn(`[mektek-finance-reminders] time budget reached after ${processedContracts}/${contracts.length} contracts (sent=${sent} skipped=${skipped} failed=${failed}); ${remaining} contract(s) left unprocessed. Milestone reminders are day-exact, so anything skipped today is lost, not deferred.`);
  return { sent, skipped, failed, remaining: outOfTime ? remaining : 0 };
}
