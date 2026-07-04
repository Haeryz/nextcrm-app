"use server";

import { prismadb } from "@/lib/prisma";
import { buildMektekFinancialSummary } from "@/lib/mektek/financials";
import { createSnapTransaction, getSnapScriptUrl } from "@/lib/midtrans";
import {
  getPublicMektekServiceOrder,
  getPublicMektekServiceOrderByCode,
} from "@/actions/mektek/service-orders";

type CreateIntentInput = {
  serviceOrderId?: string;
  token?: string;
  code?: string;
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
    const summary = buildMektekFinancialSummary(order.tags, order.content);
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
