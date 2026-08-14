jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
jest.mock("@/lib/session", () => ({ getServerSession: jest.fn() }));
jest.mock("@/lib/auth", () => ({ authOptions: {} }));
jest.mock("@/lib/mektek/permissions", () => ({
  hasMektekCapability: jest.fn(() => true),
  canViewMektekFinance: jest.fn(() => true),
}));

const sourceFindUnique = jest.fn();
const sourceUpdate = jest.fn();
const billCreate = jest.fn();
const billFindMany = jest.fn();
const billUpdate = jest.fn();
const disbursementCreate = jest.fn();
const sequenceUpsert = jest.fn();
const auditCreate = jest.fn();
const usersFindUnique = jest.fn();
const debtEntryFindFirst = jest.fn();
const debtEntryFindMany = jest.fn();
const debtEntryCreate = jest.fn();
const debtTransactionCreate = jest.fn();

const transactionClient = {
  financePayableSource: {
    findUnique: sourceFindUnique,
    update: sourceUpdate,
  },
  financeSupplierBill: {
    create: billCreate,
    findMany: billFindMany,
    update: billUpdate,
  },
  financeDisbursement: { create: disbursementCreate },
  financeDocumentSequence: { upsert: sequenceUpsert },
  financeAuditEvent: { create: auditCreate },
  mektekSupplierDebtEntry: {
    findFirst: debtEntryFindFirst,
    findMany: debtEntryFindMany,
    create: debtEntryCreate,
  },
  mektekSupplierDebtTransaction: { create: debtTransactionCreate },
};

jest.mock("@/lib/prisma", () => ({
  prismadb: {
    users: { findUnique: usersFindUnique },
    $transaction: jest.fn(async (callback: (tx: typeof transactionClient) => unknown) =>
      callback(transactionClient),
    ),
  },
}));

import { Prisma } from "@prisma/client";

import {
  createMatchedFinanceSupplierBill,
  postFinanceDisbursement,
} from "@/actions/mektek/finance";
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
      staffCapabilities: ["MEKTEK_FINANCE"],
      userStatus: "ACTIVE",
    });
    sequenceUpsert.mockResolvedValue({ nextValue: 2 });
    sourceFindUnique.mockResolvedValue({
      id: "source-id",
      sourceReference: "SJ-001",
      counterpartyId: "supplier-id",
      counterparty: { legalName: "Test Supplier" },
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
    debtEntryFindFirst.mockResolvedValue(null);
    debtEntryFindMany.mockResolvedValue([]);
    debtEntryCreate.mockResolvedValue({ id: "debt-id" });
    disbursementCreate.mockResolvedValue({ id: "payment-id" });
    billUpdate.mockResolvedValue({ id: "bill-id" });
    debtTransactionCreate.mockResolvedValue({ id: "debt-payment-id" });
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
        status: "POSTED",
        postedAt: expect.any(Date),
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
      data: { supplierBillId: "bill-id", status: "BILLED" },
    });
    expect(auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        entityType: "SUPPLIER_BILL",
        entityId: "bill-id",
        action: "POST_THREE_WAY_MATCHED_BILL",
        actorId: "finance-id",
      }),
    });
  });

  it("posts a complete supplier payment directly and marks the bill paid", async () => {
    billFindMany.mockResolvedValue([
      {
        id: "bill-id",
        supplierInvoiceNumber: "INV-FRG-001",
        totalAmount: new Prisma.Decimal(1_600_000),
        counterparty: { legalName: "Test Supplier" },
        allocations: [],
      },
    ]);
    debtEntryFindMany.mockResolvedValue([
      { sheetKey: "Test Supplier", sourceRow: 1_000_001 },
    ]);

    await expect(
      postFinanceDisbursement({
        counterpartyId: "supplier-id",
        method: "BANK_TRANSFER",
        amount: 1_600_000,
        paidAt: "2026-08-14",
        bankReference: "TRX-20260814-001",
        allocations: [{ supplierBillId: "bill-id", amount: 1_600_000 }],
      }),
    ).resolves.toEqual({
      data: { id: "payment-id", paymentNumber: "PAY-202608-0001" },
    });

    expect(disbursementCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        method: "BANK_TRANSFER",
        bankReference: "TRX-20260814-001",
        allocations: {
          create: [
            expect.objectContaining({ supplierBillId: "bill-id" }),
          ],
        },
      }),
    });
    expect(billUpdate).toHaveBeenCalledWith({
      where: { id: "bill-id" },
      data: { status: "PAID" },
    });
    expect(debtTransactionCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        kind: "PAYMENT",
        reference: "TRX-20260814-001",
      }),
    });
  });

  it("rejects an amount above the remaining supplier bill", async () => {
    billFindMany.mockResolvedValue([
      {
        id: "bill-id",
        supplierInvoiceNumber: "INV-FRG-001",
        totalAmount: new Prisma.Decimal(1_600_000),
        counterparty: { legalName: "Test Supplier" },
        allocations: [],
      },
    ]);

    await expect(
      postFinanceDisbursement({
        counterpartyId: "supplier-id",
        method: "BANK_TRANSFER",
        amount: 1_600_001,
        paidAt: "2026-08-14",
        bankReference: "TRX-OVERPAY",
        allocations: [{ supplierBillId: "bill-id", amount: 1_600_001 }],
      }),
    ).resolves.toEqual({
      error: "Nominal pembayaran melebihi sisa tagihan",
    });
    expect(disbursementCreate).not.toHaveBeenCalled();
  });
});
