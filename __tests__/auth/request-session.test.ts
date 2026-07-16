jest.mock("@/lib/auth-guards", () => ({
  getSessionUser: jest.fn(),
}));
jest.mock("next-auth/jwt", () => ({
  getToken: jest.fn(),
}));
jest.mock("@/lib/prisma", () => ({
  prismadb: {
    users: { findUnique: jest.fn() },
  },
}));

import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth-guards";
import { prismadb } from "@/lib/prisma";
import { getRequestSessionUser } from "@/lib/request-session";

const mockedGetToken = getToken as jest.MockedFunction<typeof getToken>;
const mockedGetSessionUser = getSessionUser as jest.MockedFunction<
  typeof getSessionUser
>;
const mockedFindUnique = prismadb.users.findUnique as jest.Mock;

describe("getRequestSessionUser", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = "test-secret";
    process.env.NEXTAUTH_SECRET = "test-secret";
  });

  it("falls back to the request JWT and refreshes authorization from the database", async () => {
    mockedGetSessionUser.mockResolvedValue(null);
    mockedGetToken.mockResolvedValue({
      id: "admin-id",
      authVersion: 3,
    } as never);
    mockedFindUnique.mockResolvedValue({
      id: "admin-id",
      email: "admin@mektek.com",
      name: "Admin",
      avatar: null,
      phone: null,
      phoneNormalized: null,
      is_admin: true,
      mektekRole: null,
      userLanguage: "en",
      userStatus: "ACTIVE",
      lastLoginAt: null,
      authVersion: 3,
    });

    const user = await getRequestSessionUser(
      new Request("https://mektek-bice.vercel.app/api/whatsapp/status", {
        headers: { cookie: "next-auth.session-token=signed" },
      }) as NextRequest
    );

    expect(mockedGetToken).toHaveBeenCalledWith(
      expect.objectContaining({ secret: "test-secret" })
    );
    expect(mockedFindUnique).toHaveBeenCalledWith({
      where: { id: "admin-id" },
    });
    expect(user).toEqual(expect.objectContaining({ id: "admin-id", isAdmin: true }));
  });

  it("rejects a JWT invalidated by an auth-version change", async () => {
    mockedGetSessionUser.mockResolvedValue(null);
    mockedGetToken.mockResolvedValue({ id: "admin-id", authVersion: 2 } as never);
    mockedFindUnique.mockResolvedValue({ id: "admin-id", authVersion: 3 });

    await expect(
      getRequestSessionUser(
        new Request("https://example.com/api/whatsapp/status") as NextRequest
      )
    ).resolves.toBeNull();
  });
});
