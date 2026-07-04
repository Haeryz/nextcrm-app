describe("getServerSession wrapper", () => {
  const originalDisableAuth = process.env.NEXTCRM_DISABLE_AUTH;

  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    if (originalDisableAuth === undefined) {
      delete process.env.NEXTCRM_DISABLE_AUTH;
    } else {
      process.env.NEXTCRM_DISABLE_AUTH = originalDisableAuth;
    }
  });

  it("does not promote a real signed-in customer session when no-auth mode is enabled", async () => {
    process.env.NEXTCRM_DISABLE_AUTH = "true";

    jest.doMock("next-auth", () => ({
      getServerSession: jest.fn(async () => ({
        expires: "2099-01-01T00:00:00.000Z",
        user: {
          id: "customer-id",
          _id: "customer-id",
          email: "08123456789@phone.nextcrm.local",
          name: "Farriel",
          isAdmin: false,
          mektekRole: null,
          userLanguage: "en",
          userStatus: "ACTIVE",
        },
      })),
    }));
    jest.doMock("@/lib/auth", () => ({ authOptions: {} }));
    jest.doMock("@/lib/prisma", () => ({
      prismadb: {
        users: {
          findFirst: jest.fn(),
          upsert: jest.fn(),
        },
      },
    }));

    const { getServerSession } = await import("@/lib/session");
    const session = await getServerSession();

    expect(session?.user.email).toBe("08123456789@phone.nextcrm.local");
    expect(session?.user.isAdmin).toBe(false);
    expect(session?.user.mektekRole).toBeNull();
  });
});
