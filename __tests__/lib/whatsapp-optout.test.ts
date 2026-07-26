jest.mock("server-only", () => ({}), { virtual: true });

import {
  buildWhatsAppOptOutUrl,
  consumeWhatsAppOptOutToken,
  hashWhatsAppOptOutToken,
  issueWhatsAppOptOutToken,
  peekWhatsAppOptOutToken,
  WHATSAPP_OPT_OUT_TOKEN_TTL_MS,
} from "@/lib/mektek/whatsapp-optout";
import { prismadb } from "@/lib/prisma";

jest.mock("@/lib/prisma", () => ({
  prismadb: {
    whatsAppOptOutToken: {
      create: jest.fn(),
      findUnique: jest.fn(),
      updateMany: jest.fn(),
    },
    catalogCustomer: { update: jest.fn() },
  },
}));

const tokens = prismadb.whatsAppOptOutToken as unknown as {
  create: jest.Mock;
  findUnique: jest.Mock;
  updateMany: jest.Mock;
};

const CUSTOMER_ID = "11111111-2222-3333-4444-555555555555";
const future = () => new Date(Date.now() + 60_000);
const past = () => new Date(Date.now() - 60_000);

const row = (token: string, over: Record<string, unknown> = {}) => ({
  customerId: CUSTOMER_ID,
  tokenHash: hashWhatsAppOptOutToken(token),
  expiresAt: future(),
  usedAt: null,
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  tokens.create.mockResolvedValue({});
  tokens.updateMany.mockResolvedValue({ count: 1 });
  process.env.NEXT_PUBLIC_APP_URL = "https://mektek-bice.vercel.app";
});

describe("issueWhatsAppOptOutToken", () => {
  it("returns a 32-byte hex token and stores only its hash", async () => {
    const { token, expiresAt } = await issueWhatsAppOptOutToken(CUSTOMER_ID);

    expect(token).toMatch(/^[0-9a-f]{64}$/);
    expect(expiresAt.getTime()).toBeGreaterThan(Date.now());

    const data = tokens.create.mock.calls[0][0].data;
    expect(data.customerId).toBe(CUSTOMER_ID);
    expect(data.tokenHash).toBe(hashWhatsAppOptOutToken(token));
    // The plaintext token must never reach the database.
    expect(JSON.stringify(data)).not.toContain(token);
  });

  it("sets a 30-day expiry", async () => {
    const before = Date.now();
    const { expiresAt } = await issueWhatsAppOptOutToken(CUSTOMER_ID);
    const drift = expiresAt.getTime() - (before + WHATSAPP_OPT_OUT_TOKEN_TTL_MS);
    expect(Math.abs(drift)).toBeLessThan(2_000);
  });

  it("issues distinct tokens on each call", async () => {
    const a = await issueWhatsAppOptOutToken(CUSTOMER_ID);
    const b = await issueWhatsAppOptOutToken(CUSTOMER_ID);
    expect(a.token).not.toBe(b.token);
  });
});

describe("peekWhatsAppOptOutToken", () => {
  it("validates without consuming", async () => {
    tokens.findUnique.mockResolvedValue(row("abc"));

    await expect(peekWhatsAppOptOutToken("abc")).resolves.toEqual({
      customerId: CUSTOMER_ID,
    });
    expect(tokens.updateMany).not.toHaveBeenCalled();
  });

  it("rejects unknown, expired and already-used tokens", async () => {
    tokens.findUnique.mockResolvedValueOnce(null);
    await expect(peekWhatsAppOptOutToken("abc")).resolves.toBeNull();

    tokens.findUnique.mockResolvedValueOnce(row("abc", { expiresAt: past() }));
    await expect(peekWhatsAppOptOutToken("abc")).resolves.toBeNull();

    tokens.findUnique.mockResolvedValueOnce(row("abc", { usedAt: new Date() }));
    await expect(peekWhatsAppOptOutToken("abc")).resolves.toBeNull();
  });
});

describe("consumeWhatsAppOptOutToken", () => {
  it("claims a valid token exactly once", async () => {
    tokens.findUnique.mockResolvedValue(row("abc"));

    await expect(consumeWhatsAppOptOutToken("abc")).resolves.toEqual({
      customerId: CUSTOMER_ID,
    });
    expect(tokens.updateMany).toHaveBeenCalledWith({
      where: { tokenHash: hashWhatsAppOptOutToken("abc"), usedAt: null },
      data: { usedAt: expect.any(Date) },
    });
  });

  // The `usedAt: null` guard is the compare-and-swap: the loser of a concurrent
  // double-click matches zero rows and must be told the token is spent.
  it("rejects the loser of a concurrent double-consume", async () => {
    tokens.findUnique.mockResolvedValue(row("abc"));
    tokens.updateMany.mockResolvedValue({ count: 0 });

    await expect(consumeWhatsAppOptOutToken("abc")).resolves.toBeNull();
  });

  it("rejects an expired token without claiming it", async () => {
    tokens.findUnique.mockResolvedValue(row("abc", { expiresAt: past() }));

    await expect(consumeWhatsAppOptOutToken("abc")).resolves.toBeNull();
    expect(tokens.updateMany).not.toHaveBeenCalled();
  });

  it("rejects an already-used token without claiming it", async () => {
    tokens.findUnique.mockResolvedValue(row("abc", { usedAt: new Date() }));

    await expect(consumeWhatsAppOptOutToken("abc")).resolves.toBeNull();
    expect(tokens.updateMany).not.toHaveBeenCalled();
  });

  it("rejects an unknown token", async () => {
    tokens.findUnique.mockResolvedValue(null);
    await expect(consumeWhatsAppOptOutToken("nope")).resolves.toBeNull();
  });
});

describe("buildWhatsAppOptOutUrl", () => {
  it("builds a public URL from NEXT_PUBLIC_APP_URL", () => {
    expect(buildWhatsAppOptOutUrl("tok123")).toBe(
      "https://mektek-bice.vercel.app/id/wa-optout?token=tok123",
    );
  });

  it("honours an explicit locale and strips a trailing slash", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://mektek-bice.vercel.app/";
    expect(buildWhatsAppOptOutUrl("tok123", "en")).toBe(
      "https://mektek-bice.vercel.app/en/wa-optout?token=tok123",
    );
  });
});
