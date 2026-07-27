"use server";

import { renderMektekPurchaseOrderPdf } from "@/actions/mektek/logistics-purchase-order-pdf";
import { authOptions } from "@/lib/auth";
import { canManageMektekLogistics } from "@/lib/mektek/permissions";
import { prismadb } from "@/lib/prisma";
import { isValidPhoneNumber, normalizePhoneNumber } from "@/lib/phone";
import { getServerSession } from "@/lib/session";
import { getWhatsAppState, sendWhatsAppMessage } from "@/lib/whatsapp";

type LogisticsDocumentInput = {
  documentType: "PO";
  purchaseOrderId: string;
  phone: string;
};

export async function sendMektekLogisticsDocumentWhatsApp(
  input: LogisticsDocumentInput,
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { error: "Unauthorized: silakan Login" };
  if (!canManageMektekLogistics(session.user, "RECEIVING")) {
    return { error: "Forbidden: hanya staf Logistics atau Admin" };
  }
  const phone = normalizePhoneNumber(input.phone);
  if (!isValidPhoneNumber(phone)) {
    return { error: "Nomor WhatsApp tujuan tidak valid" };
  }
  if ((await getWhatsAppState()).status !== "ready") {
    return { error: "WhatsApp belum terhubung" };
  }

  const purchaseOrder = await prismadb.logisticsPurchaseOrder.findFirst({
    where: { id: input.purchaseOrderId, flow: "RECEIVING" },
    include: { items: { orderBy: { position: "asc" } } },
  });
  if (!purchaseOrder) return { error: "Purchase Order Receiving tidak ditemukan" };
  const pdf = Buffer.from(
    await renderMektekPurchaseOrderPdf({
      ...purchaseOrder,
      items: purchaseOrder.items.map((item) => ({
        position: item.position,
        partName: item.partName,
        partNumber: item.partNumber,
        orderedQuantity: item.orderedQuantity,
        unitPrice: Number(item.agreedUnitPrice || 0),
        note: item.note,
      })),
    }),
  );
  const result = await sendWhatsAppMessage({
    to: phone,
    message: `Purchase Order Receiving ${purchaseOrder.poNumber} dari MekTek terlampir.`,
    media: [{
      mimeType: "application/pdf",
      filename: `purchase-order-${purchaseOrder.poNumber.replace(/[^A-Za-z0-9_-]+/g, "-")}.pdf`,
      data: pdf,
      caption: `Purchase Order Receiving ${purchaseOrder.poNumber}`,
    }],
  });
  return result.ok
    ? { data: { sent: true } }
    : { error: result.error || "Gagal mengirim PO Receiving" };
}
