import type { NextRequest } from "next/server";

import { prismadb } from "@/lib/prisma";
import { getTransactionStatus } from "@/lib/midtrans";
import { applyMidtransPaymentResult } from "@/lib/mektek/payment-sync";
import { POST } from "@/app/api/mektek/payments/notification/route";

jest.mock("@/lib/prisma", () => ({
  prismadb: {
    mektekPayment: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock("@/lib/midtrans", () => ({
  verifyNotificationSignature: jest.fn(() => true),
  getTransactionStatus: jest.fn(),
  interpretTransactionStatus: jest.fn(() => "paid"),
}));

jest.mock("@/lib/mektek/payment-sync", () => ({
  applyMidtransPaymentResult: jest.fn(async () => ({})),
  syncPaidMektekPaymentToOrder: jest.fn(async () => ({})),
}));

const mockedPrisma = prismadb as unknown as {
  mektekPayment: { findUnique: jest.Mock };
};
const mockedGetStatus = getTransactionStatus as jest.Mock;
const mockedApply = applyMidtransPaymentResult as jest.Mock;

const makeRequest = (body: Record<string, unknown>): NextRequest =>
  ({ json: async () => body } as unknown as NextRequest);

const validBody = {
  order_id: "MEK-abc-123",
  status_code: "200",
  gross_amount: "150000.00",
  signature_key: "valid",
  transaction_status: "settlement",
};

beforeEach(() => {
  jest.clearAllMocks();
  mockedPrisma.mektekPayment.findUnique.mockResolvedValue({
    id: "pay1",
    midtransOrderId: "MEK-abc-123",
    paidAt: null,
    paymentType: null,
  });
});

describe("Midtrans webhook — item 13: no POST-body fallback on re-fetch failure", () => {
  it("does NOT finalize the payment when the authoritative status re-fetch fails", async () => {
    mockedGetStatus.mockResolvedValue({ ok: false, error: "gateway down" });

    const res = await POST(makeRequest(validBody));
    const json = await res.json();

    expect(res.status).toBe(200); // acknowledge so Midtrans retries later
    expect(json.ok).toBe(true);
    expect(mockedApply).not.toHaveBeenCalled(); // no mutation on unverified status
  });

  it("finalizes only via the verified server-to-server re-fetch", async () => {
    mockedGetStatus.mockResolvedValue({
      ok: true,
      data: { transaction_status: "settlement", gross_amount: "150000.00" },
    });

    const res = await POST(makeRequest(validBody));
    await res.json();

    expect(mockedApply).toHaveBeenCalledTimes(1);
    const arg = mockedApply.mock.calls[0][0];
    // The verdict/authoritative data comes from the re-fetch, never the POST body.
    expect(arg.authoritative).toEqual({
      transaction_status: "settlement",
      gross_amount: "150000.00",
    });
  });
});
