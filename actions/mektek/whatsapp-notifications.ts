// NOT a "use server" module. These are internal helpers (invoked only from
// service-orders.ts / catalog-purchase.ts on the server). If this carried the
// "use server" directive, notifyMektekOrderCreated/Completed would each be a
// network-invocable server action that sends a WhatsApp message + PDFs to a
// caller-supplied phone — i.e. arbitrary spam/phishing from the business number.
// No client component imports this module, so it stays a plain server module.
import "server-only";
import { buildMektekInvoiceData, renderMektekInvoicePdf, renderMektekReceiptPdf } from "@/actions/mektek/invoice-pdf";
import { areExternalApisDisabled } from "@/lib/external-apis";
import { getActiveWhatsAppMessageTemplateBody } from "@/lib/mektek/whatsapp-message-template-store";
import { applyWhatsAppMessageTemplate } from "@/lib/mektek/whatsapp-message-templates";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { getWhatsAppState } from "@/lib/whatsapp";

type ServiceOrderSummary = {
  id: string;
  content?: string | null;
  createdAt?: Date | null;
  taskStatus?: string | null;
  tags?: unknown;
};

function parseTags(tags: unknown): Record<string, unknown> {
  if (!tags || typeof tags !== "object" || Array.isArray(tags)) return {};
  return tags as Record<string, unknown>;
}

function buildContext(order: ServiceOrderSummary) {
  const tags = parseTags(order.tags);
  const customerName =
    (tags.customerName as string | undefined) ||
    "Customer";
  const vehicle = (tags.vehicle as string | undefined) || "Vehicle";
  const phone = (tags.phone as string | undefined) || "";

  return { customerName, vehicle, phone, tags };
}

const DEFAULT_NEW_ORDER_TEMPLATE = [
  "Halo {customerName},",
  "",
  "Terima kasih, pesanan servis kendaraan {vehicle} sudah kami terima di Mektek.",
  "",
  "Tim kami akan melakukan pengecekan awal dan memperbarui Progress servis secara berkala.",
  "",
  "Cek status servis Anda di:",
  "{trackingLink}",
  "",
  "Simpan link ini untuk melihat status, estimasi, dan catatan pengerjaan terbaru.",
  "",
  "Terima kasih telah mempercayai Mektek.",
].join("\n");

const DEFAULT_READY_FOR_PAYMENT_TEMPLATE = [
  "Halo {customerName},",
  "",
  "Pengerjaan servis kendaraan {vehicle} Anda sudah selesai dan siap dicek.",
  "",
  "Silakan periksa rincian jasa, sparepart, estimasi, dan invoice melalui link berikut. Pembayaran sudah dapat dilakukan dari halaman tersebut:",
  "{trackingLink}",
  "",
  "Invoice kami lampirkan. Silakan hubungi kami jika ada yang ingin dikonfirmasi sebelum pembayaran.",
  "",
  "Terima kasih telah mempercayai Mektek.",
].join("\n");

const DEFAULT_COMPLETED_TEMPLATE = [
  "Halo {customerName},",
  "",
  "Order servis kendaraan {vehicle} Anda sudah selesai, lunas, dan ditutup.",
  "",
  "Invoice dan struk pembayaran kami lampirkan. Riwayat servis tetap dapat dilihat melalui:",
  "{trackingLink}",
  "",
  "Terima kasih telah mempercayai Mektek.",
].join("\n");

export async function notifyMektekOrderCreated(params: {
  order: ServiceOrderSummary;
  trackingLink: string;
}) {
  const context = buildContext(params.order);
  if (!context.phone) return { ok: false, error: "Nomor telepon tidak tersedia" };
  if (areExternalApisDisabled()) return { ok: false, error: "External API dinonaktifkan" };
  if ((await getWhatsAppState()).status !== "ready") {
    return { ok: false, error: "WhatsApp Session belum siap" };
  }

  const messageTemplate =
    (context.tags.whatsappNewOrderTemplate as string | undefined) ||
    (await getActiveWhatsAppMessageTemplateBody("ORDER_CREATED")) ||
    DEFAULT_NEW_ORDER_TEMPLATE;

  const message = applyWhatsAppMessageTemplate(messageTemplate, {
    customerName: context.customerName,
    vehicle: context.vehicle,
    trackingLink: params.trackingLink,
  });

  return sendWhatsAppMessage({ to: context.phone, message });
}

export async function notifyMektekOrderCompleted(params: {
  order: ServiceOrderSummary;
  trackingLink: string;
}) {
  const context = buildContext(params.order);
  if (!context.phone) return { ok: false, error: "Nomor telepon tidak tersedia" };
  if (areExternalApisDisabled()) return { ok: false, error: "External API dinonaktifkan" };
  if ((await getWhatsAppState()).status !== "ready") {
    return { ok: false, error: "WhatsApp Session belum siap" };
  }

  const messageTemplate =
    (context.tags.whatsappCompletedTemplate as string | undefined) ||
    (await getActiveWhatsAppMessageTemplateBody("ORDER_COMPLETED")) ||
    DEFAULT_COMPLETED_TEMPLATE;

  const message = applyWhatsAppMessageTemplate(messageTemplate, {
    customerName: context.customerName,
    vehicle: context.vehicle,
    trackingLink: params.trackingLink,
  });

  const invoiceData = buildMektekInvoiceData(params.order);
  const [invoiceRaw, receiptRaw] = await Promise.all([
    renderMektekInvoicePdf(invoiceData),
    renderMektekReceiptPdf(invoiceData),
  ]);
  const invoicePdf = Buffer.from(invoiceRaw);
  const receiptPdf = Buffer.from(receiptRaw);

  return sendWhatsAppMessage({
    to: context.phone,
    message,
    media: [
      {
        mimeType: "application/pdf",
        filename: `invoice-${params.order.id.slice(0, 8)}.pdf`,
        data: invoicePdf,
        caption: "Invoice",
      },
      {
        mimeType: "application/pdf",
        filename: `struk-${params.order.id.slice(0, 8)}.pdf`,
        data: receiptPdf,
        caption: "Struk",
      },
    ],
  });
}

export async function notifyMektekOrderReadyForPayment(params: {
  order: ServiceOrderSummary;
  trackingLink: string;
}) {
  const context = buildContext(params.order);
  if (!context.phone) return { ok: false, error: "Nomor telepon tidak tersedia" };
  if (areExternalApisDisabled()) return { ok: false, error: "External API dinonaktifkan" };
  if ((await getWhatsAppState()).status !== "ready") {
    return { ok: false, error: "WhatsApp Session belum siap" };
  }

  const messageTemplate =
    (context.tags.whatsappReadyForPaymentTemplate as string | undefined) ||
    (await getActiveWhatsAppMessageTemplateBody("READY_FOR_PAYMENT")) ||
    DEFAULT_READY_FOR_PAYMENT_TEMPLATE;
  const message = applyWhatsAppMessageTemplate(messageTemplate, {
    customerName: context.customerName,
    vehicle: context.vehicle,
    trackingLink: params.trackingLink,
  });
  const invoicePdf = Buffer.from(
    await renderMektekInvoicePdf(buildMektekInvoiceData(params.order)),
  );

  return sendWhatsAppMessage({
    to: context.phone,
    message,
    media: [
      {
        mimeType: "application/pdf",
        filename: `invoice-${params.order.id.slice(0, 8)}.pdf`,
        data: invoicePdf,
        caption: "Invoice",
      },
    ],
  });
}
