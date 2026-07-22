"use server";

import { renderMektekDeliveryNotePdf } from "@/actions/mektek/logistics-delivery-note-pdf";
import { renderMektekPurchaseOrderPdf } from "@/actions/mektek/logistics-purchase-order-pdf";
import { authOptions } from "@/lib/auth";
import { canManageMektekLogistics } from "@/lib/mektek/permissions";
import { prismadb } from "@/lib/prisma";
import { isValidPhoneNumber, normalizePhoneNumber } from "@/lib/phone";
import { getServerSession } from "@/lib/session";
import { getWhatsAppState, sendWhatsAppMessage } from "@/lib/whatsapp";

type LogisticsDocumentInput = {
  documentType: "PO" | "DO";
  purchaseOrderId: string;
  receiptId?: string;
  phone: string;
};

export async function sendMektekLogisticsDocumentWhatsApp(
  input: LogisticsDocumentInput,
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { error: "Unauthorized: silakan Login" };
  if (!canManageMektekLogistics(session.user)) {
    return { error: "Forbidden: hanya staf Logistics atau Admin" };
  }
  const phone = normalizePhoneNumber(input.phone);
  if (!isValidPhoneNumber(phone)) {
    return { error: "Nomor WhatsApp tujuan tidak valid" };
  }
  if ((await getWhatsAppState()).status !== "ready") {
    return { error: "WhatsApp belum terhubung" };
  }

  if (input.documentType === "PO") {
    const purchaseOrder = await prismadb.logisticsPurchaseOrder.findUnique({
      where: { id: input.purchaseOrderId },
      include: { items: { orderBy: { position: "asc" } } },
    });
    if (!purchaseOrder) return { error: "Purchase Order tidak ditemukan" };
    const pdf = Buffer.from(await renderMektekPurchaseOrderPdf(purchaseOrder));
    const result = await sendWhatsAppMessage({
      to: phone,
      message: `Purchase Order ${purchaseOrder.poNumber} dari MekTek terlampir.`,
      media: [{
        mimeType: "application/pdf",
        filename: `purchase-order-${purchaseOrder.poNumber.replace(/[^A-Za-z0-9_-]+/g, "-")}.pdf`,
        data: pdf,
        caption: `Purchase Order ${purchaseOrder.poNumber}`,
      }],
    });
    return result.ok ? { data: { sent: true } } : { error: result.error || "Gagal mengirim PO" };
  }

  const receiptId = String(input.receiptId ?? "").trim();
  if (!receiptId) return { error: "Riwayat Surat Jalan wajib dipilih" };
  const receipt = await prismadb.logisticsReceipt.findUnique({
    where: { id: receiptId },
    select: {
      deliveryNoteNumber: true,
      receivedAt: true,
      pic: { select: { name: true } },
      purchaseOrderItem: {
        select: {
          purchaseOrderId: true,
          status: true,
          purchaseOrder: {
            select: { poNumber: true, userName: true, projectName: true },
          },
        },
      },
    },
  });
  if (!receipt) return { error: "Riwayat Surat Jalan tidak ditemukan" };
  if (receipt.purchaseOrderItem.purchaseOrderId !== input.purchaseOrderId) {
    return { error: "Surat Jalan bukan milik Purchase Order ini" };
  }
  if (receipt.purchaseOrderItem.status !== "CLOSED") {
    return { error: "Surat Jalan dapat dikirim setelah item PO berstatus Closed" };
  }
  const relatedReceipts = await prismadb.logisticsReceipt.findMany({
    where: {
      deliveryNoteNumber: receipt.deliveryNoteNumber,
      purchaseOrderItem: { purchaseOrderId: input.purchaseOrderId },
    },
    select: {
      quantity: true,
      note: true,
      purchaseOrderItem: {
        select: { position: true, partName: true, partNumber: true },
      },
    },
  });
  relatedReceipts.sort(
    (left, right) => left.purchaseOrderItem.position - right.purchaseOrderItem.position,
  );
  const purchaseOrder = receipt.purchaseOrderItem.purchaseOrder;
  const pdf = Buffer.from(await renderMektekDeliveryNotePdf({
    deliveryNoteNumber: receipt.deliveryNoteNumber,
    receivedAt: receipt.receivedAt,
    recipientName: purchaseOrder.userName,
    projectName: purchaseOrder.projectName,
    poNumber: purchaseOrder.poNumber,
    picName: receipt.pic.name,
    items: relatedReceipts.map((item) => ({
      description: item.purchaseOrderItem.partName,
      partNumber: item.purchaseOrderItem.partNumber,
      quantity: item.quantity,
      note: item.note,
    })),
  }));
  const result = await sendWhatsAppMessage({
    to: phone,
    message: `Delivery Order / Surat Jalan ${receipt.deliveryNoteNumber} terlampir.`,
    media: [{
      mimeType: "application/pdf",
      filename: `delivery-order-${receipt.deliveryNoteNumber.replace(/[^A-Za-z0-9_-]+/g, "-")}.pdf`,
      data: pdf,
      caption: `Delivery Order ${receipt.deliveryNoteNumber}`,
    }],
  });
  return result.ok ? { data: { sent: true } } : { error: result.error || "Gagal mengirim DO" };
}
