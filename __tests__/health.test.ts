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
});
