import { buildMektekDashboardAnalytics } from "@/lib/mektek/dashboard-analytics";

const paidOrder = ({
  id,
  customerId,
  customerName,
  createdAt,
  taskStatus = "COMPLETE",
  serviceItems = [],
  sparepartItems = [],
}: {
  id: string;
  customerId: string;
  customerName: string;
  createdAt: string;
  taskStatus?: string;
  serviceItems?: Array<Record<string, unknown>>;
  sparepartItems?: Array<Record<string, unknown>>;
}) => ({
  id,
  createdAt: new Date(createdAt),
  taskStatus,
  content: null,
  mektekPayments: [],
  tags: {
    catalogCustomerId: customerId,
    customerName,
    serviceItems,
    sparepartItems,
    payment: { method: "cash", amountPaid: 0, status: "paid" },
  },
});

describe("buildMektekDashboardAnalytics", () => {
  it("ranks the most loyal customer and best-selling products by real order data", () => {
    const result = buildMektekDashboardAnalytics(
      [
        paidOrder({
          id: "order-1",
          customerId: "customer-ayu",
          customerName: "Ayu",
          createdAt: "2026-06-10T08:00:00.000Z",
          serviceItems: [
            { name: "Tune up", quantity: 1, unitPrice: 150_000, total: 150_000 },
          ],
          sparepartItems: [
            { name: "Oil Filter", quantity: 2, unitPrice: 100_000, total: 200_000 },
          ],
        }),
        paidOrder({
          id: "order-2",
          customerId: "customer-ayu",
          customerName: "Ayu",
          createdAt: "2026-07-02T08:00:00.000Z",
          sparepartItems: [
            { name: "Brake Pad", quantity: 1, unitPrice: 250_000, total: 250_000 },
          ],
        }),
        paidOrder({
          id: "order-3",
          customerId: "customer-bima",
          customerName: "Bima",
          createdAt: "2026-07-05T08:00:00.000Z",
          taskStatus: "ACTIVE",
          sparepartItems: [
            { name: "Oil Filter", quantity: 3, unitPrice: 100_000, total: 300_000 },
          ],
        }),
      ],
      new Date("2026-07-20T12:00:00.000Z"),
    );

    expect(result.loyalCustomers[0]).toMatchObject({
      name: "Ayu",
      orderCount: 2,
      completedOrders: 2,
    });
    expect(result.topProducts[0]).toMatchObject({
      name: "Oil Filter",
      quantity: 5,
      revenue: 500_000,
    });
    expect(result.topServices[0]).toMatchObject({
      name: "Tune up",
      quantity: 1,
      revenue: 150_000,
    });
    expect(result.kpis).toMatchObject({
      customerCount: 2,
      itemQuantity: 7,
      orderCount: 3,
    });
  });

  it("builds a gap-free six-month trend and status distribution", () => {
    const result = buildMektekDashboardAnalytics(
      [
        paidOrder({
          id: "order-1",
          customerId: "customer-1",
          customerName: "Customer 1",
          createdAt: "2026-02-10T08:00:00.000Z",
          sparepartItems: [
            { name: "Battery", quantity: 1, unitPrice: 800_000, total: 800_000 },
          ],
        }),
        paidOrder({
          id: "order-2",
          customerId: "customer-2",
          customerName: "Customer 2",
          createdAt: "2026-07-10T08:00:00.000Z",
          taskStatus: "AWAITING_PAYMENT",
          sparepartItems: [
            { name: "Tyre", quantity: 1, unitPrice: 600_000, total: 600_000 },
          ],
        }),
      ],
      new Date("2026-07-20T12:00:00.000Z"),
    );

    expect(result.orderValueTrend.map((point) => point.key)).toEqual([
      "2026-02",
      "2026-03",
      "2026-04",
      "2026-05",
      "2026-06",
      "2026-07",
    ]);
    expect(result.orderValueTrend.map((point) => point.orderCount)).toEqual([
      1, 0, 0, 0, 0, 1,
    ]);
    expect(result.statusDistribution).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "COMPLETE", count: 1 }),
        expect.objectContaining({ key: "AWAITING_PAYMENT", count: 1 }),
      ]),
    );
  });

  it("keeps unidentified customers as separate loyalty records", () => {
    const result = buildMektekDashboardAnalytics(
      [
        { id: "anonymous-1", taskStatus: "ACTIVE", tags: {} },
        { id: "anonymous-2", taskStatus: "ACTIVE", tags: {} },
      ],
      new Date("2026-07-20T12:00:00.000Z"),
    );

    expect(result.kpis.customerCount).toBe(2);
    expect(result.loyalCustomers.map((customer) => customer.key)).toEqual(
      expect.arrayContaining(["order:anonymous-1", "order:anonymous-2"]),
    );
  });
});
