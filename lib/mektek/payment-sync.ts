import { revalidatePath } from "next/cache";

import { buildMektekFinancialSummary } from "@/lib/mektek/financials";
import { syncPaidMektekPaymentToFinance } from "@/lib/mektek/finance-sync";
import { prismadb } from "@/lib/prisma";
import type { MidtransStatusVerdict } from "@/lib/midtrans";

type JsonRecord = Record<string, unknown>;

export type MektekPaymentSyncRow = {
  id: string;
  serviceOrderId: string;
  midtransOrderId: string;
  grossAmount: number;
  transactionStatus: string;
  paidAt?: Date | null;
};

const mektekPaymentSelect = {
  id: true,
  midtransOrderId: true,
  grossAmount: true,
  paymentType: true,
  transactionStatus: true,
  fraudStatus: true,
  paidAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

const parseTags = (tags: unknown): JsonRecord => {
  if (!tags || typeof tags !== "object" || Array.isArray(tags)) return {};
  return tags as JsonRecord;
};

const parsePaymentTags = (tags: JsonRecord): JsonRecord => {
  const payment = tags.payment;
  if (!payment || typeof payment !== "object" || Array.isArray(payment)) return {};
  return payment as JsonRecord;
};

export function extractMidtransPaymentMetadata(authoritative: Record<string, unknown>) {
  const transactionStatus = String(authoritative.transaction_status ?? "");
  const fraudStatus = authoritative.fraud_status
    ? String(authoritative.fraud_status)
    : null;
  const paymentType = authoritative.payment_type
    ? String(authoritative.payment_type)
    : null;

  return { transactionStatus, fraudStatus, paymentType };
}

export function revalidateMektekPaymentViews() {
  revalidatePath("/[locale]/(routes)/mektek", "page");
  revalidatePath("/[locale]/(routes)/mektek/[id]", "page");
  revalidatePath("/[locale]/service-status/[id]", "page");
  revalidatePath("/[locale]/s/[code]", "page");
  revalidatePath("/[locale]/customer/profile", "page");
}

export async function syncPaidMektekPaymentToOrder(
  payment: MektekPaymentSyncRow,
  paymentType?: string | null
) {
  const order = await prismadb.crm_Accounts_Tasks.findUnique({
    where: { id: payment.serviceOrderId },
    select: {
      id: true,
      tags: true,
      content: true,
      mektekPayments: {
        orderBy: {
          createdAt: "desc",
        },
        select: mektekPaymentSelect,
      },
    },
  });

  if (!order) return null;

  const tags = parseTags(order.tags);
  const existingPayment = parsePaymentTags(tags);
  const summary = buildMektekFinancialSummary(
    tags,
    order.content,
    order.mektekPayments
  );
  const method =
    paymentType ||
    summary.payment.method ||
    (typeof existingPayment.method === "string" ? existingPayment.method : "") ||
    "midtrans";

  await prismadb.crm_Accounts_Tasks.update({
    where: { id: order.id },
    data: {
      tags: {
        ...tags,
        payment: {
          ...existingPayment,
          method,
          amountPaid: summary.amountPaid,
          status: summary.payment.status,
          provider: "midtrans",
          midtransOrderId: payment.midtransOrderId,
          updatedAt: new Date().toISOString(),
        },
      },
    },
  });

  revalidateMektekPaymentViews();

  return {
    grandTotal: summary.grandTotal,
    amountPaid: summary.amountPaid,
    balanceDue: summary.balanceDue,
    status: summary.payment.status,
  };
}

export async function applyMidtransPaymentResult(params: {
  payment: MektekPaymentSyncRow;
  authoritative: Record<string, unknown>;
  verdict: MidtransStatusVerdict;
}) {
  const { payment, authoritative, verdict } = params;
  const { transactionStatus, fraudStatus, paymentType } =
    extractMidtransPaymentMetadata(authoritative);

  const updatedPayment = await prismadb.mektekPayment.update({
    where: { id: payment.id },
    data: {
      transactionStatus: transactionStatus || payment.transactionStatus,
      fraudStatus,
      paymentType,
      rawPayload: authoritative as object,
      paidAt: verdict === "paid" ? new Date() : null,
    },
  });

  const summary =
    verdict === "paid"
      ? await syncPaidMektekPaymentToOrder(updatedPayment, paymentType)
      : null;

  if (verdict === "paid") {
    await prismadb.$transaction((tx) =>
      syncPaidMektekPaymentToFinance(tx, updatedPayment.id),
    );
  }

  if (verdict !== "paid") {
    revalidateMektekPaymentViews();
  }

  return {
    payment: updatedPayment,
    summary,
    transactionStatus: transactionStatus || payment.transactionStatus,
    fraudStatus,
    paymentType,
  };
}
