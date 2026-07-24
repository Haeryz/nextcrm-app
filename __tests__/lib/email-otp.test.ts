import { prismadb } from "@/lib/prisma";
import {
  hashEmailOtpCode,
  verifyEmailOtpCode,
  EMAIL_OTP_MAX_ATTEMPTS,
} from "@/lib/email-otp";

// server-only throws outside a real server bundle; stub it for the unit test.
jest.mock("server-only", () => ({}), { virtual: true });
jest.mock("@/lib/prisma", () => ({
  prismadb: {
    customerEmailVerification: {
      findUnique: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
    },
  },
}));

const findUnique = prismadb.customerEmailVerification.findUnique as jest.Mock;
const update = prismadb.customerEmailVerification.update as jest.Mock;

const EMAIL = "user@example.com";
const CODE = "123456";
const future = () => new Date(Date.now() + 60_000);
const past = () => new Date(Date.now() - 60_000);

const baseRow = (over: Record<string, unknown> = {}) => ({
  emailNormalized: EMAIL,
  codeHash: hashEmailOtpCode(CODE),
  expiresAt: future(),
  attempts: 0,
  consumedAt: null,
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  update.mockResolvedValue({});
});

describe("verifyEmailOtpCode", () => {
  it("accepts the correct code and consumes it (single-use)", async () => {
    findUnique.mockResolvedValue(baseRow());
    expect(await verifyEmailOtpCode(EMAIL, CODE)).toBe(true);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ consumedAt: expect.any(Date) }),
      })
    );
  });

  it("rejects a wrong code and increments attempts", async () => {
    findUnique.mockResolvedValue(baseRow());
    expect(await verifyEmailOtpCode(EMAIL, "000000")).toBe(false);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { attempts: { increment: 1 } },
      })
    );
  });

  it("rejects an expired code without consuming", async () => {
    findUnique.mockResolvedValue(baseRow({ expiresAt: past() }));
    expect(await verifyEmailOtpCode(EMAIL, CODE)).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });

  it("rejects an already-consumed code", async () => {
    findUnique.mockResolvedValue(baseRow({ consumedAt: new Date() }));
    expect(await verifyEmailOtpCode(EMAIL, CODE)).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });

  it("locks out after too many attempts even with the right code", async () => {
    findUnique.mockResolvedValue(baseRow({ attempts: EMAIL_OTP_MAX_ATTEMPTS }));
    expect(await verifyEmailOtpCode(EMAIL, CODE)).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });

  it("rejects when no verification row exists", async () => {
    findUnique.mockResolvedValue(null);
    expect(await verifyEmailOtpCode(EMAIL, CODE)).toBe(false);
  });

  // Regression guard for the verifier's blocking finding: the submitted code
  // must be hashed before comparing against the stored hash. If this test
  // fails, the compare is passing the raw code through (which means a valid
  // OTP is rejected AND an attacker can authenticate by submitting the
  // stored hash as the "code").
  it("does NOT accept the stored hash itself as a valid code", async () => {
    findUnique.mockResolvedValue(baseRow());
    expect(await verifyEmailOtpCode(EMAIL, hashEmailOtpCode(CODE))).toBe(false);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { attempts: { increment: 1 } },
      })
    );
  });
});
