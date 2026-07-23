jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
jest.mock("@/lib/session", () => ({ getServerSession: jest.fn() }));
jest.mock("@/lib/auth", () => ({ authOptions: {} }));
jest.mock("@/lib/mektek/permissions", () => ({
  canManageMektekLogistics: jest.fn(() => true),
}));
jest.mock("@/lib/mektek/catalog-stock-ledger", () => ({
  applyCatalogStockMovement: jest.fn(),
}));
jest.mock("@/lib/mektek/finance-sync", () => ({
  ensureFinanceCounterparty: jest.fn(async () => ({ id: "finance-counterparty-1" })),
  syncOutboundDispatchBillingSource: jest.fn(async () => null),
  syncReceivingPayableSource: jest.fn(async () => null),
}));

const purchaseOrderCreate = jest.fn();
const purchaseOrderFindUnique = jest.fn();
const purchaseOrderUpdate = jest.fn();
const purchaseOrderUpdateMany = jest.fn();
const purchaseOrderItemCreate = jest.fn();
const purchaseOrderItemUpdate = jest.fn();
const purchaseOrderItemUpdateMany = jest.fn();
const purchaseOrderItemCount = jest.fn();
const receiptCreate = jest.fn();
const receiptFindFirst = jest.fn();
const logisticsPicFindFirst = jest.fn();
const catalogItemFindMany = jest.fn();
const catalogItemFindFirst = jest.fn();
const catalogItemCreate = jest.fn();
const transaction = jest.fn();
const supplyAllocationFindMany = jest.fn();
const supplyAllocationCreate = jest.fn();
const supplyAllocationUpdateMany = jest.fn();
const financeApprovalCreate = jest.fn();
const financeAuditEventCreate = jest.fn();

const transactionClient = {
  logisticsPurchaseOrder: {
    create: purchaseOrderCreate,
    findUnique: purchaseOrderFindUnique,
    update: purchaseOrderUpdate,
    updateMany: purchaseOrderUpdateMany,
  },
  logisticsPurchaseOrderItem: {
    create: purchaseOrderItemCreate,
    update: purchaseOrderItemUpdate,
    updateMany: purchaseOrderItemUpdateMany,
    count: purchaseOrderItemCount,
  },
  logisticsReceipt: {
    create: receiptCreate,
    findFirst: receiptFindFirst,
  },
  logisticsPic: { findFirst: logisticsPicFindFirst },
  catalogItem: {
    findMany: catalogItemFindMany,
    findFirst: catalogItemFindFirst,
    create: catalogItemCreate,
  },
  logisticsSupplyAllocation: {
    findMany: supplyAllocationFindMany,
    create: supplyAllocationCreate,
    updateMany: supplyAllocationUpdateMany,
  },
  financeApproval: { create: financeApprovalCreate },
  financeAuditEvent: { create: financeAuditEventCreate },
};

jest.mock("@/lib/prisma", () => ({
  prismadb: {
    $transaction: transaction,
    logisticsPurchaseOrder: {
      count: jest.fn(),
      findMany: jest.fn(),
      groupBy: jest.fn(),
    },
    logisticsPurchaseOrderItem: { aggregate: jest.fn() },
  },
}));

import {
  createMektekOutboundPurchaseOrder,
  createMektekReceivingPurchaseOrder,
  recordMektekOutboundPurchaseOrderDispatch,
  recordMektekReceivingPurchaseOrderReceipt,
} from "@/actions/mektek/logistics";
import { applyCatalogStockMovement } from "@/lib/mektek/catalog-stock-ledger";
import { buildAutomaticDeliveryNoteNumber } from "@/lib/mektek/logistics";
import { canManageMektekLogistics } from "@/lib/mektek/permissions";
import { getServerSession } from "@/lib/session";

const catalogRows = [
  {
    id: "catalog-1",
    description: "Compressor",
    partNumber: "CMP-001",
    catalogPartNumber: null,
    rearStock: 10,
    frontStock: 4,
  },
  {
    id: "catalog-2",
    description: "Filter",
    partNumber: "FLT-002",
    catalogPartNumber: null,
    rearStock: 8,
    frontStock: 3,
  },
];

