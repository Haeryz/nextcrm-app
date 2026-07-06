import type { NextRequest } from "next/server";
import { prismadb } from "@/lib/prisma";
import {
  interpretTransactionStatus,
  verifyNotificationSignature,
} from "@/lib/midtrans";
import { getTransactionStatus } from "@/lib/midtrans";
import {
  applyMidtransPaymentResult,
  syncPaidMektekPaymentToOrder,
} from "@/lib/mektek/payment-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

  // Idempotency: already finalized as paid. Re-sync the order in case a
  // previous webhook attempt updated the payment row but failed to update tags.
  if (payment.paidAt) {
    await syncPaidMektekPaymentToOrder(payment, payment.paymentType);
    return Response.json({ ok: true, note: "Already settled" });
  }

  // 2. Re-fetch authoritative status (do not trust the POST body for the verdict).
  //    If the re-fetch fails we must NOT fall back to the POST body to finalize the
  //    payment — a transient Midtrans outage would otherwise settle a payment on
  //    unverified amounts. Leave the payment pending (no mutation) and return 200 so
  //    Midtrans retries the notification later, when the status lookup can succeed.
  const statusResult = await getTransactionStatus(orderId);
  if (!statusResult.ok) {
    console.log(
      "[MIDTRANS_WEBHOOK] status re-fetch failed, leaving payment pending for retry",
      orderId,
      statusResult.error
    );
    return Response.json({ ok: true, note: "Status re-fetch failed; left pending" });
  }

  const authoritative = statusResult.data;
  const verdict = interpretTransactionStatus(authoritative);

  try {
    await applyMidtransPaymentResult({ payment, authoritative, verdict });
  } catch (error) {
    console.log("[MIDTRANS_WEBHOOK] failed to sync payment result", error);
    // Still acknowledge — the MektekPayment row is the source of truth and can be reconciled.
  }

  return Response.json({ ok: true, status: verdict });
}
