import type { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { prismadb } from "@/lib/prisma";
import { buildMektekFinancialSummary } from "@/lib/mektek/financials";
import {
  interpretTransactionStatus,
  verifyNotificationSignature,
} from "@/lib/midtrans";
import { getTransactionStatus } from "@/lib/midtrans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const parseTags = (tags: unknown): Record<string, unknown> => {
  if (!tags || typeof tags !== "object" || Array.isArray(tags)) return {};
  return tags as Record<string, unknown>;
};

const parseMoney = (value: unknown): number => {
  if (typeof value === "number") return Math.round(value);
  if (typeof value === "string") {
    const n = Number(value.replace(/[^\d.-]/g, ""));
    return Number.isFinite(n) ? Math.round(n) : 0;
  }
  return 0;
};

/**
 * Midtrans HTTP notification (webhook) receiver.
 * Security: verify the SHA512 signature, then re-fetch the authoritative status
 * server-to-server before trusting any state change. Never mutate on a bad signature.
 */
export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const orderId = String(body.order_id ?? "");
  const statusCode = String(body.status_code ?? "");
  const grossAmount = String(body.gross_amount ?? "");
  const signatureKey = String(body.signature_key ?? "");

  if (!orderId) {
    return Response.json({ ok: false, error: "Missing order_id" }, { status: 400 });
  }

  // 1. Signature verification — reject silently (200) if invalid to avoid probing,
  //    but make NO state change.
  const signatureOk = verifyNotificationSignature({
    orderId,
    statusCode,
    grossAmount,
    signatureKey,
  });
  if (!signatureOk) {
    console.log("[MIDTRANS_WEBHOOK] invalid signature for", orderId);
    return Response.json({ ok: false, error: "Invalid signature" }, { status: 403 });
  }

  const payment = await prismadb.mektekPayment.findUnique({
    where: { midtransOrderId: orderId },
  });
  if (!payment) {
    // Unknown order — acknowledge so Midtrans stops retrying.
    return Response.json({ ok: true, note: "Unknown order" });
  }

  // Idempotency: already finalized as paid — acknowledge and stop.
  if (payment.paidAt) {
    return Response.json({ ok: true, note: "Already settled" });
  }

  // 2. Re-fetch authoritative status (do not trust the POST body for the verdict).
  const statusResult = await getTransactionStatus(orderId);
  const authoritative = statusResult.ok ? statusResult.data : body;
  const verdict = interpretTransactionStatus(authoritative);

  const transactionStatus = String(
    (authoritative as Record<string, unknown>).transaction_status ?? ""
  );
  const fraudStatus = (authoritative as Record<string, unknown>).fraud_status
    ? String((authoritative as Record<string, unknown>).fraud_status)
    : null;
  const paymentType = (authoritative as Record<string, unknown>).payment_type
    ? String((authoritative as Record<string, unknown>).payment_type)
    : null;

  await prismadb.mektekPayment.update({
    where: { id: payment.id },
    data: {
      transactionStatus: transactionStatus || payment.transactionStatus,
      fraudStatus,
      paymentType,
      rawPayload: authoritative as object,
      paidAt: verdict === "paid" ? new Date() : null,
    },
  });

  // 3. On confirmed payment, reflect it into the service order tags so the
  //    existing invoice / financial summary stays consistent.
  if (verdict === "paid") {
    try {
      const order = await prismadb.crm_Accounts_Tasks.findUnique({
        where: { id: payment.serviceOrderId },
        select: { id: true, tags: true, content: true },
      });

      if (order) {
        const tags = parseTags(order.tags);
        const summary = buildMektekFinancialSummary(order.tags, order.content);
        const grandTotal = summary.grandTotal;
        const prevPaid = parseMoney(
          (tags.payment as Record<string, unknown> | undefined)?.amountPaid
        );
        const newAmountPaid = Math.min(prevPaid + payment.grossAmount, grandTotal);
        const status =
          grandTotal > 0 && newAmountPaid >= grandTotal
            ? "paid"
            : newAmountPaid > 0
            ? "partial"
            : "unpaid";

        await prismadb.crm_Accounts_Tasks.update({
          where: { id: order.id },
          data: {
            tags: {
              ...tags,
              payment: {
                method: paymentType || "midtrans",
                amountPaid: newAmountPaid,
                status,
                updatedAt: new Date().toISOString(),
                midtransOrderId: orderId,
              },
            },
          },
        });

        revalidatePath("/[locale]/(routes)/mektek", "page");
        revalidatePath("/[locale]/(routes)/mektek/[id]", "page");
        revalidatePath("/[locale]/service-status/[id]", "page");
        revalidatePath("/[locale]/s/[code]", "page");
      }
    } catch (error) {
      console.log("[MIDTRANS_WEBHOOK] failed to sync order tags", error);
      // Still acknowledge — the MektekPayment row is the source of truth and can be reconciled.
    }
  }

  return Response.json({ ok: true, status: verdict });
}
