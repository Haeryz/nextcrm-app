jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
jest.mock("@/lib/session", () => ({ getServerSession: jest.fn() }));
jest.mock("@/lib/auth", () => ({ authOptions: {} }));
jest.mock("@/lib/mektek/permissions", () => ({
  canManageMektekFinance: jest.fn(() => true),
}));

const customerFindUnique = jest.fn();
const entryCreate = jest.fn();
const entryUpdate = jest.fn();
const entryDelete = jest.fn();

jest.mock("@/lib/prisma", () => ({
  prismadb: {
    users: {
      findUnique: jest.fn().mockResolvedValue({
        id: "staff-id",
        is_admin: true,
        staffDivision: "FINANCE",
        userStatus: "ACTIVE",
      }),
    },
    paymentFakturCustomer: { findUnique: customerFindUnique },
    paymentFakturEntry: {
      create: entryCreate,
      update: entryUpdate,
      delete: entryDelete,
    },
  },
}));

import {
  createPaymentFakturEntry,
  deletePaymentFakturEntry,
  updatePaymentFakturEntry,
} from "@/actions/mektek/payment-faktur";
import { getServerSession } from "@/lib/session";

const validInput = {
  customerId: "customer-id",
  receiptNumber: "KWT-001",
  invoiceNumber: "INV-DUPLICATE-ALLOWED",
  invoiceDate: "2026-07-01",
  purchaseOrderNumber: "PO-001",
  destinationBank: "Mandiri (031-00-1134863-1)",
  deliveryDate: "2026-07-02",
  description: "SERVICE AC",
  subtotal: 1_000_000,
  taxAmount: 110_000,
  transferDate: "",
  taxInvoiceNumber: "FP-001",
  installment1: 100_000,
  installment2: 0,
  installment3: 0,
};

describe("Payment Faktur CRUD actions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { id: "staff-id" },
    });
    customerFindUnique.mockResolvedValue({ id: "customer-id" });
    entryCreate.mockResolvedValue({ id: "created-id" });
    entryUpdate.mockResolvedValue({ id: "updated-id" });
    entryDelete.mockResolvedValue({ id: "deleted-id" });
  });

  it("creates a row and derives grand total from the two workbook amount inputs", async () => {
    await expect(createPaymentFakturEntry(validInput)).resolves.toEqual({
      data: { id: "created-id" },
    });

    expect(entryCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        invoiceNumber: "INV-DUPLICATE-ALLOWED",
        destinationBank: "Mandiri (031-00-1134863-1)",
        createdBy: "staff-id",
        updatedBy: "staff-id",
      }),
    });
    const data = entryCreate.mock.calls[0][0].data;
    expect(data.grandTotal.toNumber()).toBe(1_110_000);
  });

  it("rejects installments above the invoice total", async () => {
    const result = await updatePaymentFakturEntry("entry-id", {
      ...validInput,
      installment1: 1_200_000,
    });

    expect(result).toEqual({
      error: "Jumlah cicilan tidak boleh melebihi grand total",
    });
    expect(entryUpdate).not.toHaveBeenCalled();
  });

  it("rejects a destination account outside the configured dropdown", async () => {
    const result = await createPaymentFakturEntry({
      ...validInput,
      destinationBank: "Bank lain 123",
    });

    expect(result).toEqual({ error: "Rekening tujuan tidak valid" });
    expect(entryCreate).not.toHaveBeenCalled();
  });

  it("deletes the requested ledger row", async () => {
    await expect(deletePaymentFakturEntry("entry-id")).resolves.toEqual({
      data: { id: "entry-id" },
    });
    expect(entryDelete).toHaveBeenCalledWith({ where: { id: "entry-id" } });
  });
});
