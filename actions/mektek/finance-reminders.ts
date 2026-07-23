import "server-only";
import { areExternalApisDisabled } from "@/lib/external-apis";
import { getContractReminderMilestones } from "@/lib/mektek/finance";
import { prismadb } from "@/lib/prisma";
import { normalizePhoneNumber } from "@/lib/phone";
import { getWhatsAppState, sendWhatsAppMessage } from "@/lib/whatsapp";

export async function sendFinanceContractReminders(now = new Date()) {
  if (areExternalApisDisabled()) return { sent: 0, skipped: 0, failed: 0, error: "External API dinonaktifkan" };
  if ((await getWhatsAppState()).status !== "ready") return { sent: 0, skipped: 0, failed: 0, error: "WhatsApp belum terhubung" };
  const [contracts, recipients] = await Promise.all([
    prismadb.financeContract.findMany({ where: { status: "ACTIVE", endDate: { gte: now, lte: new Date(now.getTime() + 31 * 86_400_000) } }, include: { counterparty: { select: { legalName: true } }, reminders: true } }),
    prismadb.users.findMany({ where: { userStatus: "ACTIVE", OR: [{ is_admin: true }, { staffDivision: "FINANCE" }] }, select: { id: true, name: true, phoneNormalized: true, phone: true } }),
  ]);
  let sent = 0, skipped = 0, failed = 0;
  for (const contract of contracts) {
    const due = getContractReminderMilestones({ endDate: contract.endDate, now, sentMilestones: contract.reminders.filter((row) => row.status === "SENT").map((row) => row.milestoneDays) });
    for (const milestone of due) {
      for (const recipient of recipients) {
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
  }
  return { sent, skipped, failed };
}
