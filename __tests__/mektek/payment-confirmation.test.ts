import { confirmPaymentWithRetry } from "@/lib/mektek/payment-confirmation";

describe("confirmPaymentWithRetry", () => {
  it("retries a pending Midtrans status and stops when the payment is paid", async () => {
    const sync = jest
      .fn()
      .mockResolvedValueOnce({ data: { status: "pending" } })
      .mockResolvedValueOnce({ data: { status: "paid" } });
    const sleep = jest.fn().mockResolvedValue(undefined);

    const result = await confirmPaymentWithRetry(sync, {
      attempts: 4,
      delayMs: 250,
      sleep,
    });

    expect(result).toEqual({ data: { status: "paid" } });
    expect(sync).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(1);
    expect(sleep).toHaveBeenCalledWith(250);
  });

  it("does not delay or retry when the first status is already paid", async () => {
    const sync = jest.fn().mockResolvedValue({ data: { status: "paid" } });
    const sleep = jest.fn().mockResolvedValue(undefined);

    const result = await confirmPaymentWithRetry(sync, { sleep });

    expect(result).toEqual({ data: { status: "paid" } });
    expect(sync).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("returns the last non-paid result after the retry budget is exhausted", async () => {
    const sync = jest.fn().mockResolvedValue({ data: { status: "pending" } });
    const sleep = jest.fn().mockResolvedValue(undefined);

    const result = await confirmPaymentWithRetry(sync, {
      attempts: 3,
      delayMs: 100,
      sleep,
    });

    expect(result).toEqual({ data: { status: "pending" } });
    expect(sync).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenNthCalledWith(1, 100);
    expect(sleep).toHaveBeenNthCalledWith(2, 200);
  });
});
