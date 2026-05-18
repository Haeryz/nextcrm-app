import { buildMektekPublicSnapshot } from "@/lib/mektek/public-status";

describe("buildMektekPublicSnapshot", () => {
  it("exposes split totals and timeline state for the public tracking page", () => {
    const snapshot = buildMektekPublicSnapshot({
      id: "12345678-aaaa-bbbb-cccc-123456789012",
      content: "Tune up",
      taskStatus: "ACTIVE",
      createdAt: new Date("2026-05-17T10:00:00.000Z"),
      updatedAt: new Date("2026-05-17T11:00:00.000Z"),
      tags: {
        customerName: "Alya",
        vehicle: "Avanza",
        serviceItems: [
          {
            name: "Tune up",
            quantity: 1,
            unitPrice: 100000,
            total: 100000,
          },
        ],
        sparepartItems: [
          {
            name: "Oil filter",
            quantity: 1,
            unitPrice: 50000,
            total: 50000,
          },
        ],
        timeline: [
          {
            id: "t1",
            description: "Received",
            createdAt: "2026-05-17T10:00:00.000Z",
            completed: true,
          },
          {
            id: "t2",
            description: "In progress",
            createdAt: "2026-05-17T11:00:00.000Z",
            completed: false,
          },
        ],
        payment: {
          method: "cash",
          amountPaid: 0,
          status: "unpaid",
        },
      },
    });

    expect(snapshot.customerName).toBe("Alya");
    expect(snapshot.itemSummary).toEqual({
      serviceSubtotal: 100000,
      sparepartSubtotal: 50000,
      serviceCount: 1,
      sparepartCount: 1,
    });
    expect(snapshot.progress).toBe(50);
    expect(snapshot.latestTimeline?.description).toBe("In progress");
    expect(snapshot.invoice.subtotal).toBe(150000);
  });
});
