jest.mock("server-only", () => ({}), { virtual: true });

import { consumeAuthRateLimit } from "@/lib/auth-rate-limit";
import { prismadb } from "@/lib/prisma";

jest.mock("@/lib/prisma", () => ({
  prismadb: {
    authRateLimit: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock("@/lib/rate-limit", () => ({
  checkRateLimit: jest.fn(() => ({ ok: true, retryAfterMs: 0 })),
}));

const mockedRateLimit = prismadb.authRateLimit as unknown as {
  findUnique: jest.Mock;
  upsert: jest.Mock;
  update: jest.Mock;
};

describe("database-backed authentication rate limiting", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("creates a shared database bucket for the first attempt", async () => {
    mockedRateLimit.findUnique.mockResolvedValue(null);
    mockedRateLimit.upsert.mockResolvedValue({});

    await expect(
      consumeAuthRateLimit("customer-login:account:+62812", 10, 60_000),
    ).resolves.toEqual({ ok: true, retryAfterMs: 0 });
    expect(mockedRateLimit.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ attempts: 1 }),
        update: expect.objectContaining({ attempts: 1 }),
      }),
    );
  });

  it("blocks attempts after the configured shared limit", async () => {
    mockedRateLimit.findUnique.mockResolvedValue({
      attempts: 10,
      windowStartedAt: new Date(),
      blockedUntil: null,
    });
    mockedRateLimit.update.mockResolvedValue({});

    const result = await consumeAuthRateLimit(
      "customer-login:account:+62812",
      10,
      60_000,
    );

    expect(result.ok).toBe(false);
    expect(result.retryAfterMs).toBeGreaterThan(0);
    expect(mockedRateLimit.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { blockedUntil: expect.any(Date) },
      }),
    );
  });
});
