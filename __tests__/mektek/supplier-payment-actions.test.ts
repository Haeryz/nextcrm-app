jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
jest.mock("@/lib/session", () => ({ getServerSession: jest.fn() }));
jest.mock("@/lib/auth", () => ({ authOptions: {} }));
jest.mock("@/lib/mektek/permissions", () => ({
  canManageMektekFinance: jest.fn(() => true),
  canApproveMektekFinance: jest.fn(() => true),
}));

const sourceFindUnique = jest.fn();
const sourceUpdate = jest.fn();
const billCreate = jest.fn();
const sequenceUpsert = jest.fn();
const auditCreate = jest.fn();
const usersFindUnique = jest.fn();

const transactionClient = {
  financePayableSource: {
    findUnique: sourceFindUnique,
    update: sourceUpdate,
  },
  financeSupplierBill: { create: billCreate },
  financeDocumentSequence: { upsert: sequenceUpsert },
  financeAuditEvent: { create: auditCreate },
};

jest.mock("@/lib/prisma", () => ({
  prismadb: {
    users: { findUnique: usersFindUnique },
    $transaction: jest.fn(async (callback: (tx: typeof transactionClient) => unknown) =>
      callback(transactionClient),
    ),
  },
}));

import { createMatchedFinanceSupplierBill } from "@/actions/mektek/finance";
import { getServerSession } from "@/lib/session";

const validInput = {
  payableSourceId: "source-id",
  supplierInvoiceNumber: "INV-FRG-001",
  billDate: "2026-07-22",
  dueDate: "2026-08-21",
  taxAmount: 5_447_750,
  purchaseOrderVerified: true,
  supplierInvoiceVerified: true,
  goodsReceiptVerified: true,
};

describe("matched supplier bill action", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { id: "finance-id" },
    });
    usersFindUnique.mockResolvedValue({
      id: "finance-id",
      is_admin: true,
      staffDivision: "FINANCE",
      userStatus: "ACTIVE",
    });
    sequenceUpsert.mockResolvedValue({ nextValue: 2 });
    sourceFindUnique.mockResolvedValue({
      id: "source-id",
      sourceReference: "SJ-001",
      counterpartyId: "supplier-id",
      supplierBillId: null,
      status: "UNBILLED",
      totalAmount: "49525000",
      snapshot: {
        poNumber: "MTL/LOG-PO/VII/26/MTL0407263",
        items: [
          {
            id: "item-1",
            name: "PULLEY TRANSFER 220MM",
            quantity: 8,
            unitCost: "5675000",
          },
          {
            id: "item-2",
            name: "AS PULLEY PTO TRANSFER",
            quantity: 15,
            unitCost: "275000",
          },
        ],
      },
    });
    billCreate.mockResolvedValue({ id: "bill-id" });
    sourceUpdate.mockResolvedValue({ id: "source-id" });
    auditCreate.mockResolvedValue({ id: "audit-id" });
  });

  it("requires confirmation of all three physical documents", async () => {
    const result = await createMatchedFinanceSupplierBill({
      ...validInput,
      goodsReceiptVerified: false,
    });

    expect(result).toEqual({
      error: "PO, invoice pemasok, dan surat jalan wajib diverifikasi",
    });
    expect(sourceFindUnique).not.toHaveBeenCalled();
  });

  it("derives payable lines from Logistics and calculates the final supplier amount", async () => {
    await expect(createMatchedFinanceSupplierBill(validInput)).resolves.toEqual({
      data: { id: "bill-id" },
    });

    expect(billCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        supplierInvoiceNumber: "INV-FRG-001",
        counterpartyId: "supplier-id",
        subtotal: expect.anything(),
        taxAmount: expect.anything(),
        totalAmount: expect.anything(),
        matchException: null,
        lines: {
          create: [
            expect.objectContaining({
              position: 1,
              description: "PULLEY TRANSFER 220MM",
              lineTotal: expect.anything(),
            }),
            expect.objectContaining({
              position: 2,
              description: "AS PULLEY PTO TRANSFER",
              lineTotal: expect.anything(),
            }),
          ],
        },
      }),
    });
    const data = billCreate.mock.calls[0][0].data;
    expect(data.subtotal.toNumber()).toBe(49_525_000);
    expect(data.taxAmount.toNumber()).toBe(5_447_750);
    expect(data.totalAmount.toNumber()).toBe(54_972_750);
    expect(sourceUpdate).toHaveBeenCalledWith({
      where: { id: "source-id" },
      data: { supplierBillId: "bill-id", status: "DRAFTED" },
    });
  });
});
