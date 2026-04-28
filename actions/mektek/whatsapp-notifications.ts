"use server";

import { buildMektekInvoiceData, renderMektekInvoicePdf, renderMektekReceiptPdf } from "@/actions/mektek/invoice-pdf";
import { areExternalApisDisabled } from "@/lib/external-apis";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { getWhatsAppState } from "@/lib/whatsapp/client";

type ServiceOrderSummary = {
  id: string;
  content?: string | null;
  createdAt?: Date | null;
  tags?: unknown;
  crm_accounts?: { name?: string | null; office_phone?: string | null; billing_street?: string | null } | null;
};

function parseTags(tags: unknown): Record<string, unknown> {
  if (!tags || typeof tags !== "object" || Array.isArray(tags)) return {};
  return tags as Record<string, unknown>;
}

function buildContext(order: ServiceOrderSummary) {
  const tags = parseTags(order.tags);
  const customerName =
    (order.crm_accounts?.name as string | undefined) ||
    (tags.customerName as string | undefined) ||
    "Customer";
  const vehicle = (tags.vehicle as string | undefined) || "Vehicle";
  const phone =
    (tags.phone as string | undefined) ||
    (order.crm_accounts?.office_phone as string | undefined) ||
    "";

  return { customerName, vehicle, phone, tags };
}

function applyTemplate(template: string, context: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => context[key] ?? "");
}

export async function notifyMektekOrderCreated(params: {
  order: ServiceOrderSummary;
  trackingLink: string;
}) {
  const context = buildContext(params.order);
  if (!context.phone) return { ok: false, error: "No phone" };
  if (areExternalApisDisabled()) return { ok: false, error: "External APIs are disabled" };
  if (getWhatsAppState().status !== "ready") {
    return { ok: false, error: "WhatsApp session is not ready" };
  }

  const messageTemplate =
    (context.tags.whatsappNewOrderTemplate as string | undefined) ||
    "Halo {customerName}, pesanan servis kendaraan {vehicle} Anda telah kami terima. Pantau progres di: {trackingLink}";

  const message = applyTemplate(messageTemplate, {
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
  if (!context.phone) return { ok: false, error: "No phone" };
  if (areExternalApisDisabled()) return { ok: false, error: "External APIs are disabled" };
  if (getWhatsAppState().status !== "ready") {
    return { ok: false, error: "WhatsApp session is not ready" };
  }

  const messageTemplate =
    (context.tags.whatsappCompletedTemplate as string | undefined) ||
    "Halo {customerName}, servis kendaraan {vehicle} Anda telah selesai. Invoice dan struk terlampir. Pantau status di: {trackingLink}";

  const message = applyTemplate(messageTemplate, {
    customerName: context.customerName,
    vehicle: context.vehicle,
    trackingLink: params.trackingLink,
  });

  const invoiceData = buildMektekInvoiceData(params.order);
  const [invoicePdf, receiptPdf] = await Promise.all([
    renderMektekInvoicePdf(invoiceData),
    renderMektekReceiptPdf(invoiceData),
  ]);

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
