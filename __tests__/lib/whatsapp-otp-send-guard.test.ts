jest.mock("server-only", () => ({}), { virtual: true });

import { reserveWhatsAppOtpSend } from "@/lib/whatsapp/otp-send-guard";
import { prismadb } from "@/lib/prisma";

jest.mock("@/lib/prisma", () => ({
  prismadb: {
    authRateLimit: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      updateMany: jest.fn(),
    },
  },
}));

const buckets = prismadb.authRateLimit as unknown as {
  findUnique: jest.Mock;
  upsert: jest.Mock;
  updateMany: jest.Mock;
};

describe("WhatsApp OTP sender-wide guard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.WHATSAPP_OTP_MIN_INTERVAL_MS;
    delete process.env.WHATSAPP_OTP_HOURLY_LIMIT;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("atomically reserves both spacing and hourly capacity", async () => {
    const freshBucket = {
      attempts: 0,
      windowStartedAt: new Date(),
      blockedUntil: null,
    };
    buckets.findUnique.mockResolvedValue(null);
    buckets.upsert.mockResolvedValue(freshBucket);
    buckets.updateMany.mockResolvedValue({ count: 1 });

    await expect(reserveWhatsAppOtpSend()).resolves.toEqual({
      ok: true,
      retryAfterMs: 0,
    });
    expect(buckets.updateMany).toHaveBeenCalledTimes(2);
  });

  it("rejects a second send during the minimum spacing window", async () => {
    const now = new Date();
    buckets.findUnique.mockResolvedValue({
      attempts: 1,
      windowStartedAt: now,
      blockedUntil: null,
    });
    buckets.updateMany.mockResolvedValue({ count: 1 });

    const result = await reserveWhatsAppOtpSend();

    expect(result.ok).toBe(false);
    expect(result.retryAfterMs).toBeGreaterThan(0);
    expect(buckets.updateMany).toHaveBeenCalledTimes(1);
  });

  it("retries a lost compare-and-swap race and then rejects the burst", async () => {
    const now = new Date();
    buckets.findUnique
      .mockResolvedValueOnce({
        attempts: 0,
        windowStartedAt: now,
        blockedUntil: null,
      })
      .mockResolvedValueOnce({
        attempts: 1,
        windowStartedAt: now,
        blockedUntil: null,
      });
    buckets.updateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 1 });

    await expect(reserveWhatsAppOtpSend()).resolves.toEqual(
      expect.objectContaining({ ok: false }),
    );
    expect(buckets.findUnique).toHaveBeenCalledTimes(2);
  });

  it("enforces the sustained hourly ceiling after spacing succeeds", async () => {
    const now = new Date();
    buckets.findUnique
      .mockResolvedValueOnce({
        attempts: 0,
        windowStartedAt: now,
        blockedUntil: null,
      })
      .mockResolvedValueOnce({
        attempts: 30,
        windowStartedAt: now,
        blockedUntil: null,
      });
    buckets.updateMany.mockResolvedValue({ count: 1 });

    await expect(reserveWhatsAppOtpSend()).resolves.toEqual(
      expect.objectContaining({ ok: false }),
    );
    expect(buckets.updateMany).toHaveBeenCalledTimes(2);
  });

  it("fails closed when shared database protection is unavailable", async () => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    buckets.findUnique.mockRejectedValue(new Error("database unavailable"));

    await expect(reserveWhatsAppOtpSend()).resolves.toEqual({
      ok: false,
      retryAfterMs: 60_000,
    });
  });
});
