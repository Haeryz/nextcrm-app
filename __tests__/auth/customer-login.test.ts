import { loginCustomer } from "@/actions/auth/customer-session";
import { prismadb } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import {
  createCustomerSession,
  revokeCurrentCustomerSession,
} from "@/lib/customer-session";

jest.mock("@/lib/prisma", () => ({
  prismadb: {
    users: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock("@/lib/password", () => ({
  hashPassword: jest.fn(),
  verifyPassword: jest.fn(),
}));

jest.mock("@/lib/customer-session", () => ({
  createCustomerSession: jest.fn(),
  revokeCurrentCustomerSession: jest.fn(),
}));

jest.mock("@/lib/auth-rate-limit", () => ({
  consumeAuthRateLimit: jest.fn(async () => ({ ok: true, retryAfterMs: 0 })),
}));

jest.mock("@/lib/trusted-origin", () => ({
  hasTrustedMutationOrigin: jest.fn(async () => true),
}));

jest.mock("next/headers", () => ({
  headers: jest.fn(async () => new Headers({ "x-forwarded-for": "127.0.0.1" })),
}));

const mockedPrisma = prismadb as unknown as {
  users: { findFirst: jest.Mock; update: jest.Mock };
};
const mockedVerifyPassword = verifyPassword as jest.Mock;
const mockedCreateSession = createCustomerSession as jest.Mock;
const mockedRevokeSession = revokeCurrentCustomerSession as jest.Mock;

describe("customer session actions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedVerifyPassword.mockResolvedValue({
      valid: false,
      needsRehash: false,
    });
  });

  it("returns one generic error for an unknown account", async () => {
    mockedPrisma.users.findFirst.mockResolvedValue(null);

    await expect(
      loginCustomer({ phone: "+628123456789", password: "not-the-password" }),
    ).resolves.toEqual({ error: "Invalid phone number or password." });
    expect(mockedVerifyPassword).toHaveBeenCalledTimes(1);
    expect(mockedCreateSession).not.toHaveBeenCalled();
  });

  it("creates a remembered session only for an active customer account", async () => {
    mockedPrisma.users.findFirst.mockResolvedValue({
      id: "customer-user-id",
      password: "$argon2id$hash",
      is_admin: false,
      mektekRole: null,
      userStatus: "ACTIVE",
      customerProfile: { id: "customer-id" },
    });
    mockedVerifyPassword.mockResolvedValue({ valid: true, needsRehash: false });
    mockedCreateSession.mockResolvedValue(undefined);

    await expect(
      loginCustomer({
        phone: "+628123456789",
        password: "correct horse battery staple",
        rememberDevice: true,
        returnTo: "/en/customer?view=sparepart",
        locale: "en",
      }),
    ).resolves.toEqual({
      success: true,
      redirectTo: "/en/customer?view=sparepart",
    });
    expect(mockedCreateSession).toHaveBeenCalledWith("customer-user-id", {
      rememberDevice: true,
    });
  });

  it("rejects staff credentials on the customer portal", async () => {
    mockedPrisma.users.findFirst.mockResolvedValue({
      id: "admin-user-id",
      password: "$argon2id$hash",
      is_admin: true,
      mektekRole: null,
      userStatus: "ACTIVE",
      customerProfile: null,
    });

    await expect(
      loginCustomer({ phone: "+628123456789", password: "password" }),
    ).resolves.toEqual({ error: "Invalid phone number or password." });
    expect(mockedCreateSession).not.toHaveBeenCalled();
  });

  it("revokes the database session on logout", async () => {
    mockedRevokeSession.mockResolvedValue(undefined);

    await expect(
      (await import("@/actions/auth/customer-session")).logoutCustomer(),
    ).resolves.toEqual({ success: true });
    expect(mockedRevokeSession).toHaveBeenCalledTimes(1);
  });
});
