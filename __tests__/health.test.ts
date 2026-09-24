const queryRaw = jest.fn();

jest.mock("@/lib/prisma", () => ({
  prismadb: {
    $queryRaw: queryRaw,
  },
}));

describe("GET /api/health", () => {
  beforeEach(() => {
    queryRaw.mockReset();
  });

  it("returns ready when PostgreSQL is reachable", async () => {
    queryRaw.mockResolvedValue([{ ok: 1 }]);
    const { GET } = await import("@/app/api/health/route");

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("ready");
    expect(body.database).toBe("reachable");
  });

  it("returns service unavailable when PostgreSQL is unreachable", async () => {
    queryRaw.mockRejectedValue(new Error("connection refused"));
    const { GET } = await import("@/app/api/health/route");

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.status).toBe("not_ready");
    expect(body.database).toBe("unreachable");
    expect(body).not.toHaveProperty("error");
  });

  it("reports the build baked into the image", async () => {
    jest.resetModules();
    process.env.APP_COMMIT_SHA = "15a8d85c0123456789abcdef0123456789abcdef";
    process.env.APP_BUILD_TIME = "2026-09-24T03:50:00Z";
    queryRaw.mockResolvedValue([{ ok: 1 }]);
    const { GET } = await import("@/app/api/health/route");

    const body = await (await GET()).json();

    expect(body.version).toMatchObject({
      commit: "15a8d85c0123456789abcdef0123456789abcdef",
      shortCommit: "15a8d85c0123",
      builtAt: "2026-09-24T03:50:00Z",
    });
    expect(Date.parse(body.version.startedAt)).not.toBeNaN();
    delete process.env.APP_COMMIT_SHA;
    delete process.env.APP_BUILD_TIME;
  });
});
