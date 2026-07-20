import {
  buildMektekFinancialSummary,
  type MektekPaymentRecord,
} from "@/lib/mektek/financials";
import type { MektekLineItem } from "@/lib/mektek/items";

type DashboardOrder = {
  id: string;
  createdAt?: Date | string | null;
  taskStatus?: string | null;
  content?: string | null;
  tags?: unknown;
  mektekPayments?: MektekPaymentRecord[];
};

type RankedItem = {
  key: string;
  catalogItemId: string | null;
  name: string;
  quantity: number;
  revenue: number;
};

type LoyalCustomer = {
  key: string;
  name: string;
  orderCount: number;
  completedOrders: number;
  amountSpent: number;
};

const DASHBOARD_STATUSES = [
  { key: "ACTIVE", label: "Sedang dikerjakan" },
  { key: "PENDING", label: "Menunggu" },
  { key: "AWAITING_PAYMENT", label: "Menunggu pembayaran" },
  { key: "COMPLETE", label: "Selesai" },
] as const;

const toRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const textValue = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

const monthKey = (date: Date) =>
  `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;

const monthLabel = (date: Date) => {
  const label = new Intl.DateTimeFormat("id-ID", {
    month: "short",
    timeZone: "UTC",
  })
    .format(date)
    .replace(".", "");

  return label.charAt(0).toUpperCase() + label.slice(1);
};

const rankItems = (items: Map<string, RankedItem>) =>
  [...items.values()]
    .sort(
      (left, right) =>
        right.quantity - left.quantity ||
        right.revenue - left.revenue ||
        left.name.localeCompare(right.name, "id-ID"),
    )
    .slice(0, 5);

const addRankedItem = (
  target: Map<string, RankedItem>,
  item: MektekLineItem,
) => {
  const identity =
    item.catalogItemId ||
    item.catalogPartNumber ||
    item.partNumber ||
    item.name.toLocaleLowerCase("id-ID");
  const key = `${item.kind}:${identity}`;
  const current = target.get(key) ?? {
    key,
    catalogItemId: item.catalogItemId || null,
    name: item.name,
    quantity: 0,
    revenue: 0,
  };

  current.quantity += item.quantity;
  current.revenue += item.total;
  target.set(key, current);
};

export function buildMektekDashboardAnalytics(
  orders: DashboardOrder[],
  now = new Date(),
) {
  const monthBuckets = Array.from({ length: 6 }, (_, index) => {
    const offset = 5 - index;
    const date = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1),
    );

    return {
      key: monthKey(date),
      label: monthLabel(date),
      orderCount: 0,
      orderValue: 0,
      collectedRevenue: 0,
    };
  });
  const trendByMonth = new Map(monthBuckets.map((point) => [point.key, point]));
  const statusCounts = new Map<string, number>();
  const products = new Map<string, RankedItem>();
  const services = new Map<string, RankedItem>();
  const customers = new Map<string, LoyalCustomer>();

  let totalOrderValue = 0;
  let collectedRevenue = 0;
  let itemQuantity = 0;

  for (const order of orders) {
    const tags = toRecord(order.tags);
    const financials = buildMektekFinancialSummary(
      order.tags,
      order.content,
      order.mektekPayments,
    );
    const status = order.taskStatus ?? "ACTIVE";
    const createdAt = order.createdAt ? new Date(order.createdAt) : null;

    totalOrderValue += financials.grandTotal;
    collectedRevenue += financials.amountPaid;
    statusCounts.set(status, (statusCounts.get(status) ?? 0) + 1);

    if (createdAt && !Number.isNaN(createdAt.getTime())) {
      const point = trendByMonth.get(monthKey(createdAt));
      if (point) {
        point.orderCount += 1;
        point.orderValue += financials.grandTotal;
        point.collectedRevenue += financials.amountPaid;
      }
    }

    for (const item of financials.normalizedItems.sparepartItems) {
      itemQuantity += item.quantity;
      addRankedItem(products, item);
    }
    for (const item of financials.normalizedItems.serviceItems) {
      itemQuantity += item.quantity;
      addRankedItem(services, item);
    }

    const storedCustomerName = textValue(tags.customerName);
    const customerName = storedCustomerName || "Pelanggan tanpa nama";
    const customerIdentity =
      textValue(tags.catalogCustomerId) ||
      textValue(tags.customerCode) ||
      textValue(tags.phoneNormalized) ||
      textValue(tags.phone) ||
      (storedCustomerName
        ? storedCustomerName.toLocaleLowerCase("id-ID")
        : `order:${order.id}`);
    const customer = customers.get(customerIdentity) ?? {
      key: customerIdentity,
      name: customerName,
      orderCount: 0,
      completedOrders: 0,
      amountSpent: 0,
    };

    customer.orderCount += 1;
    customer.completedOrders += status === "COMPLETE" ? 1 : 0;
    customer.amountSpent += financials.amountPaid;
    customers.set(customerIdentity, customer);
  }

  const loyalCustomers = [...customers.values()]
    .sort(
      (left, right) =>
        right.completedOrders - left.completedOrders ||
        right.orderCount - left.orderCount ||
        right.amountSpent - left.amountSpent ||
        left.name.localeCompare(right.name, "id-ID"),
    )
    .slice(0, 5);

  return {
    kpis: {
      totalOrderValue,
      collectedRevenue,
      averageOrderValue:
        orders.length > 0 ? Math.round(totalOrderValue / orders.length) : 0,
      customerCount: customers.size,
      itemQuantity,
      orderCount: orders.length,
    },
    orderValueTrend: monthBuckets,
    statusDistribution: DASHBOARD_STATUSES.map((status) => ({
      ...status,
      count: statusCounts.get(status.key) ?? 0,
    })),
    topProducts: rankItems(products),
    topServices: rankItems(services),
    loyalCustomers,
  };
}

export type MektekDashboardAnalytics = ReturnType<
  typeof buildMektekDashboardAnalytics
>;
