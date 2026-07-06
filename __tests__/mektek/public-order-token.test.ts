import { prismadb } from "@/lib/prisma";
import { getPublicMektekServiceOrder } from "@/actions/mektek/service-orders";

// Keep the heavy side-effect imports (WhatsApp/Puppeteer, next-auth) out of the test.
jest.mock("@/lib/prisma", () => ({
  prismadb: {
    crm_Accounts_Tasks: {
      findFirst: jest.fn(),
    },
  },
}));
jest.mock("@/actions/mektek/whatsapp-notifications", () => ({
  notifyMektekOrderCreated: jest.fn(),
  notifyMektekOrderCompleted: jest.fn(),
}));
jest.mock("@/lib/session", () => ({ getServerSession: jest.fn() }));
jest.mock("@/lib/auth", () => ({ authOptions: {} }));
jest.mock("next/headers", () => ({ headers: jest.fn(async () => new Map()) }));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));

const mockedFindFirst = prismadb.crm_Accounts_Tasks.findFirst as jest.Mock;

const REAL_TOKEN = "a".repeat(40); // 20-byte hex customer token

beforeEach(() => {
  jest.clearAllMocks();
  mockedFindFirst.mockResolvedValue({
    id: "order1",
    tags: { customerToken: REAL_TOKEN, customerName: "Budi" },
    mektekPayments: [],
  });
});

describe("getPublicMektekServiceOrder — constant-time token gate (item 18)", () => {
  it("returns the order when the token matches exactly", async () => {
    const order = await getPublicMektekServiceOrder("order1", REAL_TOKEN);
    expect(order).not.toBeNull();
    expect(order?.id).toBe("order1");
  });

  it("rejects a wrong token of the same length", async () => {
    const wrong = "b".repeat(40);
    expect(await getPublicMektekServiceOrder("order1", wrong)).toBeNull();
  });

  it("rejects a token of a different length without throwing", async () => {
    // timingSafeEqual throws on unequal-length buffers; the sha256 digest wrapper
    // must make this a safe, plain `false`.
    await expect(
      getPublicMektekServiceOrder("order1", "short")
    ).resolves.toBeNull();
  });

  it("rejects when the order has no stored token", async () => {
    mockedFindFirst.mockResolvedValueOnce({
      id: "order1",
      tags: { customerName: "Budi" },
      mektekPayments: [],
    });
    expect(await getPublicMektekServiceOrder("order1", REAL_TOKEN)).toBeNull();
  });

  it("short-circuits without a DB hit when id or token is missing", async () => {
    expect(await getPublicMektekServiceOrder("", REAL_TOKEN)).toBeNull();
    expect(await getPublicMektekServiceOrder("order1", "")).toBeNull();
    expect(mockedFindFirst).not.toHaveBeenCalled();
  });
});
