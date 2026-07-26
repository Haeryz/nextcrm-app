jest.mock("server-only", () => ({}), { virtual: true });

import {
  assertWhatsAppSendAllowed,
  getWhatsAppPromoDailyCap,
  startOfWibDay,
  WHATSAPP_PROMO_DAILY_CAP_DEFAULT,
} from "@/lib/mektek/whatsapp-send-policy";
import { prismadb } from "@/lib/prisma";

jest.mock("@/lib/prisma", () => ({
  prismadb: {
    catalogCustomer: { findUnique: jest.fn() },
    whatsAppMessageLog: { count: jest.fn() },
  },
}));

const findCustomer = prismadb.catalogCustomer.findUnique as unknown as jest.Mock;
const countLogs = prismadb.whatsAppMessageLog.count as unknown as jest.Mock;

const PHONE = "+6281234567890";

beforeEach(() => {
  jest.clearAllMocks();
  delete process.env.WHATSAPP_PROMO_DAILY_CAP;
  findCustomer.mockResolvedValue({ whatsappOptedOutAt: null });
  countLogs.mockResolvedValue(0);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("assertWhatsAppSendAllowed — transactional", () => {
  it("allows a transactional message without touching the database", async () => {
    await expect(
      assertWhatsAppSendAllowed({
        phoneNormalized: PHONE,
        purpose: "otp",
        category: "transactional",
      }),
    ).resolves.toEqual({ allowed: true });

    expect(findCustomer).not.toHaveBeenCalled();
    expect(countLogs).not.toHaveBeenCalled();
  });

  // The whole point of the category split: unsubscribing from marketing must not
  // silently break someone's order notifications or their login OTP.
  it("still allows a transactional message to an opted-out customer", async () => {
    findCustomer.mockResolvedValue({ whatsappOptedOutAt: new Date() });

    await expect(
      assertWhatsAppSendAllowed({
        phoneNormalized: PHONE,
        purpose: "order-complete",
        category: "transactional",
      }),
    ).resolves.toEqual({ allowed: true });
  });

  it("ignores the promotional daily cap for transactional messages", async () => {
    process.env.WHATSAPP_PROMO_DAILY_CAP = "1";
    countLogs.mockResolvedValue(9_999);

    await expect(
      assertWhatsAppSendAllowed({
        phoneNormalized: PHONE,
        purpose: "otp",
        category: "transactional",
      }),
    ).resolves.toEqual({ allowed: true });
  });
});

describe("assertWhatsAppSendAllowed — promotional", () => {
  it("allows a promotional message to a consenting customer under the cap", async () => {
    await expect(
      assertWhatsAppSendAllowed({
        phoneNormalized: PHONE,
        purpose: "promo",
        category: "promotional",
      }),
    ).resolves.toEqual({ allowed: true });
  });

  it("refuses a promotional message to an opted-out customer", async () => {
    findCustomer.mockResolvedValue({ whatsappOptedOutAt: new Date() });

    const decision = await assertWhatsAppSendAllowed({
      phoneNormalized: PHONE,
      purpose: "promo",
      category: "promotional",
    });

    expect(decision).toEqual(
      expect.objectContaining({ allowed: false, reason: "opted_out" }),
    );
    // Opt-out short-circuits before the cap query.
    expect(countLogs).not.toHaveBeenCalled();
  });

  it("allows a promotional message when no customer record exists", async () => {
    findCustomer.mockResolvedValue(null);

    await expect(
      assertWhatsAppSendAllowed({
        phoneNormalized: PHONE,
        purpose: "promo",
        category: "promotional",
      }),
    ).resolves.toEqual({ allowed: true });
  });

  it("refuses once the daily cap is reached", async () => {
    process.env.WHATSAPP_PROMO_DAILY_CAP = "5";
    countLogs.mockResolvedValue(5);

    const decision = await assertWhatsAppSendAllowed({
      phoneNormalized: PHONE,
      purpose: "promo",
      category: "promotional",
    });

    expect(decision).toEqual(
      expect.objectContaining({ allowed: false, reason: "daily_cap" }),
    );
  });

  it("counts only sent promotional rows since the start of the day", async () => {
    await assertWhatsAppSendAllowed({
      phoneNormalized: PHONE,
      purpose: "promo",
      category: "promotional",
    });

    expect(countLogs).toHaveBeenCalledWith({
      where: {
        category: "promotional",
        status: "sent",
        sentAt: { gte: expect.any(Date) },
      },
    });
  });

  // A gate that throws would let a caller fall through to an unverified send.
  it("returns a decision instead of throwing, and fails closed on DB errors", async () => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    findCustomer.mockRejectedValue(new Error("database unavailable"));

    const decision = await assertWhatsAppSendAllowed({
      phoneNormalized: PHONE,
      purpose: "promo",
      category: "promotional",
    });

    expect(decision).toEqual(
      expect.objectContaining({ allowed: false, reason: "policy_unavailable" }),
    );
  });
});

describe("cap configuration", () => {
  it("defaults to the conservative cap", () => {
    expect(getWhatsAppPromoDailyCap()).toBe(WHATSAPP_PROMO_DAILY_CAP_DEFAULT);
  });

  it("honours the env override and clamps nonsense", () => {
    process.env.WHATSAPP_PROMO_DAILY_CAP = "12";
    expect(getWhatsAppPromoDailyCap()).toBe(12);

    process.env.WHATSAPP_PROMO_DAILY_CAP = "-5";
    expect(getWhatsAppPromoDailyCap()).toBe(0);

    process.env.WHATSAPP_PROMO_DAILY_CAP = "not-a-number";
    expect(getWhatsAppPromoDailyCap()).toBe(WHATSAPP_PROMO_DAILY_CAP_DEFAULT);
  });
});

describe("startOfWibDay", () => {
  it("returns 17:00 UTC the previous day (00:00 WIB)", () => {
    // 2026-07-27T02:30:00Z is 09:30 WIB on the 27th.
    const start = startOfWibDay(new Date("2026-07-27T02:30:00.000Z"));
    expect(start.toISOString()).toBe("2026-07-26T17:00:00.000Z");
  });

  it("does not roll back a day for a late-evening UTC timestamp", () => {
    // 2026-07-27T20:00:00Z is already 03:00 WIB on the 28th.
    const start = startOfWibDay(new Date("2026-07-27T20:00:00.000Z"));
    expect(start.toISOString()).toBe("2026-07-27T17:00:00.000Z");
  });
});
