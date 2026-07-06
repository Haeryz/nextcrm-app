import { prismadb } from "@/lib/prisma";
import { hashOtpCode, verifyOtpCode, OTP_MAX_ATTEMPTS } from "@/lib/otp";

// server-only throws outside a real server bundle; stub it for the unit test.
jest.mock("server-only", () => ({}), { virtual: true });
jest.mock("@/lib/prisma", () => ({
  prismadb: {
    customerPhoneVerification: {
      findUnique: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
    },
  },
}));

const findUnique = prismadb.customerPhoneVerification.findUnique as jest.Mock;
const update = prismadb.customerPhoneVerification.update as jest.Mock;

const PHONE = "+628123456789";
const CODE = "123456";
const future = () => new Date(Date.now() + 60_000);
const past = () => new Date(Date.now() - 60_000);

const baseRow = (over: Record<string, unknown> = {}) => ({
  phoneNormalized: PHONE,
  codeHash: hashOtpCode(CODE),
  expiresAt: future(),
  attempts: 0,
  consumedAt: null,
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  update.mockResolvedValue({});
});

describe("verifyOtpCode (item 19)", () => {
  it("accepts the correct code and consumes it (single-use)", async () => {
    findUnique.mockResolvedValue(baseRow());
    expect(await verifyOtpCode(PHONE, CODE)).toBe(true);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ consumedAt: expect.any(Date) }),
      })
    );
  });

  it("rejects a wrong code and increments attempts", async () => {
    findUnique.mockResolvedValue(baseRow());
    expect(await verifyOtpCode(PHONE, "000000")).toBe(false);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { attempts: { increment: 1 } },
      })
    );
  });

  it("rejects an expired code without consuming", async () => {
    findUnique.mockResolvedValue(baseRow({ expiresAt: past() }));
    expect(await verifyOtpCode(PHONE, CODE)).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });

  it("rejects an already-consumed code", async () => {
    findUnique.mockResolvedValue(baseRow({ consumedAt: new Date() }));
    expect(await verifyOtpCode(PHONE, CODE)).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });

  it("locks out after too many attempts even with the right code", async () => {
    findUnique.mockResolvedValue(baseRow({ attempts: OTP_MAX_ATTEMPTS }));
    expect(await verifyOtpCode(PHONE, CODE)).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });

  it("rejects when no verification row exists", async () => {
    findUnique.mockResolvedValue(null);
    expect(await verifyOtpCode(PHONE, CODE)).toBe(false);
  });

  it("short-circuits on empty inputs without a DB hit", async () => {
    expect(await verifyOtpCode("", CODE)).toBe(false);
    expect(await verifyOtpCode(PHONE, "")).toBe(false);
    expect(findUnique).not.toHaveBeenCalled();
  });
});
