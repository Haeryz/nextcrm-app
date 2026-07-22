const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export function shouldSendMektekWeeklyReminder(
  lastSentAt: unknown,
  now = new Date(),
) {
  if (typeof lastSentAt !== "string") return true;
  const sentAt = new Date(lastSentAt);
  return Number.isNaN(sentAt.getTime()) || now.getTime() - sentAt.getTime() >= WEEK_MS;
}

export function buildMektekWeeklyReminderMessage(input: {
  customerName: string;
  vehicle: string;
  trackingLink: string;
}) {
  return [
    `Halo ${input.customerName || "Pelanggan"},`,
    "",
    `Ini adalah pengingat mingguan untuk servis ${input.vehicle || "kendaraan Anda"} di MekTek.`,
    "Status, estimasi, pekerjaan, sparepart, dan tagihan terbaru dapat dilihat di:",
    input.trackingLink,
    "",
    "Pesan ini akan berhenti otomatis setelah order servis selesai.",
  ].join("\n");
}
