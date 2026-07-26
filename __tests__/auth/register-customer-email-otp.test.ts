import { prismadb } from "@/lib/prisma";
import { verifyEmailOtpCode } from "@/lib/email-otp";
import { verifyOtpCode } from "@/lib/otp";

import { registerCustomerUser } from "@/actions/auth/register-user";
import { claimMektekCustomerByPhone } from "@/actions/mektek/customer-profile";

// Customer signup is verified by EMAIL (WhatsApp proved unreliable in production).
// The phone number is still the identity key, so these tests pin the security
// boundary: an email-verified signup must never inherit an existing walk-in
// customer record, and claiming one must still cost a phone (WhatsApp) OTP.

jest.mock("@/lib/prisma", () => ({
  prismadb: {
    users: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    catalogCustomer: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

jest.mock("@/lib/email-otp", () => ({
  verifyEmailOtpCode: jest.fn(),
}));

jest.mock("@/lib/otp", () => ({
  verifyOtpCode: jest.fn(),
}));

jest.mock("@/lib/password", () => ({
  hashPassword: jest.fn(async () => "hashed-password"),
}));

jest.mock("@/lib/new-user-notify", () => ({
  newUserNotify: jest.fn(),
}));

jest.mock("@/actions/email/preferences", () => ({
  setEmailPreferenceInternal: jest.fn(async () => ({ success: true })),
}));

jest.mock("@/lib/email/disposable-domains", () => ({
  assertNotDisposable: jest.fn(async () => undefined),
  DisposableEmailError: class DisposableEmailError extends Error {},
}));

// The claim action pulls in Mektek read helpers that are irrelevant here.
jest.mock("@/lib/customer-auth", () => ({
  getCustomerAuthSession: jest.fn(),
}));

jest.mock("@/lib/mektek/voucher-db", () => ({
  listAvailableMektekVouchersForCustomer: jest.fn(async () => []),
}));

jest.mock("@/lib/mektek/public-status", () => ({
  buildMektekPublicSnapshot: jest.fn(() => ({})),
}));

// Requests carry no real headers in unit tests; return an empty header bag.
jest.mock("next/headers", () => ({
  headers: jest.fn(async () => new Map()),
}));

jest.mock("@/lib/rate-limit", () => ({
  getClientIp: jest.fn(() => "127.0.0.1"),
}));

// Never rate-limit in unit tests (the limiter itself is covered elsewhere).
jest.mock("@/lib/auth-rate-limit", () => ({
  consumeAuthRateLimit: jest.fn(async () => ({ ok: true, retryAfterMs: 0 })),
}));

jest.mock("@/lib/trusted-origin", () => ({
  hasTrustedMutationOrigin: jest.fn(async () => true),
}));

const mockedPrisma = prismadb as unknown as {
  users: {
    findFirst: jest.Mock;
    findUnique: jest.Mock;
    create: jest.Mock;
  };
  catalogCustomer: {
    findFirst: jest.Mock;
    findUnique: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
  $transaction: jest.Mock;
};

const mockedVerifyEmailOtp = verifyEmailOtpCode as jest.Mock;
const mockedVerifyPhoneOtp = verifyOtpCode as jest.Mock;

const { getCustomerAuthSession } = jest.requireMock("@/lib/customer-auth") as {
  getCustomerAuthSession: jest.Mock;
};

const VALID_SIGNUP = {
  name: "Budi Santoso",
  phone: "081234567890",
  email: "budi@example.com",
  emailOtpCode: "123456",
  password: "rahasia123",
  confirmPassword: "rahasia123",
};

beforeEach(() => {
  jest.clearAllMocks();

  mockedPrisma.users.findFirst.mockResolvedValue(null);
  mockedPrisma.users.create.mockResolvedValue({
    id: "user-1",
    email: VALID_SIGNUP.email,
    name: VALID_SIGNUP.name,
  });
  mockedPrisma.catalogCustomer.findUnique.mockResolvedValue(null);
  mockedPrisma.catalogCustomer.create.mockResolvedValue({ id: "cust-1" });
  mockedPrisma.catalogCustomer.update.mockResolvedValue({ id: "cust-1" });
  mockedPrisma.$transaction.mockImplementation(
    async (fn: (tx: unknown) => unknown) => fn(mockedPrisma)
  );

  mockedVerifyEmailOtp.mockResolvedValue(true);
  mockedVerifyPhoneOtp.mockResolvedValue(true);
});

describe("registerCustomerUser — email is the signup verification channel", () => {
  it("creates the account when the emailed code verifies", async () => {
    const result = await registerCustomerUser(VALID_SIGNUP);

    expect(mockedVerifyEmailOtp).toHaveBeenCalledWith(
      "budi@example.com",
      "123456"
    );
    expect(result).toEqual({
      data: { id: "user-1", email: VALID_SIGNUP.email, name: VALID_SIGNUP.name },
    });
    expect(mockedPrisma.users.create).toHaveBeenCalledTimes(1);
  });

  it("rejects a wrong or expired email code and creates nothing", async () => {
    mockedVerifyEmailOtp.mockResolvedValue(false);

    const result = await registerCustomerUser({
      ...VALID_SIGNUP,
      emailOtpCode: "000000",
    });

    expect(result.error).toMatch(/Kode verifikasi email salah atau kedaluwarsa/);
    // Copy must tell the customer what to do when the code never arrives.
    expect(result.error).toMatch(/spam/i);
    expect(mockedPrisma.users.create).not.toHaveBeenCalled();
    expect(mockedPrisma.catalogCustomer.create).not.toHaveBeenCalled();
  });

  it("requires an email address", async () => {
    const result = await registerCustomerUser({
      ...VALID_SIGNUP,
      email: "",
    });

    expect(result.error).toContain("email");
    expect(mockedVerifyEmailOtp).not.toHaveBeenCalled();
    expect(mockedPrisma.users.create).not.toHaveBeenCalled();
  });

  it("requires an email code — an account can never be created unverified", async () => {
    const result = await registerCustomerUser({
      ...VALID_SIGNUP,
      emailOtpCode: "",
    });

    expect(result.error).toContain("emailOtpCode");
    expect(mockedPrisma.users.create).not.toHaveBeenCalled();
  });

  it("rejects an invalid email address before any code is checked", async () => {
    const result = await registerCustomerUser({
      ...VALID_SIGNUP,
      email: "not-an-email",
    });

    expect(result).toEqual({ error: "Email tidak valid" });
    expect(mockedVerifyEmailOtp).not.toHaveBeenCalled();
  });

  it("never asks for a phone OTP when the customer did not supply one", async () => {
    await registerCustomerUser(VALID_SIGNUP);

    expect(mockedVerifyPhoneOtp).not.toHaveBeenCalled();
  });
});

describe("registerCustomerUser — walk-in record linking stays phone-gated", () => {
  it("does NOT link an existing walk-in customer record without a phone OTP", async () => {
    // A stranger's walk-in record already exists for this phone number.
    mockedPrisma.catalogCustomer.findUnique.mockResolvedValue({
      id: "walkin-1",
      userId: null,
    });

    const result = await registerCustomerUser(VALID_SIGNUP);

    expect(result.error).toBeUndefined();
    // The account is created, but the walk-in record (and its service history)
    // is left untouched — no create, no update, no userId binding.
    expect(mockedPrisma.catalogCustomer.update).not.toHaveBeenCalled();
    expect(mockedPrisma.catalogCustomer.create).not.toHaveBeenCalled();
  });

  it("links an unclaimed walk-in record only when a phone OTP verifies", async () => {
    mockedPrisma.catalogCustomer.findUnique.mockResolvedValue({
      id: "walkin-1",
      userId: null,
    });

    const result = await registerCustomerUser({
      ...VALID_SIGNUP,
      otpCode: "654321",
    });

    expect(result.error).toBeUndefined();
    expect(mockedVerifyPhoneOtp).toHaveBeenCalledWith("+6281234567890", "654321");
    expect(mockedPrisma.catalogCustomer.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "walkin-1" },
        data: expect.objectContaining({ userId: "user-1" }),
      })
    );
  });

  it("rejects the whole signup when a supplied phone OTP is wrong", async () => {
    mockedVerifyPhoneOtp.mockResolvedValue(false);

    const result = await registerCustomerUser({
      ...VALID_SIGNUP,
      otpCode: "000000",
    });

    expect(result.error).toBe("Kode verifikasi WhatsApp salah atau kedaluwarsa");
    expect(mockedPrisma.users.create).not.toHaveBeenCalled();
  });

  it("never steals a walk-in record that already belongs to another account", async () => {
    mockedPrisma.catalogCustomer.findUnique.mockResolvedValue({
      id: "walkin-1",
      userId: "someone-else",
    });

    await registerCustomerUser({ ...VALID_SIGNUP, otpCode: "654321" });

    expect(mockedPrisma.catalogCustomer.update).not.toHaveBeenCalled();
  });

  it("creates a fresh customer record when no walk-in record exists", async () => {
    await registerCustomerUser(VALID_SIGNUP);

    expect(mockedPrisma.catalogCustomer.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          phoneNormalized: "+6281234567890",
          userId: "user-1",
        }),
      })
    );
  });
});

