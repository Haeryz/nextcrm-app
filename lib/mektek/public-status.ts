import {
  buildMektekFinancialSummary,
  type MektekPaymentRecord,
} from "@/lib/mektek/financials";
import {
  isMektekInvoiceAvailable,
  isMektekPaymentAvailable,
  isMektekReceiptAvailable,
} from "@/lib/mektek/order-lifecycle";

type PublicTimelineEntry = {
  id: string;
  description: string;
  createdAt: string;
};

type PublicOrder = {
  id: string;
  serviceNumber?: string | null;
  content?: string | null;
  dueDateAt?: Date | null;
  taskStatus?: string | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
  tags?: unknown;
  mektekPayments?: MektekPaymentRecord[];
};

const parseTags = (tags: unknown): Record<string, unknown> => {
  if (!tags || typeof tags !== "object" || Array.isArray(tags)) return {};
  return tags as Record<string, unknown>;
};

const buildTimeline = (tags: Record<string, unknown>): PublicTimelineEntry[] =>
  Array.isArray(tags.timeline)
    ? tags.timeline
        .map((item) => {
          if (!item || typeof item !== "object" || Array.isArray(item)) return null;
          const row = item as Record<string, unknown>;
          const description =
            typeof row.description === "string" ? row.description.trim() : "";
          const createdAt =
            typeof row.createdAt === "string" ? row.createdAt : new Date().toISOString();
          const id =
            typeof row.id === "string" ? row.id : `${createdAt}-${description}`;
          if (!description) return null;
          return { id, description, createdAt };
        })
        .filter((item): item is PublicTimelineEntry => !!item)
        .sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
    : [];

export type MektekPublicSnapshot = ReturnType<typeof buildMektekPublicSnapshot>;

export function buildMektekPublicSnapshot(order: PublicOrder) {
  const tags = parseTags(order.tags);
  const financialSummary = buildMektekFinancialSummary(
    tags,
    order.content,
    order.mektekPayments
  );
  const normalizedItems = financialSummary.normalizedItems;
  const timeline = buildTimeline(tags);
  const latestTimeline = timeline[0] ?? null;

  return {
    id: order.id,
    serviceNumber: order.serviceNumber ?? order.id.slice(0, 8),
    customerName:
      typeof tags.customerName === "string" && tags.customerName.trim()
        ? tags.customerName
        : "Customer",
    vehicle:
      typeof tags.vehicle === "string" && tags.vehicle.trim()
        ? tags.vehicle
        : "Kendaraan tidak diketahui",
    vehicleMileageKm:
      typeof tags.vehicleMileageKm === "number" ? tags.vehicleMileageKm : null,
    dueDateAt: order.dueDateAt?.toISOString() ?? null,
    taskStatus: order.taskStatus ?? "ACTIVE",
    updatedAt: order.updatedAt?.toISOString() ?? null,
    content: order.content ?? "",
    timeline,
    latestTimeline,
    itemSummary: {
      serviceSubtotal: normalizedItems.serviceSubtotal,
      sparepartSubtotal: normalizedItems.sparepartSubtotal,
      serviceCount: normalizedItems.serviceItems.length,
      sparepartCount: normalizedItems.sparepartItems.length,
    },
    items: {
      serviceItems: normalizedItems.serviceItems,
      sparepartItems: normalizedItems.sparepartItems,
    },
    invoice: {
      subtotal: financialSummary.subtotal,
      serviceSubtotal: financialSummary.serviceSubtotal,
      sparepartSubtotal: financialSummary.sparepartSubtotal,
      grandTotal: financialSummary.grandTotal,
      amountPaid: financialSummary.amountPaid,
      balanceDue: financialSummary.balanceDue,
      paymentStatus: financialSummary.payment.status,
      providerAmountPaid: financialSummary.payment.providerAmountPaid,
    },
    invoiceAvailable: isMektekInvoiceAvailable({
      taskStatus: order.taskStatus,
      tags,
      paymentStatus: financialSummary.payment.status,
    }),
    receiptAvailable: isMektekReceiptAvailable({
      taskStatus: order.taskStatus,
      tags,
      paymentStatus: financialSummary.payment.status,
    }),
    paymentAvailable: isMektekPaymentAvailable({
      taskStatus: order.taskStatus,
      tags,
      balanceDue: financialSummary.balanceDue,
    }),
  };
}
