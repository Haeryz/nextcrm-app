import { prismadb } from "@/lib/prisma";
import resendHelper from "@/lib/resend";

import {
  requestPasswordReset,
  resetPassword,
} from "@/actions/auth/password-reset";

jest.mock("@/lib/prisma", () => ({
  prismadb: {
    users: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    passwordResetToken: {
      deleteMany: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(async (ops: unknown) =>
      Array.isArray(ops) ? Promise.all(ops) : ops
    ),
  },
}));

jest.mock("@/lib/resend", () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock("@/emails/PasswordReset", () => ({
  __esModule: true,
  default: jest.fn(() => null),
}));

jest.mock("bcryptjs", () => ({
  hash: jest.fn(async () => "hashed-password"),
}));

// Requests carry no real headers in unit tests; return an empty header bag.
jest.mock("next/headers", () => ({
  headers: jest.fn(async () => new Map()),
}));

// Never rate-limit in unit tests.
jest.mock("@/lib/rate-limit", () => ({
  checkRateLimit: jest.fn(() => ({ ok: true })),
  getClientIp: jest.fn(() => "127.0.0.1"),
}));

const mockedPrisma = prismadb as unknown as {
  users: { findFirst: jest.Mock; update: jest.Mock };
  passwordResetToken: {
    deleteMany: jest.Mock;
    create: jest.Mock;
    findUnique: jest.Mock;
  };
  $transaction: jest.Mock;
};
const mockedResendHelper = resendHelper as jest.Mock;

describe("requestPasswordReset", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedResendHelper.mockResolvedValue({
      emails: { send: jest.fn(async () => ({})) },
    });
  });

  it("returns a generic success and never mutates the password when the email is unknown", async () => {
    mockedPrisma.users.findFirst.mockResolvedValue(null);

    const result = await requestPasswordReset("nobody@example.com");

    // Same response as the success case → no user enumeration.
    expect(result).toEqual({
      success: true,
      message:
        "If an account exists for that email, a password reset link has been sent.",
    });
    expect(mockedPrisma.users.update).not.toHaveBeenCalled();
    expect(mockedPrisma.passwordResetToken.create).not.toHaveBeenCalled();
    expect(mockedResendHelper).not.toHaveBeenCalled();
  });

  it("issues a single-use token and emails a link (not a new password) for a known email", async () => {
    mockedPrisma.users.findFirst.mockResolvedValue({
      id: "user-id",
      email: "user@example.com",
      name: "User",
      avatar: null,
      userLanguage: "en",
    });

    const result = await requestPasswordReset("user@example.com");

    expect(result).toMatchObject({ success: true });
    // Old tokens invalidated, a fresh one created, and the current password is
    // never overwritten during the request step.
    expect(mockedPrisma.passwordResetToken.deleteMany).toHaveBeenCalledWith({
      where: { userId: "user-id" },
    });
    expect(mockedPrisma.passwordResetToken.create).toHaveBeenCalledTimes(1);
    expect(mockedPrisma.users.update).not.toHaveBeenCalled();
  });
});

describe("resetPassword", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("rejects an unknown/expired/used token without changing any password", async () => {
    mockedPrisma.passwordResetToken.findUnique.mockResolvedValue(null);

    const result = await resetPassword("bad-token", "newStrongPass");

    expect(result).toEqual({ error: "Invalid or expired reset link." });
    expect(mockedPrisma.users.update).not.toHaveBeenCalled();
  });

  it("rejects a too-short new password", async () => {
    const result = await resetPassword("some-token", "short");
    expect(result).toEqual({ error: "Password must be at least 8 characters." });
  });

  it("updates the password and burns the token for a valid, unexpired token", async () => {
    mockedPrisma.passwordResetToken.findUnique.mockResolvedValue({
      userId: "user-id",
      usedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    });

    const result = await resetPassword("good-token", "newStrongPass");

    expect(result).toMatchObject({ success: true });
    expect(mockedPrisma.$transaction).toHaveBeenCalledTimes(1);
  });
});