describe("MekTek Logistics and Receiving actions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (canManageMektekLogistics as jest.Mock).mockReturnValue(true);
    purchaseOrderItemCreate.mockReset();
    purchaseOrderItemUpdate.mockResolvedValue({ id: "po-item-1" });
    receiptCreate.mockReset();
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { id: "admin-id", userStatus: "ACTIVE" },
    });
    transaction.mockImplementation(async (callback) => callback(transactionClient));
    catalogItemFindMany.mockResolvedValue(catalogRows);
    catalogItemFindFirst.mockResolvedValue(null);
    catalogItemCreate.mockResolvedValue({
      id: "manual-catalog-1",
      description: "Seal Kit Custom",
      partNumber: "SK-CUSTOM-01",
    });
    receiptFindFirst.mockResolvedValue(null);
    supplyAllocationFindMany.mockResolvedValue([]);
    supplyAllocationCreate.mockResolvedValue({ id: "allocation-1" });
    supplyAllocationUpdateMany.mockResolvedValue({ count: 0 });
    financeApprovalCreate.mockResolvedValue({ id: "approval-1" });
    financeAuditEventCreate.mockResolvedValue({ id: "audit-1" });
    purchaseOrderCreate.mockResolvedValue({
      id: "po-1",
      poNumber: "PO-001",
      deliveryNoteNumber: "SJ-PO-001",
    });
    purchaseOrderItemCreate
      .mockResolvedValueOnce({ id: "po-item-1" })
      .mockResolvedValueOnce({ id: "po-item-2" });
    logisticsPicFindFirst.mockResolvedValue({ id: "pic-1", name: "PIC 1" });
    purchaseOrderUpdate.mockResolvedValue({ id: "po-1" });
    purchaseOrderItemUpdateMany.mockResolvedValue({ count: 1 });
    purchaseOrderItemCount.mockResolvedValue(1);
    receiptCreate
      .mockResolvedValueOnce({ id: "receipt-1" })
      .mockResolvedValueOnce({ id: "receipt-2" });
  });

  it("checks the assigned Logistics area before mutating either PO flow", async () => {
    (canManageMektekLogistics as jest.Mock).mockImplementation(
      (_user, area) => area === "MONITORING_PO",
    );
    const receivingResult = await createMektekReceivingPurchaseOrder({
      poNumber: "PO-RCV-DENIED",
      supplierName: "Supplier",
      projectName: "Project",
      inputDate: "2026-07-10",
      dueDate: "2026-07-20",
      poType: "Normal",
      items: [{ catalogItemId: "catalog-1", orderedQuantity: 1 }],
    });

    expect(receivingResult).toEqual({
      error: "Forbidden: akses Logistics Receiving diperlukan",
    });
    expect(canManageMektekLogistics).toHaveBeenCalledWith(
      expect.any(Object),
      "RECEIVING",
    );
    expect(transaction).not.toHaveBeenCalled();

    jest.clearAllMocks();
    (canManageMektekLogistics as jest.Mock).mockImplementation(
      (_user, area) => area === "RECEIVING",
    );
    const outboundResult = await createMektekOutboundPurchaseOrder({
      poNumber: "PO-OUT-DENIED",
      userName: "User",
      projectName: "Project",
      inputDate: "2026-07-10",
      dueDate: "2026-07-20",
      poType: "Normal",
      items: [{ catalogItemId: "catalog-1", orderedQuantity: 1 }],
    });

    expect(outboundResult).toEqual({
      error: "Forbidden: akses Logistics Monitoring PO diperlukan",
    });
    expect(canManageMektekLogistics).toHaveBeenCalledWith(
      expect.any(Object),
      "MONITORING_PO",
    );
    expect(transaction).not.toHaveBeenCalled();
  });

  it("creates an outbound PO without dispatching stock before Barang Keluar", async () => {
    const result = await createMektekOutboundPurchaseOrder({
      poNumber: "po-001",
      userName: "PT User",
      projectName: "Project A",
      inputDate: "2026-07-10",
      dueDate: "2026-07-20",
      poType: "Normal",
      items: [
        {
          catalogItemId: "catalog-1",
          orderedQuantity: 3,
          note: "Unit A",
        },
        {
          catalogItemId: "catalog-2",
          orderedQuantity: 2,
        },
      ],
    });

    expect(result).toEqual(expect.objectContaining({ data: expect.any(Object) }));
    const createInput = purchaseOrderCreate.mock.calls[0][0];
    expect(createInput).toEqual(
      expect.objectContaining({
        data: expect.objectContaining({
          flow: "OUTBOUND",
          poNumber: "PO-001",
          supplierName: "PT. Mektek Tanjung Lestari",
        }),
      }),
    );
    expect(createInput.data).not.toHaveProperty("deliveryNoteNumber");
    expect(purchaseOrderItemCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        source: "CATALOG",
        catalogItemId: "catalog-1",
        warehouse: null,
        orderedQuantity: 3,
      }),
    });
    expect(applyCatalogStockMovement).not.toHaveBeenCalled();
  });

  it("rejects duplicate Catalog lines before mutating stock", async () => {
    const result = await createMektekOutboundPurchaseOrder({
      poNumber: "PO-DUP",
      userName: "PT User",
      projectName: "Project A",
      inputDate: "2026-07-10",
      dueDate: "2026-07-20",
      poType: "Normal",
      items: [
        { catalogItemId: "catalog-1", orderedQuantity: 1 },
        { catalogItemId: "catalog-1", orderedQuantity: 1 },
      ],
    });

    expect(result).toEqual({
      error: "Item Catalog tidak boleh dipilih lebih dari satu kali",
    });
    expect(transaction).not.toHaveBeenCalled();
    expect(applyCatalogStockMovement).not.toHaveBeenCalled();
  });

  it("creates an outbound PO with a manual item snapshot without changing Catalog stock", async () => {
    const result = await createMektekOutboundPurchaseOrder({
      poNumber: "PO-MANUAL-001",
      userName: "PT User",
      projectName: "Project A",
      inputDate: "2026-07-10",
      dueDate: "2026-07-20",
      poType: "Normal",
      items: [
        {
          source: "MANUAL",
          partName: "Bracket Custom",
          partNumber: "BR-CUSTOM-01",
          orderedQuantity: 2,
          note: "Pesanan non-Catalog",
        },
      ],
    });

    expect(result).toEqual(expect.objectContaining({ data: expect.any(Object) }));
    expect(purchaseOrderItemCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        source: "MANUAL",
        catalogItemId: null,
        warehouse: null,
        partName: "Bracket Custom",
        partNumber: "BR-CUSTOM-01",
        orderedQuantity: 2,
      }),
    });
    expect(applyCatalogStockMovement).not.toHaveBeenCalled();
  });

  it("records a partial outbound batch and only subtracts the dispatched quantity", async () => {
    purchaseOrderFindUnique.mockResolvedValue({
      id: "outbound-1",
      poNumber: "PO-OUT-001",
      flow: "OUTBOUND",
      inputDate: new Date("2026-07-01T00:00:00.000Z"),
      items: [
        {
          id: "outbound-item-1",
          catalogItemId: "catalog-1",
          source: "CATALOG",
          orderedQuantity: 10,
          receivedQuantity: 0,
          status: "OPEN",
        },
      ],
    });

    const result = await recordMektekOutboundPurchaseOrderDispatch({
      purchaseOrderId: "outbound-1",
      picId: "pic-1",
      dispatchedAt: "2026-07-12",
      deliveryNoteNumber: "sj-0001",
      items: [
        {
          purchaseOrderItemId: "outbound-item-1",
          quantity: 5,
          warehouse: "REAR",
          note: "Dikirim sebagian",
        },
      ],
    });

    expect(result).toEqual(
      expect.objectContaining({
        data: expect.objectContaining({
          purchaseOrderStatus: "OPEN",
          dispatchReference: "SJ-0001",
          itemProgresses: [
            expect.objectContaining({
              orderedQuantity: 10,
              receivedQuantity: 5,
              remainingQuantity: 5,
            }),
          ],
        }),
      }),
    );
    expect(receiptCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        receivingReference: "SJ-0001",
        quantity: 5,
        warehouse: "REAR",
        note: "Dikirim sebagian",
      }),
    });
    expect(applyCatalogStockMovement).toHaveBeenCalledWith(
      transactionClient,
      expect.objectContaining({
        catalogItemId: "catalog-1",
        warehouse: "REAR",
        direction: "OUT",
        quantity: 5,
        source: "OUTBOUND_PO",
        sourceId: "receipt-1",
        preventNegativeStock: true,
      }),
    );
  });

  it("requires a unique Surat Jalan number for every outbound batch", async () => {
    const missing = await recordMektekOutboundPurchaseOrderDispatch({
      purchaseOrderId: "outbound-1",
      picId: "pic-1",
      dispatchedAt: "2026-07-12",
      deliveryNoteNumber: "",
      items: [
        {
          purchaseOrderItemId: "outbound-item-1",
          quantity: 1,
          warehouse: "REAR",
        },
      ],
    });

    expect(missing).toEqual({ error: "Nomor Surat Jalan wajib diisi" });
    expect(transaction).not.toHaveBeenCalled();

    purchaseOrderFindUnique.mockResolvedValue({
      id: "outbound-1",
      poNumber: "PO-OUT-001",
      flow: "OUTBOUND",
      inputDate: new Date("2026-07-01T00:00:00.000Z"),
      items: [
        {
          id: "outbound-item-1",
          catalogItemId: "catalog-1",
          source: "CATALOG",
          orderedQuantity: 10,
          receivedQuantity: 0,
          status: "OPEN",
        },
      ],
    });
    receiptFindFirst.mockResolvedValueOnce({ id: "existing-receipt" });

    const duplicate = await recordMektekOutboundPurchaseOrderDispatch({
      purchaseOrderId: "outbound-1",
      picId: "pic-1",
      dispatchedAt: "2026-07-12",
      deliveryNoteNumber: "SJ-0001",
      items: [
        {
          purchaseOrderItemId: "outbound-item-1",
          quantity: 1,
          warehouse: "REAR",
        },
      ],
    });

    expect(duplicate).toEqual({
      error: "Nomor Surat Jalan SJ-0001 sudah digunakan",
    });
    expect(receiptCreate).not.toHaveBeenCalled();
  });

  it("creates a Receiving PO from Catalog snapshots without changing stock", async () => {
    purchaseOrderCreate.mockResolvedValueOnce({
      id: "receiving-1",
      poNumber: "RCV-PO-001",
      items: [],
    });
    const result = await createMektekReceivingPurchaseOrder({
      poNumber: "RCV-PO-001",
      supplierName: "Supplier A",
      projectName: "Workshop",
      inputDate: "2026-07-10",
      dueDate: "2026-07-20",
      poType: "Normal",
      items: [{ catalogItemId: "catalog-1", orderedQuantity: 5 }],
    });

    expect(result).toEqual(expect.objectContaining({ data: expect.any(Object) }));
    expect(purchaseOrderCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          flow: "RECEIVING",
          userName: "PT. Mektek Tanjung Lestari",
          items: {
            create: [
              expect.objectContaining({
                catalogItemId: "catalog-1",
                partName: "Compressor",
                partNumber: "CMP-001",
              }),
            ],
          },
        }),
      }),
    );
    expect(applyCatalogStockMovement).not.toHaveBeenCalled();
  });

  it("creates and links a Catalog item for a manual Receiving row", async () => {
    purchaseOrderCreate.mockResolvedValueOnce({
      id: "receiving-manual-1",
      poNumber: "RCV-MANUAL-001",
      items: [],
    });

    const result = await createMektekReceivingPurchaseOrder({
      poNumber: "RCV-MANUAL-001",
      supplierName: "Supplier A",
      projectName: "Workshop",
      inputDate: "2026-07-10",
      dueDate: "2026-07-20",
      poType: "Normal",
      items: [
        {
          source: "MANUAL",
          partName: "Seal Kit Custom",
          partNumber: "SK-CUSTOM-01",
          orderedQuantity: 3,
        },
      ],
    });

    expect(result).toEqual(expect.objectContaining({ data: expect.any(Object) }));
    expect(purchaseOrderCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          flow: "RECEIVING",
          items: {
            create: [
              expect.objectContaining({
                source: "MANUAL",
                catalogItemId: "manual-catalog-1",
                partName: "Seal Kit Custom",
                partNumber: "SK-CUSTOM-01",
                orderedQuantity: 3,
              }),
            ],
          },
        }),
      }),
    );
    expect(catalogItemCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        id: expect.stringMatching(/^manual-receiving-/),
        machine: "Receiving",
        rowNumber: 0,
        description: "Seal Kit Custom",
        partNumber: "SK-CUSTOM-01",
        rearStock: 0,
        frontStock: 0,
      }),
      select: expect.objectContaining({ id: true }),
    });
    expect(applyCatalogStockMovement).not.toHaveBeenCalled();
  });

  it("requires item name and part number for manual Receiving rows", async () => {
    const result = await createMektekReceivingPurchaseOrder({
      poNumber: "RCV-MANUAL-INVALID",
      supplierName: "Supplier A",
      projectName: "Workshop",
      inputDate: "2026-07-10",
      dueDate: "2026-07-20",
      poType: "Normal",
      items: [
        {
          source: "MANUAL",
          partName: "Seal Kit Custom",
          partNumber: "",
          orderedQuantity: 3,
        },
      ],
    });

    expect(result).toEqual({
      error: "Part Number manual baris 1 wajib diisi",
    });
    expect(transaction).not.toHaveBeenCalled();
  });

  it("records Receiving without a delivery-note input and adds stock per item", async () => {
    purchaseOrderFindUnique.mockResolvedValue({
      id: "receiving-1",
      poNumber: "RCV-PO-001",
      flow: "RECEIVING",
      inputDate: new Date("2026-07-01T00:00:00.000Z"),
      items: [
        {
          id: "receiving-item-1",
          catalogItemId: "catalog-1",
          orderedQuantity: 5,
          receivedQuantity: 0,
          status: "OPEN",
        },
      ],
    });
    purchaseOrderItemCount.mockResolvedValueOnce(0);

    const result = await recordMektekReceivingPurchaseOrderReceipt({
      purchaseOrderId: "receiving-1",
      picId: "pic-1",
      receivedAt: "2026-07-12",
      items: [
        {
          purchaseOrderItemId: "receiving-item-1",
          quantity: 5,
          warehouse: "FRONT",
          note: "Kondisi baik",
        },
      ],
    });

    expect(result).toEqual(
      expect.objectContaining({
        data: expect.objectContaining({ purchaseOrderStatus: "CLOSED" }),
      }),
    );
    expect(receiptCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        receivingReference: expect.stringMatching(/^RCV-RCV-PO-001-/),
        warehouse: "FRONT",
        note: "Kondisi baik",
      }),
    });
    expect(applyCatalogStockMovement).toHaveBeenCalledWith(
      transactionClient,
      expect.objectContaining({
        catalogItemId: "catalog-1",
        direction: "IN",
        source: "RECEIVING",
        sourceId: "receipt-1",
        warehouse: "FRONT",
      }),
    );
  });

  it("adds manual Receiving stock to its automatically linked Catalog item", async () => {
    purchaseOrderFindUnique.mockResolvedValue({
      id: "receiving-manual-1",
      poNumber: "RCV-MANUAL-001",
      flow: "RECEIVING",
      inputDate: new Date("2026-07-01T00:00:00.000Z"),
      items: [
        {
          id: "receiving-manual-item-1",
          source: "MANUAL",
          catalogItemId: null,
          partName: "Seal Kit Custom",
          partNumber: "SK-CUSTOM-01",
          orderedQuantity: 3,
          receivedQuantity: 0,
          status: "OPEN",
        },
      ],
    });
    purchaseOrderItemCount.mockResolvedValueOnce(0);

    const result = await recordMektekReceivingPurchaseOrderReceipt({
      purchaseOrderId: "receiving-manual-1",
      picId: "pic-1",
      receivedAt: "2026-07-12",
      items: [
        {
          purchaseOrderItemId: "receiving-manual-item-1",
          quantity: 3,
          warehouse: "REAR",
          note: "Barang manual diterima",
        },
      ],
    });

    expect(result).toEqual(
      expect.objectContaining({
        data: expect.objectContaining({ purchaseOrderStatus: "CLOSED" }),
      }),
    );
    expect(receiptCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        purchaseOrderItemId: "receiving-manual-item-1",
        note: "Barang manual diterima",
      }),
    });
    expect(purchaseOrderItemUpdate).toHaveBeenCalledWith({
      where: { id: "receiving-manual-item-1" },
      data: { catalogItemId: "manual-catalog-1" },
    });
    expect(applyCatalogStockMovement).toHaveBeenCalledWith(
      transactionClient,
      expect.objectContaining({
        catalogItemId: "manual-catalog-1",
        direction: "IN",
        source: "RECEIVING",
        sourceId: "receipt-1",
        warehouse: "REAR",
      }),
    );
  });

  it("does not accept an outbound PO in the Receiving mutation", async () => {
    purchaseOrderFindUnique.mockResolvedValueOnce({
      id: "po-1",
      flow: "OUTBOUND",
      items: [],
    });
    const result = await recordMektekReceivingPurchaseOrderReceipt({
      purchaseOrderId: "po-1",
      picId: "pic-1",
      receivedAt: "2026-07-12",
      items: [
        {
          purchaseOrderItemId: "item-1",
          quantity: 1,
          warehouse: "REAR",
        },
      ],
    });
    expect(result).toEqual({ error: "Purchase Order Receiving tidak ditemukan" });
    expect(receiptCreate).not.toHaveBeenCalled();
  });

  it("builds a normalized automatic delivery-note number", () => {
    expect(buildAutomaticDeliveryNoteNumber(" po / 99 ")).toBe("SJ-PO / 99");
  });
});
