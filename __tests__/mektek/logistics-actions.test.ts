jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
jest.mock("@/lib/session", () => ({ getServerSession: jest.fn() }));
jest.mock("@/lib/auth", () => ({ authOptions: {} }));
jest.mock("@/lib/mektek/permissions", () => ({
  canManageMektekLogistics: jest.fn(() => true),
}));

const purchaseOrderCreate = jest.fn();
const purchaseOrderUpdate = jest.fn();
const purchaseOrderItemFindUnique = jest.fn();
const purchaseOrderItemUpdateMany = jest.fn();
const purchaseOrderItemCount = jest.fn();
const receiptCreate = jest.fn();
const logisticsPicFindFirst = jest.fn();
const transaction = jest.fn();

const transactionClient = {
  logisticsPurchaseOrder: { update: purchaseOrderUpdate },
  logisticsPurchaseOrderItem: {
    findUnique: purchaseOrderItemFindUnique,
    updateMany: purchaseOrderItemUpdateMany,
    count: purchaseOrderItemCount,
  },
  logisticsReceipt: { create: receiptCreate },
  logisticsPic: { findFirst: logisticsPicFindFirst },
};

jest.mock("@/lib/prisma", () => ({
  prismadb: {
    $transaction: transaction,
    logisticsPurchaseOrder: {
      create: purchaseOrderCreate,
    },
  },
}));

import {
  createMektekLogisticsPurchaseOrder,
  recordMektekLogisticsReceipt,
} from "@/actions/mektek/logistics";
import { getServerSession } from "@/lib/session";

