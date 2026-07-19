import {
  canEditMektekOrderItems,
  canFinalizeMektekOrder,
  canTransitionMektekOrderStatus,
  isMektekInvoiceAvailable,
  isMektekPaymentAvailable,
  isMektekReceiptAvailable,
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

  it("unlocks a service invoice only after service completion", () => {
    expect(
      isMektekInvoiceAvailable({
        taskStatus: "ACTIVE",
        tags: serviceTags,
        paymentStatus: "unpaid",
      }),
    ).toBe(false);
    expect(
      isMektekInvoiceAvailable({
        taskStatus: "AWAITING_PAYMENT",
        tags: serviceTags,
        paymentStatus: "unpaid",
      }),
    ).toBe(true);
    expect(
      isMektekInvoiceAvailable({
        taskStatus: "COMPLETE",
        tags: serviceTags,
        paymentStatus: "paid",
      }),
    ).toBe(true);
    expect(
      isMektekInvoiceAvailable({
        taskStatus: "ACTIVE",
        tags: serviceTags,
        paymentStatus: "paid",
      }),
    ).toBe(true);
  });

  it("keeps storefront invoices available before payment", () => {
    expect(
      isMektekInvoiceAvailable({
        taskStatus: "ACTIVE",
        tags: storefrontTags,
        paymentStatus: "unpaid",
      }),
    ).toBe(true);
  });

  it("unlocks struk only after payment for every customer type", () => {
    expect(
      isMektekReceiptAvailable({
        tags: { customerType: "STANDARD" },
        paymentStatus: "partial",
      }),
    ).toBe(false);
    expect(
      isMektekReceiptAvailable({
        tags: { customerType: "B2B" },
        paymentStatus: "unpaid",
      }),
    ).toBe(false);
    expect(
      isMektekReceiptAvailable({
        tags: { customerType: "STANDARD" },
        paymentStatus: "paid",
      }),
    ).toBe(true);
    expect(
      isMektekReceiptAvailable({
        tags: { customerType: "B2B" },
        paymentStatus: "paid",
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
