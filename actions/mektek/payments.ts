"use server";

import { prismadb } from "@/lib/prisma";
import { buildMektekFinancialSummary } from "@/lib/mektek/financials";
import {
  createSnapTransaction,
  getSnapScriptUrl,
  getTransactionStatus,
  interpretTransactionStatus,
} from "@/lib/midtrans";
import {
  applyMidtransPaymentResult,
  syncPaidMektekPaymentToOrder,
} from "@/lib/mektek/payment-sync";
import {
  getPublicMektekServiceOrder,
  getPublicMektekServiceOrderByCode,
} from "@/actions/mektek/service-orders";

type CreateIntentInput = {
  serviceOrderId?: string;
  token?: string;
  code?: string;
};

type SyncPaymentInput = CreateIntentInput & {
  orderId?: string;
};

const parseTags = (tags: unknown): Record<string, unknown> => {
  if (!tags || typeof tags !== "object" || Array.isArray(tags)) return {};
  return tags as Record<string, unknown>;
};

const asString = (value: unknown): string =>
  typeof value === "string" ? value : "";

/** Midtrans order_id must be unique per attempt, alphanumeric-ish, <= 50 chars. */
const buildMidtransOrderId = (serviceOrderId: string): string => {
  const shortId = serviceOrderId.replace(/-/g, "").slice(0, 20);
  const suffix = Date.now().toString(36).toUpperCase();
  return `MEK-${shortId}-${suffix}`.slice(0, 50);
};

/**
 * Create a Midtrans Snap payment intent for a Mektek service order.
 * Authorized by the unguessable customer token or short code (same gate as the
 * public tracking page and the logged-in customer portal, which both hold the token).
 * The amount is always recomputed server-side — the client never supplies it.
 */
export const createMektekPaymentIntent = async (input: CreateIntentInput) => {
  const serviceOrderId = String(input?.serviceOrderId ?? "").trim();
  const token = String(input?.token ?? "").trim();
  const code = String(input?.code ?? "").trim();

  if (!serviceOrderId) return { error: "Service order ID is required" };
  if (!token && !code) return { error: "Missing access token" };

  try {
    // Resolve + authorize the order via token or code.
    let order = token
      ? await getPublicMektekServiceOrder(serviceOrderId, token)
      : await getPublicMektekServiceOrderByCode(code);

    if (order && code && order.id !== serviceOrderId) {
      order = null;
    }
    if (!order) return { error: "Service order not found or access denied" };

    const tags = parseTags(order.tags);
    const summary = buildMektekFinancialSummary(
      order.tags,
      order.content,
      order.mektekPayments
    );
    const grossAmount = summary.balanceDue;

    if (grossAmount <= 0) {
      return { error: "This order has no outstanding balance" };
    }

    const midtransOrderId = buildMidtransOrderId(order.id);

    // Create the pending payment record first so the webhook can reconcile it.
    const payment = await prismadb.mektekPayment.create({
      data: {
        serviceOrderId: order.id,
        midtransOrderId,
        grossAmount,
        transactionStatus: "pending",
      },
      select: { id: true },
    });

    const customerName = asString(tags.customerName).trim();
    const [firstName, ...rest] = customerName ? customerName.split(/\s+/) : [];
    const phone = asString(tags.phoneNormalized) || asString(tags.phone);

    const snap = await createSnapTransaction({
      orderId: midtransOrderId,
      grossAmount,
      customer: customerName
        ? {
            firstName: firstName || customerName,
            lastName: rest.join(" ") || undefined,
            phone: phone || undefined,
          }
        : undefined,
    });

    if (!snap.ok) {
      await prismadb.mektekPayment.update({
        where: { id: payment.id },
        data: { transactionStatus: "failure", rawPayload: { error: snap.error } },
      });
      return { error: `Payment gateway error: ${snap.error}` };
    }

    await prismadb.mektekPayment.update({
      where: { id: payment.id },
      data: { snapToken: snap.token, redirectUrl: snap.redirectUrl },
    });

    return {
      data: {
        snapToken: snap.token,
        redirectUrl: snap.redirectUrl,
        clientKey: snap.clientKey,
        snapScriptUrl: getSnapScriptUrl(),
        orderId: midtransOrderId,
        grossAmount,
      },
    };
  } catch (error) {
    console.log("[CREATE_MEKTEK_PAYMENT_INTENT]", error);
    return { error: "Failed to start payment" };
  }
};

export const syncMektekPaymentStatus = async (input: SyncPaymentInput) => {
  const serviceOrderId = String(input?.serviceOrderId ?? "").trim();
  const token = String(input?.token ?? "").trim();
  const code = String(input?.code ?? "").trim();
  const orderId = String(input?.orderId ?? "").trim();

  if (!serviceOrderId) return { error: "Service order ID is required" };
  if (!orderId) return { error: "Payment order ID is required" };
  if (!token && !code) return { error: "Missing access token" };

  try {
    let order = token
      ? await getPublicMektekServiceOrder(serviceOrderId, token)
      : await getPublicMektekServiceOrderByCode(code);

    if (order && code && order.id !== serviceOrderId) {
      order = null;
    }
    if (!order) return { error: "Service order not found or access denied" };

    const payment = await prismadb.mektekPayment.findUnique({
      where: { midtransOrderId: orderId },
    });

    if (!payment || payment.serviceOrderId !== order.id) {
      return { error: "Payment record not found" };
    }

    if (payment.paidAt) {
      const summary = await syncPaidMektekPaymentToOrder(payment, payment.paymentType);
      return {
        data: {
          status: "paid" as const,
          transactionStatus: payment.transactionStatus,
          paymentType: payment.paymentType,
          summary,
        },
      };
    }

    const statusResult = await getTransactionStatus(orderId);
    if (!statusResult.ok) {
      return { error: `Unable to confirm payment: ${statusResult.error}` };
    }

    const verdict = interpretTransactionStatus(statusResult.data);
    const result = await applyMidtransPaymentResult({
      payment,
      authoritative: statusResult.data,
      verdict,
    });

    return {
      data: {
        status: verdict,
        transactionStatus: result.transactionStatus,
        paymentType: result.paymentType,
        summary: result.summary,
      },
    };
  } catch (error) {
    console.log("[SYNC_MEKTEK_PAYMENT_STATUS]", error);
    return { error: "Failed to confirm payment" };
  }
};