describe("MekTek Logistics actions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { id: "admin-id", userStatus: "ACTIVE" },
    });
    transaction.mockImplementation(async (callback) => callback(transactionClient));
    purchaseOrderItemFindUnique.mockResolvedValue({
      id: "item-1",
      orderedQuantity: 10,
      receivedQuantity: 0,
      status: "OPEN",
      purchaseOrder: {
        id: "po-1",
        poNumber: "PO-001",
        inputDate: new Date("2026-07-01T00:00:00.000Z"),
      },
    });
    purchaseOrderUpdate.mockResolvedValue({ id: "po-1" });
    purchaseOrderItemUpdateMany.mockResolvedValue({ count: 1 });
    purchaseOrderItemCount.mockResolvedValue(1);
    receiptCreate.mockResolvedValue({ id: "receipt-1" });
    logisticsPicFindFirst.mockResolvedValue({ id: "pic-1", name: "PIC 1" });
  });

  it("records a partial receipt with an atomic remaining-quantity guard", async () => {
    const result = await recordMektekLogisticsReceipt({
      purchaseOrderItemId: "item-1",
      picId: "pic-1",
      deliveryNoteNumber: "sj-001",
      quantity: 5,
      receivedAt: "2026-07-10",
    });

    expect(result).toEqual(
      expect.objectContaining({
        data: expect.objectContaining({
          purchaseOrderStatus: "OPEN",
          itemProgress: expect.objectContaining({
            receivedQuantity: 5,
            remainingQuantity: 5,
            status: "OPEN",
          }),
        }),
      }),
    );
    expect(purchaseOrderItemUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "item-1",
          status: "OPEN",
          receivedQuantity: { lte: 5 },
        }),
        data: {
          receivedQuantity: { increment: 5 },
          status: "OPEN",
        },
      }),
    );
    expect(receiptCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          deliveryNoteNumber: "SJ-001",
          picId: "pic-1",
        }),
      }),
    );
  });

  it("rejects a receipt when its PIC is missing or inactive", async () => {
    logisticsPicFindFirst.mockResolvedValueOnce(null);

    const result = await recordMektekLogisticsReceipt({
      purchaseOrderItemId: "item-1",
      picId: "inactive-pic",
      deliveryNoteNumber: "SJ-002",
      quantity: 1,
      receivedAt: "2026-07-10",
    });

    expect(result).toEqual({ error: "PIC tidak aktif atau tidak ditemukan" });
    expect(purchaseOrderItemUpdateMany).not.toHaveBeenCalled();
    expect(receiptCreate).not.toHaveBeenCalled();
  });

  it("rejects over-receipt before changing any quantity", async () => {
    purchaseOrderItemFindUnique.mockResolvedValueOnce({
      id: "item-1",
      orderedQuantity: 10,
      receivedQuantity: 5,
      status: "OPEN",
      purchaseOrder: {
        id: "po-1",
        poNumber: "PO-001",
        inputDate: new Date("2026-07-01T00:00:00.000Z"),
      },
    });

    const result = await recordMektekLogisticsReceipt({
      purchaseOrderItemId: "item-1",
      picId: "pic-1",
      deliveryNoteNumber: "SJ-002",
      quantity: 6,
      receivedAt: "2026-07-10",
    });

    expect(result).toEqual({ error: "QTY Masuk melebihi QTY Sisa (5)" });
    expect(purchaseOrderItemUpdateMany).not.toHaveBeenCalled();
    expect(receiptCreate).not.toHaveBeenCalled();
  });

  it("closes the parent PO after the final open item is fully received", async () => {
    purchaseOrderItemCount.mockResolvedValueOnce(0);

    const result = await recordMektekLogisticsReceipt({
      purchaseOrderItemId: "item-1",
      picId: "pic-1",
      deliveryNoteNumber: "SJ-003",
      quantity: 10,
      receivedAt: "2026-07-10",
    });

    expect(result).toEqual(
      expect.objectContaining({
        data: expect.objectContaining({
          purchaseOrderStatus: "CLOSED",
          itemProgress: expect.objectContaining({ status: "CLOSED" }),
        }),
      }),
    );
    expect(purchaseOrderUpdate).toHaveBeenLastCalledWith({
      where: { id: "po-1" },
      data: { status: "CLOSED" },
    });
  });

  it("returns a clear error when the same delivery note is entered twice", async () => {
    receiptCreate.mockRejectedValueOnce({ code: "P2002" });

    const result = await recordMektekLogisticsReceipt({
      purchaseOrderItemId: "item-1",
      picId: "pic-1",
      deliveryNoteNumber: "sj-004",
      quantity: 5,
      receivedAt: "2026-07-10",
    });

    expect(result).toEqual({
      error: "Surat Jalan SJ-004 sudah pernah diinput untuk item ini",
    });
  });

  it("normalizes and rejects a duplicate PO number", async () => {
    purchaseOrderCreate.mockRejectedValueOnce({ code: "P2002" });

    const result = await createMektekLogisticsPurchaseOrder({
      poNumber: " po-001 ",
      supplierName: "Supplier A",
      userName: "PT XXX",
      projectName: "Project X",
      inputDate: "2026-07-01",
      dueDate: "2026-07-10",
      poType: "Normal",
      items: [{ partName: "Compressor", orderedQuantity: 10 }],
    });

    expect(result).toEqual({ error: "PO No. PO-001 sudah terdaftar" });
  });

  it("rejects a PO type outside Normal and Consignment", async () => {
    const result = await createMektekLogisticsPurchaseOrder({
      poNumber: "PO-INVALID-TYPE",
      supplierName: "Supplier A",
      userName: "PT XXX",
      projectName: "Project X",
      inputDate: "2026-07-01",
      dueDate: "2026-07-10",
      poType: "Urgent",
      items: [{ partName: "Compressor", orderedQuantity: 10 }],
    });

    expect(result).toEqual({ error: "PO Type harus Normal atau Consignment" });
    expect(purchaseOrderCreate).not.toHaveBeenCalled();
  });

  it("creates every ordered Part even when nothing has arrived yet", async () => {
    purchaseOrderCreate.mockResolvedValueOnce({
      id: "po-2",
      poNumber: "PO-002",
      items: [],
    });

    await createMektekLogisticsPurchaseOrder({
      poNumber: "PO-002",
      supplierName: "Supplier A",
      userName: "PT XXX",
      projectName: "Project X",
      inputDate: "2026-07-01",
      dueDate: "2026-07-10",
      poType: "Normal",
      items: [
        { partName: "Compressor", orderedQuantity: 10 },
        { partName: "Aki", orderedQuantity: 10 },
        { partName: "Baterai", orderedQuantity: 10 },
      ],
    });

    expect(purchaseOrderCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          items: {
            create: [
              expect.objectContaining({ position: 1, partName: "Compressor" }),
              expect.objectContaining({ position: 2, partName: "Aki" }),
              expect.objectContaining({ position: 3, partName: "Baterai" }),
            ],
          },
        }),
      }),
    );
  });
});
