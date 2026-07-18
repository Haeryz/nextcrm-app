import {
  canEditMektekOrderItems,
  canFinalizeMektekOrder,
  canTransitionMektekOrderStatus,
  isMektekPaymentAvailable,
} from "@/lib/mektek/order-lifecycle";

describe("MekTek order lifecycle", () => {
  const serviceTags = { serviceType: "Vehicle Service" };
  const storefrontTags = {
    serviceType: "Sparepart Purchase",
    orderSource: "customer_storefront",
  };

  it("keeps service payments locked until service is finished", () => {
    expect(
      isMektekPaymentAvailable({
        taskStatus: "ACTIVE",
        tags: serviceTags,
        balanceDue: 250_000,
      }),
    ).toBe(false);
    expect(
      isMektekPaymentAvailable({
        taskStatus: "AWAITING_PAYMENT",
        tags: serviceTags,
        balanceDue: 250_000,
      }),
    ).toBe(true);
  });

  it("preserves immediate payment for direct storefront purchases", () => {
    expect(
      isMektekPaymentAvailable({
        taskStatus: "ACTIVE",
        tags: storefrontTags,
        balanceDue: 250_000,
      }),
    ).toBe(true);
  });

  it("never offers payment when there is no balance", () => {
    expect(
      isMektekPaymentAvailable({
        taskStatus: "AWAITING_PAYMENT",
        tags: serviceTags,
        balanceDue: 0,
      }),
    ).toBe(false);
  });

  it("allows final closure only after the awaiting-payment stage is fully paid", () => {
    expect(
      canFinalizeMektekOrder({
        taskStatus: "AWAITING_PAYMENT",
        tags: serviceTags,
        balanceDue: 1,
      }),
    ).toBe(false);
    expect(
      canFinalizeMektekOrder({
        taskStatus: "AWAITING_PAYMENT",
        tags: serviceTags,
        balanceDue: 0,
      }),
    ).toBe(true);
    expect(
      canFinalizeMektekOrder({
        taskStatus: "ACTIVE",
        tags: serviceTags,
        balanceDue: 0,
      }),
    ).toBe(false);
  });

  it("locks line-item changes once the invoice enters payment review", () => {
    expect(canEditMektekOrderItems("ACTIVE")).toBe(true);
    expect(canEditMektekOrderItems("PENDING")).toBe(true);
    expect(canEditMektekOrderItems("AWAITING_PAYMENT")).toBe(false);
    expect(canEditMektekOrderItems("COMPLETE")).toBe(false);
  });

  it("treats the closed state as final", () => {
    expect(canTransitionMektekOrderStatus("COMPLETE", "ACTIVE")).toBe(false);
    expect(canTransitionMektekOrderStatus("COMPLETE", "AWAITING_PAYMENT")).toBe(false);
    expect(canTransitionMektekOrderStatus("COMPLETE", "COMPLETE")).toBe(true);
    expect(canTransitionMektekOrderStatus("AWAITING_PAYMENT", "ACTIVE")).toBe(true);
  });
});