describe("claimMektekCustomerByPhone — still demands a phone (WhatsApp) OTP", () => {
  beforeEach(() => {
    getCustomerAuthSession.mockResolvedValue({ user: { id: "user-1" } });
    mockedPrisma.users.findUnique.mockResolvedValue({
      id: "user-1",
      phone: "081234567890",
      phoneNormalized: "6281234567890",
    });
    mockedPrisma.catalogCustomer.findFirst.mockResolvedValue({
      id: "walkin-1",
      userId: null,
    });
  });

  it("refuses to link when no code is supplied", async () => {
    const result = await claimMektekCustomerByPhone("");

    expect(result.error).toBe("Kode verifikasi wajib diisi");
    expect(mockedVerifyPhoneOtp).not.toHaveBeenCalled();
    expect(mockedPrisma.catalogCustomer.update).not.toHaveBeenCalled();
  });

  it("refuses to link when the phone code does not verify", async () => {
    mockedVerifyPhoneOtp.mockResolvedValue(false);

    const result = await claimMektekCustomerByPhone("000000");

    expect(result.error).toBe("Kode verifikasi salah atau kedaluwarsa");
    expect(mockedPrisma.catalogCustomer.update).not.toHaveBeenCalled();
  });

  it("links the record only after the phone code verifies", async () => {
    const result = await claimMektekCustomerByPhone("654321");

    expect(mockedVerifyPhoneOtp).toHaveBeenCalledWith("6281234567890", "654321");
    expect(result).toEqual({ success: true });
    expect(mockedPrisma.catalogCustomer.update).toHaveBeenCalledWith({
      where: { id: "walkin-1" },
      data: { userId: "user-1" },
    });
  });
});
