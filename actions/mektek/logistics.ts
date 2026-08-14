"use server";

import { randomUUID } from "node:crypto";
import type {
  CatalogWarehouse,
  LogisticsPurchaseOrderFlow,
  LogisticsPurchaseOrderStatus,
  Prisma,
} from "@prisma/client";
import { revalidatePath } from "next/cache";

import { authOptions } from "@/lib/auth";
import type { LogisticsStaffArea } from "@/lib/auth/logistics-staff-areas";
import { getCatalogInventoryLocalDateKey } from "@/lib/mektek/catalog-inventory";
import {
  applyCatalogConsignmentSiteStock,
  applyCatalogStockMovement,
} from "@/lib/mektek/catalog-stock-ledger";
import {
  ensureFinanceCounterparty,
  syncOutboundDispatchBillingSource,
  syncReceivingPayableSource,
} from "@/lib/mektek/finance-sync";
import { ensurePaymentFakturCustomer } from "@/lib/mektek/payment-faktur-sync";
import { normalizeFinanceKey } from "@/lib/mektek/finance";
import {
  isLogisticsPurchaseOrderType,
  normalizeLogisticsReference,
  validateLogisticsReceipt,
} from "@/lib/mektek/logistics";
import { canManageMektekLogistics } from "@/lib/mektek/permissions";
import { boundedText } from "@/lib/mektek/sanitize";
import { prismadb } from "@/lib/prisma";
import { getServerSession } from "@/lib/session";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PO_NUMBER_LEN = 80;
const MAX_NAME_LEN = 160;
const MAX_PO_TYPE_LEN = 60;
const MAX_NOTE_LEN = 500;
const MAX_PART_NUMBER_LEN = 120;
const MAX_DELIVERY_NOTE_NUMBER_LEN = 100;
const MAX_ITEMS_PER_PO = 100;
const MEKTEK_COMPANY_NAME = "PT. Mektek Tanjung Lestari";

export type LogisticsCatalogItemInput = {
  catalogItemId: string;
  orderedQuantity: string | number;
  unitPrice?: string | number;
  agreedUnitPrice?: string | number;
  warehouse?: CatalogWarehouse;
  note?: string;
};

type LogisticsPurchaseOrderHeaderInput = {
  poNumber: string;
  userName: string;
  projectName: string;
  inputDate: string;
  dueDate: string;
  poType: string;
  poMode?: "MANUAL" | "CONSIGNMENT";
  notes?: string;
};

export type MektekReceivingPurchaseOrderInput =
  Omit<LogisticsPurchaseOrderHeaderInput, "userName"> & {
    supplierName: string;
    items: MektekReceivingPurchaseOrderItemInput[];
  };

type LogisticsManualItemInput = {
  source: "MANUAL";
  catalogItemId?: string;
  partName: string;
  partNumber: string;
  machine?: string;
  warehouse?: CatalogWarehouse;
  orderedQuantity: string | number;
  unitPrice?: string | number;
  agreedUnitPrice?: string | number;
  note?: string;
};

export type MektekReceivingPurchaseOrderItemInput =
  | (LogisticsCatalogItemInput & { source?: "CATALOG" })
  | LogisticsManualItemInput;

export type MektekOutboundPurchaseOrderItemInput =
  | (LogisticsCatalogItemInput & { source?: "CATALOG" })
  | LogisticsManualItemInput;

export type MektekOutboundPurchaseOrderInput =
  LogisticsPurchaseOrderHeaderInput & {
    items: MektekOutboundPurchaseOrderItemInput[];
  };

export type MektekOutboundPurchaseOrderUpdateInput =
  LogisticsPurchaseOrderHeaderInput & {
    purchaseOrderId: string;
    items: Array<{
      purchaseOrderItemId: string;
      orderedQuantity: string | number;
      note?: string;
    }>;
  };

export type MektekReceivingPurchaseOrderUpdateInput =
  Omit<MektekReceivingPurchaseOrderInput, "items"> & {
    purchaseOrderId: string;
    items: Array<{
      purchaseOrderItemId?: string;
      source?: "CATALOG" | "MANUAL";
      catalogItemId?: string;
      partName?: string;
      partNumber?: string;
      machine?: string;
      orderedQuantity: string | number;
      unitPrice?: string | number;
      agreedUnitPrice?: string | number;
      warehouse?: CatalogWarehouse;
      note?: string;
    }>;
  };

type NormalizedPurchaseOrderLine =
  | {
      source: "CATALOG";
      position: number;
      catalogItemId: string;
      orderedQuantity: number;
      unitPrice: string | null;
      agreedUnitPrice: string | null;
      warehouse: CatalogWarehouse | null;
      note: string | null;
    }
  | {
      source: "MANUAL";
      position: number;
      catalogItemId: null;
      partName: string;
      partNumber: string | null;
      machine: string | null;
      orderedQuantity: number;
      unitPrice: string | null;
      agreedUnitPrice: string | null;
      warehouse: CatalogWarehouse | null;
      note: string | null;
    };

export type MektekReceivingReceiptInput = {
  purchaseOrderId: string;
  picId: string;
  receivedAt: string;
  items: Array<{
    purchaseOrderItemId: string;
    quantity: string | number;
    warehouse: CatalogWarehouse;
    note?: string;
  }>;
};

export type MektekOutboundDispatchInput = {
  purchaseOrderId: string;
  picId: string;
  dispatchedAt: string;
  items: Array<{
    purchaseOrderItemId: string;
    quantity: string | number;
    warehouse: CatalogWarehouse;
    note?: string;
  }>;
};

export type MektekOutboundDispatchRevisionInput = {
  purchaseOrderId: string;
  dispatchReference: string;
  picId: string;
  dispatchedAt: string;
  items: Array<{
    receiptId: string;
    quantity: string | number;
    warehouse: CatalogWarehouse;
    note?: string;
  }>;
};

class LogisticsActionError extends Error {}

const LOGISTICS_TRANSACTION_OPTIONS = {
  maxWait: 20_000,
  timeout: 60_000,
} as const;

function getTransactionRetryMessage(
  error: unknown,
  operation: "Barang Keluar" | "Receiving",
) {
  const code =
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
      ? error.code
      : null;
  const message = error instanceof Error ? error.message : "";

  if (
    code === "P2028" ||
    /transaction.*(?:closed|expired|timed?\s*out|timeout)/i.test(message)
  ) {
    return `Transaksi ${operation} melewati batas waktu. Silakan coba simpan kembali.`;
  }
  if (code === "P2034") {
    return `Data ${operation} sedang diproses pengguna lain. Muat ulang halaman lalu coba kembali.`;
  }
  return null;
}

async function ensureLogisticsManager(area: LogisticsStaffArea) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { error: "Unauthorized: silakan Login" } as const;
  if (!canManageMektekLogistics(session.user, area)) {
    return {
      error: `Forbidden: akses Logistics ${area === "RECEIVING" ? "Receiving" : "Monitoring PO"} diperlukan`,
    } as const;
  }
  return { session } as const;
}

function compactText(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function parsePositiveInteger(value: unknown) {
  const text = compactText(value);
  if (!/^\d+$/.test(text)) return null;
  const parsed = Number(text);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function parsePositiveUnitPrice(value: unknown) {
  const text = compactText(value);
  if (!/^\d{1,16}(?:\.\d{1,2})?$/.test(text)) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) && parsed > 0 ? parsed.toFixed(2) : null;
}

function parseDateOnly(value: unknown) {
  const text = compactText(value);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date;
}

function isPrismaUniqueError(error: unknown) {
  return (
    !!error &&
    typeof error === "object" &&
    "code" in error &&
    error.code === "P2002"
  );
}

function isWarehouse(value: unknown): value is CatalogWarehouse {
  return value === "REAR" || value === "FRONT";
}

function normalizeHeader(
  input: LogisticsPurchaseOrderHeaderInput,
  supplierValue: unknown,
) {
  const poNumber = normalizeLogisticsReference(
    boundedText(input?.poNumber, MAX_PO_NUMBER_LEN),
  );
  const supplierName = boundedText(supplierValue, MAX_NAME_LEN);
  const userName = boundedText(input?.userName, MAX_NAME_LEN);
  const projectName = boundedText(input?.projectName, MAX_NAME_LEN);
  const requestedMode = input?.poMode ?? (compactText(input?.poType).toLowerCase() === "consignment" ? "CONSIGNMENT" : "MANUAL");
  const poType = requestedMode === "CONSIGNMENT" ? "Consignment" : "Manual";
  const notes = boundedText(input?.notes, MAX_NOTE_LEN);
  const inputDate = parseDateOnly(input?.inputDate);
  const dueDate = parseDateOnly(input?.dueDate);

  if (!poNumber) return { error: "PO No. wajib diisi" } as const;
  if (!supplierName) return { error: "Supplier wajib diisi" } as const;
  if (!userName) return { error: "User / PT wajib diisi" } as const;
  if (!projectName) return { error: "Job Site / Project wajib diisi" } as const;
  if (!isLogisticsPurchaseOrderType(poType)) {
    return { error: "PO Type harus Manual atau Consignment" } as const;
  }
  if (!inputDate) return { error: "Tanggal Input tidak valid" } as const;
  const resolvedDueDate = dueDate ?? inputDate;
  if (resolvedDueDate < inputDate) {
    return { error: "Due Date tidak boleh sebelum Tanggal Input" } as const;
  }
  return {
    data: {
      poNumber,
      supplierName,
      userName,
      projectName,
      inputDate,
      dueDate: resolvedDueDate,
      poType,
      poMode: requestedMode,
      supplyStartDate: inputDate,
      supplyEndDate: resolvedDueDate,
      notes: notes || null,
    },
  } as const;
}

function normalizePurchaseOrderLines(
  rawItems:
    | Array<
        MektekReceivingPurchaseOrderItemInput | MektekOutboundPurchaseOrderItemInput
      >
    | undefined,
  options: {
    requireCatalogWarehouse: boolean;
    requireManualMachine?: boolean;
    requireManualWarehouse?: boolean;
    requireManualUnitPrice?: boolean;
    requireManualPartNumber?: boolean;
    requireUnitPrice?: boolean;
    emptyError: string;
  },
) {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    return { error: options.emptyError } as const;
  }
  if (rawItems.length > MAX_ITEMS_PER_PO) {
    return { error: `Maksimal ${MAX_ITEMS_PER_PO} item dalam satu PO` } as const;
  }

  const seenCatalog = new Set<string>();
  const seenManual = new Set<string>();
  const items: NormalizedPurchaseOrderLine[] = [];
  for (const [index, item] of rawItems.entries()) {
    const orderedQuantity = parsePositiveInteger(item?.orderedQuantity);
    if (!orderedQuantity) {
      return {
        error: `Quantity baris ${index + 1} harus berupa angka bulat lebih dari 0`,
      } as const;
    }
    const note = boundedText(item?.note, MAX_NOTE_LEN) || null;
    const unitPriceText =
      compactText(item?.agreedUnitPrice) || compactText(item?.unitPrice);
    const agreedUnitPriceNumber = unitPriceText ? Number(unitPriceText) : null;
    if (
      options.requireUnitPrice &&
      (agreedUnitPriceNumber == null ||
        !Number.isFinite(agreedUnitPriceNumber) ||
        agreedUnitPriceNumber < 0)
    ) {
      return {
        error: `Harga satuan baris ${index + 1} wajib berupa angka 0 atau lebih`,
      } as const;
    }
    const agreedUnitPrice =
      agreedUnitPriceNumber != null &&
      Number.isFinite(agreedUnitPriceNumber) &&
      agreedUnitPriceNumber >= 0
        ? agreedUnitPriceNumber.toFixed(2)
        : null;

    if (item?.source === "MANUAL") {
      const partName = boundedText(item.partName, MAX_NAME_LEN);
      const partNumber = normalizeLogisticsReference(
        boundedText(item.partNumber, MAX_PART_NUMBER_LEN),
      );
      const machine = boundedText(item.machine, MAX_NAME_LEN);
      if (!partName) {
        return { error: `Nama item manual baris ${index + 1} wajib diisi` } as const;
      }
      if (options.requireManualPartNumber !== false && !partNumber) {
        return { error: `Part Number manual baris ${index + 1} wajib diisi` } as const;
      }
      if (options.requireManualMachine && !machine) {
        return { error: `Machine item manual baris ${index + 1} wajib diisi` } as const;
      }
      if (options.requireManualWarehouse && !isWarehouse(item.warehouse)) {
        return { error: `Gudang tujuan item manual baris ${index + 1} wajib dipilih` } as const;
      }
      const manualUnitPrice = parsePositiveUnitPrice(item.unitPrice);
      if (options.requireManualUnitPrice && !manualUnitPrice) {
        return {
          error: `Harga item manual baris ${index + 1} wajib lebih dari Rp 0`,
        } as const;
      }
      const manualKey = `${partName.toLocaleLowerCase("id-ID")}::${partNumber}`;
      if (seenManual.has(manualKey)) {
        return { error: "Item manual yang sama tidak boleh diduplikasi" } as const;
      }
      seenManual.add(manualKey);
      items.push({
        source: "MANUAL",
        position: index + 1,
        catalogItemId: null,
        partName,
        partNumber: partNumber || null,
        machine: machine || null,
        orderedQuantity,
        unitPrice: manualUnitPrice || agreedUnitPrice,
        agreedUnitPrice: agreedUnitPrice ?? manualUnitPrice,
        warehouse: isWarehouse(item.warehouse) ? item.warehouse : null,
        note,
      });
      continue;
    }

    const catalogItemId = compactText(item?.catalogItemId);
    if (!catalogItemId) {
      return { error: `Item Catalog baris ${index + 1} wajib dipilih` } as const;
    }
    if (seenCatalog.has(catalogItemId)) {
      return { error: "Item Catalog tidak boleh dipilih lebih dari satu kali" } as const;
    }
    if (options.requireCatalogWarehouse && !isWarehouse(item?.warehouse)) {
      return { error: `Gudang baris ${index + 1} wajib dipilih` } as const;
    }
    seenCatalog.add(catalogItemId);
    items.push({
      source: "CATALOG",
      position: index + 1,
      catalogItemId,
      orderedQuantity,
      unitPrice: agreedUnitPrice,
      agreedUnitPrice,
      warehouse: isWarehouse(item?.warehouse) ? item.warehouse : null,
      note,
    });
  }
  return { data: items } as const;
}

async function hydratePurchaseOrderLines(
  tx: Prisma.TransactionClient,
  lines: NormalizedPurchaseOrderLine[],
  requireCatalogPrice = false,
) {
  const catalogIds = lines.flatMap((line) =>
    line.source === "CATALOG" ? [line.catalogItemId] : [],
  );
  const catalogItems = catalogIds.length
    ? await tx.catalogItem.findMany({
        where: { id: { in: catalogIds } },
        select: {
          id: true,
          description: true,
          partNumber: true,
          catalogPartNumber: true,
          machine: true,
          rearStock: true,
          frontStock: true,
          price: true,
        },
      })
    : [];
  const byId = new Map(catalogItems.map((item) => [item.id, item]));

  return lines.map((line) => {
    if (line.source === "MANUAL") return { ...line, catalogItem: null };
    const catalogItem = byId.get(line.catalogItemId);
    if (!catalogItem) {
      throw new LogisticsActionError("Terdapat item Catalog yang tidak ditemukan");
    }
    if (
      requireCatalogPrice &&
      (catalogItem.price === null || catalogItem.price <= 0)
    ) {
      throw new LogisticsActionError(
        `Harga Catalog untuk ${catalogItem.description} belum diisi`,
      );
    }
    return { ...line, catalogItem };
  });
}

async function ensureManualReceivingCatalogItem(
  tx: Prisma.TransactionClient,
  input: {
    partName: string;
    partNumber: string | null;
    machine: string;
    poNumber: string;
  },
) {
  if (input.partNumber) {
    const existing = await tx.catalogItem.findFirst({
      where: {
        OR: [
          {
            partNumber: {
              equals: input.partNumber,
              mode: "insensitive",
            },
          },
          {
            catalogPartNumber: {
              equals: input.partNumber,
              mode: "insensitive",
            },
          },
        ],
      },
      select: { id: true },
    });
    if (existing) return existing;
  }

  // The supplier price (Harga Supplier) is a cost basis, not the selling price.
  // It is persisted on the Receiving PO line as `agreedUnitPrice` and surfaced
  // in the Receiving PDF only. The catalog `price` (Harga Jual) stays null here
  // and must be set manually by logistics in Catalog / Item after the item is
  // received, so selling prices are never silently overwritten by receiving.
  return tx.catalogItem.create({
    data: {
      id: `manual-receiving-${randomUUID()}`,
      machine: input.machine,
      rowNumber: 0,
      description: input.partName,
      partNumber: input.partNumber,
      rearStock: 0,
      frontStock: 0,
      searchText: [
        input.machine,
        input.partName,
        input.partNumber,
      ]
        .join(" ")
        .toLocaleLowerCase("id-ID"),
      remark: `Ditambahkan otomatis dari Receiving PO ${input.poNumber}. Harga jual belum diisi, isi manual di Catalog / Item.`,
    },
    select: { id: true },
  });
}

function logisticsWhere(
  flow: LogisticsPurchaseOrderFlow,
  input?: { query?: string; status?: string },
): Prisma.LogisticsPurchaseOrderWhereInput {
  const query = compactText(input?.query);
  const rawStatus = compactText(input?.status).toUpperCase();
  const status: LogisticsPurchaseOrderStatus | undefined =
    rawStatus === "OPEN" || rawStatus === "CLOSED" ? rawStatus : undefined;
  return {
    flow,
    ...(status ? { status } : {}),
    ...(query
      ? {
          OR: [
            { poNumber: { contains: query, mode: "insensitive" } },
            { deliveryNoteNumber: { contains: query, mode: "insensitive" } },
            { supplierName: { contains: query, mode: "insensitive" } },
            { userName: { contains: query, mode: "insensitive" } },
            { projectName: { contains: query, mode: "insensitive" } },
            { poType: { contains: query, mode: "insensitive" } },
            {
              items: {
                some: {
                  OR: [
                    { partName: { contains: query, mode: "insensitive" } },
                    { partNumber: { contains: query, mode: "insensitive" } },
                    {
                      receipts: {
                        some: {
                          receivingReference: {
                            contains: query,
                            mode: "insensitive",
                          },
                        },
                      },
                    },
                  ],
                },
              },
            },
          ],
        }
      : {}),
  };
}

async function listPurchaseOrders(
  flow: LogisticsPurchaseOrderFlow,
  input?: { query?: string; status?: string; page?: number; pageSize?: number },
) {
  const access = await ensureLogisticsManager(
    flow === "RECEIVING" ? "RECEIVING" : "MONITORING_PO",
  );
  if ("error" in access) return { error: access.error };
  const pageSize = Math.min(
    Math.max(Number(input?.pageSize) || DEFAULT_PAGE_SIZE, 1),
    50,
  );
  const requestedPage = Math.max(Number(input?.page) || 1, 1);
  const where = logisticsWhere(flow, input);
  const totalCount = await prismadb.logisticsPurchaseOrder.count({ where });
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const page = Math.min(requestedPage, totalPages);
  const today =
    parseDateOnly(getCatalogInventoryLocalDateKey()) ??
    new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));

  const [purchaseOrders, statusCounts, quantities, closedQuantities, overdue] =
    await Promise.all([
      prismadb.logisticsPurchaseOrder.findMany({
        where,
        orderBy: [{ status: "asc" }, { dueDate: "asc" }, { updatedAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          items: {
            orderBy: { position: "asc" },
            include: {
              catalogItem: {
                select: {
                  id: true,
                  description: true,
                  rearStock: true,
                  frontStock: true,
                },
              },
              receipts: {
                orderBy: [{ receivedAt: "desc" }, { createdAt: "desc" }],
                select: {
                  id: true,
                  purchaseOrderItemId: true,
                  receivingReference: true,
                  quantity: true,
                  warehouse: true,
                  receivedAt: true,
                  note: true,
                  imageMimeType: true,
                  picId: true,
                  pic: { select: { id: true, name: true } },
                  createdBy: true,
                  createdAt: true,
                },
              },
            },
          },
        },
      }),
      prismadb.logisticsPurchaseOrder.groupBy({
        by: ["status"],
        where: { flow },
        _count: { _all: true },
      }),
      prismadb.logisticsPurchaseOrderItem.aggregate({
        where: { purchaseOrder: { flow } },
        _sum: { orderedQuantity: true, receivedQuantity: true },
      }),
      prismadb.logisticsPurchaseOrderItem.aggregate({
        where: { purchaseOrder: { flow, status: "CLOSED" } },
        _sum: { orderedQuantity: true },
      }),
      prismadb.logisticsPurchaseOrder.count({
        where: { flow, status: "OPEN", dueDate: { lt: today } },
      }),
    ]);

  const openPurchaseOrders =
    statusCounts.find((row) => row.status === "OPEN")?._count._all ?? 0;
  const closedPurchaseOrders =
    statusCounts.find((row) => row.status === "CLOSED")?._count._all ?? 0;
  const totalOrdered = quantities._sum.orderedQuantity ?? 0;
  const totalProcessed =
    flow === "RECEIVING"
      ? quantities._sum.receivedQuantity ?? 0
      : closedQuantities._sum.orderedQuantity ?? 0;
  return {
    data: {
      items: purchaseOrders,
      page,
      pageSize,
      totalCount,
      totalPages,
      stats: {
        openPurchaseOrders,
        closedPurchaseOrders,
        overduePurchaseOrders: overdue,
        totalOrdered,
        totalReceived: totalProcessed,
        totalRemaining: Math.max(0, totalOrdered - totalProcessed),
      },
    },
  };
}

export async function listMektekReceivingPurchaseOrders(input?: {
  query?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}) {
  return listPurchaseOrders("RECEIVING", input);
}

export async function listMektekOutboundPurchaseOrders(input?: {
  query?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}) {
  return listPurchaseOrders("OUTBOUND", input);
}

export async function createMektekReceivingPurchaseOrder(
  input: MektekReceivingPurchaseOrderInput,
) {
  const access = await ensureLogisticsManager("RECEIVING");
  if ("error" in access) return { error: access.error };
  const header = normalizeHeader(
    { ...input, userName: MEKTEK_COMPANY_NAME },
    input?.supplierName,
  );
  if ("error" in header) return { error: header.error };
  const lines = normalizePurchaseOrderLines(input?.items, {
    requireCatalogWarehouse: false,
    requireManualMachine: true,
    requireManualWarehouse: true,
    requireManualUnitPrice: true,
    requireManualPartNumber: false,
    requireUnitPrice: true,
    emptyError: "Minimal satu item Receiving wajib diisi",
  });
  if ("error" in lines) return { error: lines.error };

  try {
    const purchaseOrder = await prismadb.$transaction(async (tx) => {
      const hydrated = await hydratePurchaseOrderLines(tx, lines.data, false);
      const manualCatalogIds = new Map<number, string>();
      for (const line of hydrated) {
        if (line.source !== "MANUAL") continue;
        const catalogItem = await ensureManualReceivingCatalogItem(tx, {
          partName: line.partName,
          partNumber: line.partNumber,
          machine: line.machine!,
          poNumber: header.data.poNumber,
        });
        manualCatalogIds.set(line.position, catalogItem.id);
      }
      return tx.logisticsPurchaseOrder.create({
        data: {
          ...header.data,
          flow: "RECEIVING",
          createdBy: access.session.user.id,
          items: {
            create: hydrated.map((line) =>
              line.source === "MANUAL"
                ? {
                    source: "MANUAL",
                    catalogItemId: manualCatalogIds.get(line.position)!,
                    position: line.position,
                    partName: line.partName,
                    partNumber: line.partNumber,
                    machine: line.machine,
                    orderedQuantity: line.orderedQuantity,
                    agreedUnitPrice: line.unitPrice,
                    warehouse: line.warehouse,
                    note: line.note,
                  }
                : {
                    source: "CATALOG",
                    catalogItemId: line.catalogItem.id,
                    position: line.position,
                    partName: line.catalogItem.description,
                    partNumber:
                      line.catalogItem.partNumber ||
                      line.catalogItem.catalogPartNumber,
                    machine: line.catalogItem.machine,
                    orderedQuantity: line.orderedQuantity,
                    agreedUnitPrice: line.agreedUnitPrice ?? line.unitPrice,
                    note: line.note,
                  },
            ),
          },
        },
        include: { items: true },
      });
    });
    revalidatePath("/[locale]/(routes)/mektek/receiving", "page");
    revalidatePath("/[locale]/(routes)/mektek/items", "page");
    revalidatePath("/[locale]/(routes)/mektek/items/spreadsheet", "page");
    return {
      data: { id: purchaseOrder.id, poNumber: purchaseOrder.poNumber },
    };
  } catch (error) {
    console.log("[CREATE_MEKTEK_RECEIVING_PO]", error);
    if (error instanceof LogisticsActionError) return { error: error.message };
    if (isPrismaUniqueError(error)) {
      return { error: `PO No. ${header.data.poNumber} sudah terdaftar di Receiving` };
    }
    return { error: "Gagal membuat Purchase Order Receiving" };
  }
}

export async function updateMektekReceivingPurchaseOrder(
  input: MektekReceivingPurchaseOrderUpdateInput,
) {
  const access = await ensureLogisticsManager("RECEIVING");
  if ("error" in access) return { error: access.error };
  const purchaseOrderId = compactText(input?.purchaseOrderId);
  if (!purchaseOrderId) return { error: "Purchase Order Receiving tidak ditemukan" };
  const header = normalizeHeader(
    { ...input, userName: MEKTEK_COMPANY_NAME },
    input?.supplierName,
  );
  if ("error" in header) return { error: header.error };
  if (!Array.isArray(input?.items) || input.items.length === 0) {
    return { error: "Minimal satu item Receiving wajib diisi" };
  }

  const existingItemInputs: Array<{
    purchaseOrderItemId: string;
    orderedQuantity: number;
    agreedUnitPrice: string | null;
    warehouse: CatalogWarehouse | null;
    note: string | null;
    index: number;
  }> = [];
  const seenItemIds = new Set<string>();
  const newItemInputs: MektekReceivingPurchaseOrderItemInput[] = [];

  for (const [index, item] of input.items.entries()) {
    const purchaseOrderItemId = compactText(item?.purchaseOrderItemId);
    if (purchaseOrderItemId) {
      if (seenItemIds.has(purchaseOrderItemId)) {
        return { error: `Item baris ${index + 1} diduplikasi` };
      }
      const orderedQuantity = parsePositiveInteger(item?.orderedQuantity);
      if (!orderedQuantity) {
        return {
          error: `Quantity baris ${index + 1} harus berupa angka bulat lebih dari 0`,
        };
      }
      const unitPriceText =
        compactText(item?.agreedUnitPrice) || compactText(item?.unitPrice);
      const unitPriceNumber = unitPriceText ? Number(unitPriceText) : null;
      if (
        unitPriceNumber == null ||
        !Number.isFinite(unitPriceNumber) ||
        unitPriceNumber < 0
      ) {
        return {
          error: `Harga satuan baris ${index + 1} wajib berupa angka 0 atau lebih`,
        };
      }
      const warehouse: CatalogWarehouse | null = isWarehouse(item?.warehouse)
        ? item.warehouse
        : null;
      seenItemIds.add(purchaseOrderItemId);
      existingItemInputs.push({
        purchaseOrderItemId,
        orderedQuantity,
        agreedUnitPrice: unitPriceNumber.toFixed(2),
        warehouse,
        note: boundedText(item?.note, MAX_NOTE_LEN) || null,
        index,
      });
    } else {
      newItemInputs.push(item as MektekReceivingPurchaseOrderItemInput);
    }
  }

  let newLines: NormalizedPurchaseOrderLine[] = [];
  if (newItemInputs.length > 0) {
    const linesResult = normalizePurchaseOrderLines(newItemInputs, {
      requireCatalogWarehouse: false,
      requireManualMachine: true,
      requireManualWarehouse: true,
      requireManualUnitPrice: true,
      requireManualPartNumber: false,
      requireUnitPrice: true,
      emptyError: "Minimal satu item Receiving wajib diisi",
    });
    if ("error" in linesResult) return { error: linesResult.error };
    newLines = linesResult.data;
  }

  try {
    const purchaseOrder = await prismadb.$transaction(async (tx) => {
      const existing = await tx.logisticsPurchaseOrder.findUnique({
        where: { id: purchaseOrderId },
        include: { items: true },
      });
      if (!existing || existing.flow !== "RECEIVING") {
        throw new LogisticsActionError(
          "Purchase Order Receiving tidak ditemukan",
        );
      }

      const existingById = new Map(existing.items.map((item) => [item.id, item]));

      for (const item of existingItemInputs) {
        if (!existingById.has(item.purchaseOrderItemId)) {
          throw new LogisticsActionError(
            `Item baris ${item.index + 1} tidak ditemukan`,
          );
        }
      }

      const deletedItems = existing.items.filter(
        (item) => !seenItemIds.has(item.id),
      );
      for (const item of deletedItems) {
        if (item.receivedQuantity > 0) {
          throw new LogisticsActionError(
            `Item "${item.partName}" tidak dapat dihapus karena sudah memiliki ${item.receivedQuantity} barang masuk`,
          );
        }
      }

      for (const item of existingItemInputs) {
        const current = existingById.get(item.purchaseOrderItemId)!;
        if (item.orderedQuantity < current.receivedQuantity) {
          throw new LogisticsActionError(
            `QTY Order item ${item.index + 1} tidak boleh kurang dari QTY Masuk (${current.receivedQuantity})`,
          );
        }
      }

      const hydratedNewLines = await hydratePurchaseOrderLines(
        tx,
        newLines,
        false,
      );
      const manualCatalogIds = new Map<number, string>();
      for (const line of hydratedNewLines) {
        if (line.source !== "MANUAL") continue;
        const catalogItem = await ensureManualReceivingCatalogItem(tx, {
          partName: line.partName,
          partNumber: line.partNumber,
          machine: line.machine!,
          poNumber: header.data.poNumber,
        });
        manualCatalogIds.set(line.position, catalogItem.id);
      }

      const maxPosition = existing.items.reduce(
        (max, item) => Math.max(max, item.position),
        0,
      );

      for (const item of deletedItems) {
        await tx.logisticsPurchaseOrderItem.delete({
          where: { id: item.id },
        });
      }

      for (const item of existingItemInputs) {
        const current = existingById.get(item.purchaseOrderItemId)!;
        const itemStatus =
          item.orderedQuantity <= current.receivedQuantity
            ? "CLOSED"
            : "OPEN";
        await tx.logisticsPurchaseOrderItem.update({
          where: { id: item.purchaseOrderItemId },
          data: {
            orderedQuantity: item.orderedQuantity,
            agreedUnitPrice: item.agreedUnitPrice,
            warehouse: item.warehouse,
            note: item.note,
            status: itemStatus,
          },
        });
      }

      const allItemProgress = [
        ...existingItemInputs.map((item) => ({
          orderedQuantity: item.orderedQuantity,
          receivedQuantity: existingById.get(item.purchaseOrderItemId)!
            .receivedQuantity,
        })),
        ...hydratedNewLines.map((line) => ({
          orderedQuantity: line.orderedQuantity,
          receivedQuantity: 0,
        })),
      ];

      for (const [newIndex, line] of hydratedNewLines.entries()) {
        const position = maxPosition + newIndex + 1;
        if (line.source === "MANUAL") {
          await tx.logisticsPurchaseOrderItem.create({
            data: {
              purchaseOrderId: existing.id,
              source: "MANUAL",
              catalogItemId: manualCatalogIds.get(line.position)!,
              position,
              partName: line.partName,
              partNumber: line.partNumber,
              machine: line.machine,
              orderedQuantity: line.orderedQuantity,
              agreedUnitPrice: line.unitPrice,
              warehouse: line.warehouse,
              note: line.note,
            },
          });
        } else {
          await tx.logisticsPurchaseOrderItem.create({
            data: {
              purchaseOrderId: existing.id,
              source: "CATALOG",
              catalogItemId: line.catalogItem.id,
              position,
              partName: line.catalogItem.description,
              partNumber:
                line.catalogItem.partNumber ||
                line.catalogItem.catalogPartNumber,
              machine: line.catalogItem.machine,
              orderedQuantity: line.orderedQuantity,
              agreedUnitPrice: line.agreedUnitPrice ?? line.unitPrice,
              note: line.note,
            },
          });
        }
      }

      const status = allItemProgress.every(
        (item) => item.orderedQuantity <= item.receivedQuantity,
      )
        ? "CLOSED"
        : "OPEN";

      await tx.logisticsPurchaseOrder.update({
        where: { id: purchaseOrderId },
        data: {
          ...header.data,
          status,
        },
      });

      const remainingItemIds = existingItemInputs.map(
        (item) => item.purchaseOrderItemId,
      );
      const receiptBatches = await tx.logisticsReceipt.findMany({
        where: { purchaseOrderItemId: { in: remainingItemIds } },
        select: { receivingReference: true, receivedAt: true },
        distinct: ["receivingReference"],
      });
      for (const batch of receiptBatches) {
        await syncReceivingPayableSource(tx, {
          purchaseOrderId: existing.id,
          receivingReference: batch.receivingReference,
          occurredAt: batch.receivedAt,
        });
      }
      return { id: existing.id, poNumber: header.data.poNumber };
    });
    revalidatePath("/[locale]/(routes)/mektek/receiving", "page");
    revalidatePath("/[locale]/(routes)/mektek/items", "page");
    revalidatePath("/[locale]/(routes)/mektek/items/spreadsheet", "page");
    return { data: purchaseOrder };
  } catch (error) {
    console.log("[UPDATE_MEKTEK_RECEIVING_PO]", error);
    if (error instanceof LogisticsActionError) return { error: error.message };
    if (isPrismaUniqueError(error)) {
      return { error: `PO No. ${header.data.poNumber} sudah terdaftar di Receiving` };
    }
    return { error: "Gagal memperbarui Purchase Order Receiving" };
  }
}

export async function createMektekOutboundPurchaseOrder(
  input: MektekOutboundPurchaseOrderInput,
) {
  const access = await ensureLogisticsManager("MONITORING_PO");
  if ("error" in access) return { error: access.error };
  const header = normalizeHeader(input, MEKTEK_COMPANY_NAME);
  if ("error" in header) return { error: header.error };
  const lines = normalizePurchaseOrderLines(input?.items, {
    requireCatalogWarehouse: false,
    emptyError: "Minimal satu item wajib diisi",
  });
  if ("error" in lines) return { error: lines.error };
  const today = parseDateOnly(getCatalogInventoryLocalDateKey());
  if (today && header.data.inputDate > today) {
    return { error: "Tanggal pengiriman tidak boleh melebihi hari ini" };
  }
  try {
    const purchaseOrder = await prismadb.$transaction(async (tx) => {
      const hydrated = await hydratePurchaseOrderLines(tx, lines.data);
      const counterparty = await ensureFinanceCounterparty(tx, header.data.userName, "CUSTOMER");
      // A company that first appears on an outbound PO must also be visible in
      // Payment Faktur and the rest of the Finance/Accounting menus.
      await ensurePaymentFakturCustomer(tx, header.data.userName);
      const itemKeys = hydrated.map((line) => normalizeFinanceKey(line.source === "CATALOG" ? line.catalogItem.id : line.partNumber || line.partName));
      const purchaseOrder = await tx.logisticsPurchaseOrder.create({
        data: {
          ...header.data,
          flow: "OUTBOUND",
          financeCounterpartyId: counterparty.id,
          supplyReviewStatus: "CLEAR",
          deliveryDate: null,
          createdBy: access.session.user.id,
        },
      });
      const createdItems = [];
      for (const line of hydrated) {
        if (line.source === "MANUAL") {
          const item = await tx.logisticsPurchaseOrderItem.create({
            data: {
              purchaseOrderId: purchaseOrder.id,
              source: "MANUAL",
              catalogItemId: null,
              position: line.position,
              partName: line.partName,
              partNumber: line.partNumber,
              machine: line.machine,
              orderedQuantity: line.orderedQuantity,
              agreedUnitPrice: null,
              warehouse: null,
              note: line.note,
            },
          });
          createdItems.push(item);
          await tx.logisticsSupplyAllocation.create({ data: { purchaseOrderItemId: item.id, counterpartyId: counterparty.id, projectKey: normalizeFinanceKey(header.data.projectName), itemKey: itemKeys[line.position - 1], poMode: header.data.poMode, supplyStartDate: header.data.supplyStartDate, supplyEndDate: header.data.supplyEndDate, quantity: line.orderedQuantity, status: "CLEAR" } });
          continue;
        }

        const item = await tx.logisticsPurchaseOrderItem.create({
          data: {
            purchaseOrderId: purchaseOrder.id,
            source: "CATALOG",
            catalogItemId: line.catalogItem.id,
            position: line.position,
            partName: line.catalogItem.description,
            partNumber:
              line.catalogItem.partNumber || line.catalogItem.catalogPartNumber,
            machine: line.catalogItem.machine,
            orderedQuantity: line.orderedQuantity,
            agreedUnitPrice: null,
            warehouse: null,
            note: line.note,
          },
        });
        createdItems.push(item);
        await tx.logisticsSupplyAllocation.create({ data: { purchaseOrderItemId: item.id, counterpartyId: counterparty.id, projectKey: normalizeFinanceKey(header.data.projectName), itemKey: itemKeys[line.position - 1], poMode: header.data.poMode, supplyStartDate: header.data.supplyStartDate, supplyEndDate: header.data.supplyEndDate, quantity: line.orderedQuantity, status: "CLEAR" } });
      }
      return { ...purchaseOrder, items: createdItems };
    });
    revalidatePath("/[locale]/(routes)/mektek/logistics", "page");
    return {
      data: { id: purchaseOrder.id, poNumber: purchaseOrder.poNumber },
    };
  } catch (error) {
    console.log("[CREATE_MEKTEK_OUTBOUND_PO]", error);
    if (error instanceof LogisticsActionError || error instanceof Error) {
      if (error instanceof LogisticsActionError || error.message.includes("Stok")) {
        return { error: error.message };
      }
    }
    if (isPrismaUniqueError(error)) {
      return { error: `PO No. ${header.data.poNumber} sudah terdaftar di Monitoring PO` };
    }
    return { error: "Gagal membuat Monitoring PO" };
  }
}

export async function updateMektekOutboundPurchaseOrder(
  input: MektekOutboundPurchaseOrderUpdateInput,
) {
  const access = await ensureLogisticsManager("MONITORING_PO");
  if ("error" in access) return { error: access.error };
  const purchaseOrderId = compactText(input?.purchaseOrderId);
  if (!purchaseOrderId) return { error: "Monitoring PO tidak ditemukan" };
  const header = normalizeHeader(input, MEKTEK_COMPANY_NAME);
  if ("error" in header) return { error: header.error };
  if (!Array.isArray(input?.items) || input.items.length === 0) {
    return { error: "Minimal satu item wajib diisi" };
  }

  const normalizedItems: Array<{
    purchaseOrderItemId: string;
    orderedQuantity: number;
    note: string | null;
  }> = [];
  const seenItemIds = new Set<string>();
  for (const [index, item] of input.items.entries()) {
    const purchaseOrderItemId = compactText(item?.purchaseOrderItemId);
    const orderedQuantity = parsePositiveInteger(item?.orderedQuantity);
    if (!purchaseOrderItemId || seenItemIds.has(purchaseOrderItemId)) {
      return { error: `Item baris ${index + 1} tidak valid` };
    }
    if (!orderedQuantity) {
      return {
        error: `Quantity baris ${index + 1} harus berupa angka bulat lebih dari 0`,
      };
    }
    seenItemIds.add(purchaseOrderItemId);
    normalizedItems.push({
      purchaseOrderItemId,
      orderedQuantity,
      note: boundedText(item?.note, MAX_NOTE_LEN) || null,
    });
  }

  const today = parseDateOnly(getCatalogInventoryLocalDateKey());
  if (today && header.data.inputDate > today) {
    return { error: "Tanggal pengiriman tidak boleh melebihi hari ini" };
  }

  try {
    const purchaseOrder = await prismadb.$transaction(async (tx) => {
      const existing = await tx.logisticsPurchaseOrder.findUnique({
        where: { id: purchaseOrderId },
        include: { items: true },
      });
      if (!existing || existing.flow !== "OUTBOUND") {
        throw new LogisticsActionError("Monitoring PO tidak ditemukan");
      }
      if (
        existing.items.length !== normalizedItems.length ||
        existing.items.some((item) => !seenItemIds.has(item.id))
      ) {
        throw new LogisticsActionError(
          "Daftar item PO telah berubah. Muat ulang halaman lalu coba kembali.",
        );
      }

      const existingById = new Map(existing.items.map((item) => [item.id, item]));
      for (const [index, item] of normalizedItems.entries()) {
        const current = existingById.get(item.purchaseOrderItemId);
        if (!current) {
          throw new LogisticsActionError(`Item baris ${index + 1} tidak ditemukan`);
        }
        if (item.orderedQuantity < current.receivedQuantity) {
          throw new LogisticsActionError(
            `QTY Order item ${index + 1} tidak boleh kurang dari QTY Keluar (${current.receivedQuantity})`,
          );
        }
      }

      const counterparty = await ensureFinanceCounterparty(
        tx,
        header.data.userName,
        "CUSTOMER",
      );
      await ensurePaymentFakturCustomer(tx, header.data.userName);
      const status = normalizedItems.every((item) => {
        const current = existingById.get(item.purchaseOrderItemId);
        return current && item.orderedQuantity <= current.receivedQuantity;
      })
        ? "CLOSED"
        : "OPEN";

      await tx.logisticsPurchaseOrder.update({
        where: { id: purchaseOrderId },
        data: {
          ...header.data,
          financeCounterpartyId: counterparty.id,
          status,
        },
      });
      for (const item of normalizedItems) {
        const current = existingById.get(item.purchaseOrderItemId)!;
        const itemStatus = item.orderedQuantity <= current.receivedQuantity
          ? "CLOSED"
          : "OPEN";
        await tx.logisticsPurchaseOrderItem.update({
          where: { id: item.purchaseOrderItemId },
          data: {
            orderedQuantity: item.orderedQuantity,
            note: item.note,
            status: itemStatus,
          },
        });
        await tx.logisticsSupplyAllocation.updateMany({
          where: { purchaseOrderItemId: item.purchaseOrderItemId },
          data: {
            counterpartyId: counterparty.id,
            projectKey: normalizeFinanceKey(header.data.projectName),
            poMode: header.data.poMode,
            supplyStartDate: header.data.supplyStartDate,
            supplyEndDate: header.data.supplyEndDate,
            quantity: item.orderedQuantity,
          },
        });
      }
      return { id: existing.id, poNumber: header.data.poNumber };
    });
    revalidatePath("/[locale]/(routes)/mektek/logistics", "page");
    return { data: purchaseOrder };
  } catch (error) {
    console.log("[UPDATE_MEKTEK_OUTBOUND_PO]", error);
    if (error instanceof LogisticsActionError) return { error: error.message };
    if (isPrismaUniqueError(error)) {
      return { error: `PO No. ${header.data.poNumber} sudah terdaftar di Monitoring PO` };
    }
    return { error: "Gagal memperbarui Monitoring PO" };
  }
}

export async function recordMektekOutboundPurchaseOrderDispatch(
  input: MektekOutboundDispatchInput,
) {
  const access = await ensureLogisticsManager("MONITORING_PO");
  if ("error" in access) return { error: access.error };
  const purchaseOrderId = compactText(input?.purchaseOrderId);
  const picId = compactText(input?.picId);
  const dispatchedAt = parseDateOnly(input?.dispatchedAt);
  const rawItems = Array.isArray(input?.items) ? input.items : [];
  const items = rawItems.map((item) => ({
    purchaseOrderItemId: compactText(item?.purchaseOrderItemId),
    quantity: parsePositiveInteger(item?.quantity),
    warehouse: item?.warehouse,
    note: boundedText(item?.note, MAX_NOTE_LEN),
  }));
  if (!purchaseOrderId) return { error: "Purchase Order wajib dipilih" };
  if (!picId) return { error: "PIC wajib dipilih" };
  if (!dispatchedAt) return { error: "Tanggal Keluar tidak valid" };
  if (items.length === 0) return { error: "Pilih minimal satu item yang dikirim" };
  if (
    items.some(
      (item) =>
        !item.purchaseOrderItemId ||
        !item.quantity ||
        !isWarehouse(item.warehouse),
    )
  ) {
    return { error: "QTY dan gudang setiap item Barang Keluar wajib valid" };
  }
  if (new Set(items.map((item) => item.purchaseOrderItemId)).size !== items.length) {
    return { error: "Item Barang Keluar tidak boleh duplikat" };
  }
  const today = parseDateOnly(getCatalogInventoryLocalDateKey());
  if (today && dispatchedAt > today) {
    return { error: "Tanggal Keluar tidak boleh melebihi hari ini" };
  }

  try {
    const result = await prismadb.$transaction(async (tx) => {
      const pic = await tx.logisticsPic.findFirst({
        where: { id: picId, isActive: true },
        select: { id: true, name: true },
      });
      if (!pic) throw new LogisticsActionError("PIC tidak aktif atau tidak ditemukan");
      const purchaseOrder = await tx.logisticsPurchaseOrder.findUnique({
        where: { id: purchaseOrderId },
        select: {
          id: true,
          sourceServiceOrderId: true,
          poNumber: true,
          flow: true,
          poMode: true,
          projectName: true,
          userName: true,
          inputDate: true,
          items: {
            orderBy: { position: "asc" },
            select: {
              id: true,
              catalogItemId: true,
              source: true,
              partName: true,
              partNumber: true,
              machine: true,
              orderedQuantity: true,
              receivedQuantity: true,
              status: true,
            },
          },
        },
      });
      if (!purchaseOrder || purchaseOrder.flow !== "OUTBOUND") {
        throw new LogisticsActionError("Monitoring PO tidak ditemukan");
      }
      if (dispatchedAt < purchaseOrder.inputDate) {
        throw new LogisticsActionError(
          "Tanggal Keluar tidak boleh sebelum Tanggal Input PO",
        );
      }
      const deliveryNoteNumber = await buildOutboundDeliveryNoteNumber(
        tx,
        dispatchedAt,
      );
      const byId = new Map(purchaseOrder.items.map((item) => [item.id, item]));
      const validated = items.map((inputItem) => {
        const item = byId.get(inputItem.purchaseOrderItemId);
        if (!item) {
          throw new LogisticsActionError(
            "Terdapat item yang bukan bagian dari Monitoring PO ini",
          );
        }
        if (!item.catalogItemId && item.source !== "MANUAL") {
          throw new LogisticsActionError(
            "Item Monitoring PO lama belum terhubung ke Catalog / Item",
          );
        }
        const progress = validateLogisticsReceipt({
          orderedQuantity: item.orderedQuantity,
          receivedQuantity: item.receivedQuantity,
          incomingQuantity: inputItem.quantity!,
        });
        if ("error" in progress) {
          throw new LogisticsActionError(`${progress.error} untuk item PO`);
        }
        return { item, input: inputItem, progress: progress.data };
      });

      await tx.logisticsPurchaseOrder.update({
        where: { id: purchaseOrder.id },
        data: { updatedAt: new Date() },
      });
      const reference = deliveryNoteNumber;
      const receipts: Array<Awaited<ReturnType<typeof tx.logisticsReceipt.create>>> = [];
      const movementInputs: Array<{
        receiptId: string;
        catalogItemId: string;
        warehouse: CatalogWarehouse;
        quantity: number;
        note: string;
      }> = [];
      for (const entry of validated) {
        const quantity = entry.input.quantity!;
        const updated = await tx.logisticsPurchaseOrderItem.updateMany({
          where: {
            id: entry.item.id,
            purchaseOrderId: purchaseOrder.id,
            status: "OPEN",
            receivedQuantity: { lte: entry.item.orderedQuantity - quantity },
          },
          data: {
            receivedQuantity: { increment: quantity },
            status: entry.progress.status,
          },
        });
        if (updated.count !== 1) {
          throw new LogisticsActionError(
            "QTY item telah berubah. Muat ulang halaman sebelum input kembali.",
          );
        }
        const receipt = await tx.logisticsReceipt.create({
          data: {
            purchaseOrderItemId: entry.item.id,
            picId: pic.id,
            receivingReference: reference,
            quantity,
            warehouse: entry.input.warehouse,
            receivedAt: dispatchedAt,
            note: entry.input.note || null,
            createdBy: access.session.user.id,
          },
        });
        receipts.push(receipt);
        if (entry.item.catalogItemId) {
          movementInputs.push({
            receiptId: receipt.id,
            catalogItemId: entry.item.catalogItemId,
            warehouse: entry.input.warehouse as CatalogWarehouse,
            quantity,
            note: `Barang Keluar ${purchaseOrder.poNumber}${entry.input.note ? ` · ${entry.input.note}` : ""}`,
          });
        }
      }
      for (const movement of movementInputs.sort((a, b) =>
        a.catalogItemId.localeCompare(b.catalogItemId),
      )) {
        await applyCatalogStockMovement(tx, {
          catalogItemId: movement.catalogItemId,
          warehouse: movement.warehouse,
          direction: "OUT",
          quantity: movement.quantity,
          occurredAt: dispatchedAt,
          note: movement.note,
          createdBy: access.session.user.id,
          source: "OUTBOUND_PO",
          sourceId: movement.receiptId,
          preventNegativeStock: true,
        });
      }
      if (purchaseOrder.poMode === "CONSIGNMENT") {
        const siteName = purchaseOrder.projectName || purchaseOrder.userName;
        for (const movement of movementInputs.sort((a, b) =>
          a.catalogItemId.localeCompare(b.catalogItemId),
        )) {
          await applyCatalogConsignmentSiteStock(tx, {
            catalogItemId: movement.catalogItemId,
            siteName,
            projectKey: normalizeFinanceKey(purchaseOrder.projectName),
            direction: "IN",
            quantity: movement.quantity,
            occurredAt: dispatchedAt,
            note: `Consignment ${purchaseOrder.poNumber}`,
            counterpartyName: purchaseOrder.userName,
            createdBy: access.session.user.id,
            source: "OUTBOUND_PO",
            sourceId: movement.receiptId,
          });
        }
      }
      const openItems = await tx.logisticsPurchaseOrderItem.count({
        where: { purchaseOrderId: purchaseOrder.id, status: "OPEN" },
      });
      const purchaseOrderStatus = openItems === 0 ? "CLOSED" : "OPEN";
      await tx.logisticsPurchaseOrder.update({
        where: { id: purchaseOrder.id },
        data: { status: purchaseOrderStatus },
      });
      if (!purchaseOrder.sourceServiceOrderId) {
        await syncOutboundDispatchBillingSource(tx, {
          purchaseOrderId: purchaseOrder.id,
          dispatchReference: reference,
          occurredAt: dispatchedAt,
        });
      }
      return {
        receipts,
        dispatchReference: reference,
        purchaseOrderId: purchaseOrder.id,
        purchaseOrderStatus,
        itemProgresses: validated.map(({ item, progress }) => ({
          purchaseOrderItemId: item.id,
          ...progress,
        })),
      };
    }, LOGISTICS_TRANSACTION_OPTIONS);
    revalidatePath("/[locale]/(routes)/mektek/logistics", "page");
    revalidatePath("/[locale]/(routes)/mektek/logistics/spreadsheet", "page");
    revalidatePath("/[locale]/(routes)/mektek/items", "page");
    revalidatePath("/[locale]/(routes)/mektek/items/spreadsheet", "page");
    revalidatePath("/[locale]/(routes)/mektek/[id]", "page");
    return { data: result };
  } catch (error) {
    console.log("[RECORD_MEKTEK_OUTBOUND_DISPATCH]", error);
    if (error instanceof LogisticsActionError) return { error: error.message };
    if (error instanceof Error && error.message.includes("Stok")) {
      return { error: error.message };
    }
    const retryMessage = getTransactionRetryMessage(error, "Barang Keluar");
    if (retryMessage) return { error: retryMessage };
    return { error: "Gagal mencatat Barang Keluar Monitoring PO" };
  }
}

export async function updateMektekOutboundDispatch(
  input: MektekOutboundDispatchRevisionInput,
) {
  const access = await ensureLogisticsManager("MONITORING_PO");
  if ("error" in access) return { error: access.error };
  const purchaseOrderId = compactText(input?.purchaseOrderId);
  const dispatchReference = normalizeLogisticsReference(input?.dispatchReference);
  const picId = compactText(input?.picId);
  const dispatchedAt = parseDateOnly(input?.dispatchedAt);
  const rawItems = Array.isArray(input?.items) ? input.items : [];
  const items = rawItems.map((item) => ({
    receiptId: compactText(item?.receiptId),
    quantity: parsePositiveInteger(item?.quantity),
    warehouse: isWarehouse(item?.warehouse) ? item.warehouse : null,
    note: boundedText(item?.note, MAX_NOTE_LEN) || null,
  }));
  if (!purchaseOrderId) return { error: "Purchase Order wajib dipilih" };
  if (!dispatchReference) return { error: "Nomor Surat Jalan wajib diisi" };
  if (!picId) return { error: "PIC wajib dipilih" };
  if (!dispatchedAt) return { error: "Tanggal Keluar tidak valid" };
  const today = parseDateOnly(getCatalogInventoryLocalDateKey());
  if (today && dispatchedAt > today) {
    return { error: "Tanggal Keluar tidak boleh melebihi hari ini" };
  }
  if (items.length === 0) {
    return { error: "Pilih minimal satu item yang direvisi" };
  }
  if (items.some((item) => !item.receiptId || !item.quantity || !item.warehouse)) {
    return { error: "QTY dan Gudang setiap item Surat Jalan wajib valid" };
  }
  if (new Set(items.map((item) => item.receiptId)).size !== items.length) {
    return { error: "Item Surat Jalan tidak boleh duplikat" };
  }

  try {
    const result = await prismadb.$transaction(async (tx) => {
      const pic = await tx.logisticsPic.findFirst({
        where: { id: picId, isActive: true },
        select: { id: true, name: true },
      });
      if (!pic) throw new LogisticsActionError("PIC tidak ditemukan");
      const purchaseOrder = await tx.logisticsPurchaseOrder.findUnique({
        where: { id: purchaseOrderId },
        select: {
          id: true,
          sourceServiceOrderId: true,
          poNumber: true,
          flow: true,
          poMode: true,
          projectName: true,
          userName: true,
          inputDate: true,
          items: {
            orderBy: { position: "asc" },
            select: {
              id: true,
              catalogItemId: true,
              source: true,
              partName: true,
              orderedQuantity: true,
              receivedQuantity: true,
              status: true,
              receipts: {
                where: { receivingReference: dispatchReference },
                select: {
                  id: true,
                  quantity: true,
                  warehouse: true,
                  receivedAt: true,
                  note: true,
                },
              },
            },
          },
        },
      });
      if (!purchaseOrder || purchaseOrder.flow !== "OUTBOUND") {
        throw new LogisticsActionError("Monitoring PO tidak ditemukan");
      }
      if (dispatchedAt < purchaseOrder.inputDate) {
        throw new LogisticsActionError(
          "Tanggal Keluar tidak boleh sebelum Tanggal Pengiriman PO",
        );
      }

      if (!purchaseOrder.sourceServiceOrderId) {
        const billingSourceKey = `OUTBOUND:${purchaseOrder.id}:${dispatchReference}`;
        const billingSource = await tx.financeBillingSource.findUnique({
          where: { sourceKey: billingSourceKey },
          select: { status: true },
        });
        if (
          billingSource &&
          billingSource.status !== "UNBILLED" &&
          billingSource.status !== "NEEDS_REVIEW"
        ) {
          throw new LogisticsActionError(
            "Surat Jalan sudah masuk Faktur, tidak dapat direvisi",
          );
        }
      }

      const receiptByItem = new Map(
        purchaseOrder.items.flatMap((item) =>
          item.receipts.map((receipt) => [
            receipt.id,
            { item, receipt },
          ]),
        ),
      );
      const validated = items.map((inputItem) => {
        const matched = receiptByItem.get(inputItem.receiptId);
        if (!matched) {
          throw new LogisticsActionError(
            "Terdapat item yang bukan bagian dari Surat Jalan ini",
          );
        }
        const { item, receipt } = matched;
        const oldBatchQty = receipt.quantity;
        const newQty = inputItem.quantity!;
        const newWarehouse = inputItem.warehouse!;
        const newNote = inputItem.note;
        const projectedShipped = item.receivedQuantity - oldBatchQty + newQty;
        if (projectedShipped > item.orderedQuantity) {
          throw new LogisticsActionError(
            `Total QTY keluar untuk "${item.partName}" melebihi QTY Order (${item.orderedQuantity})`,
          );
        }
        if (projectedShipped < 0) {
          throw new LogisticsActionError(
            `Total QTY keluar untuk "${item.partName}" tidak valid`,
          );
        }
        const newStatus: LogisticsPurchaseOrderStatus =
          projectedShipped === item.orderedQuantity ? "CLOSED" : "OPEN";
        return {
          item,
          receipt,
          oldBatchQty,
          newQty,
          delta: newQty - oldBatchQty,
          newWarehouse,
          newNote,
          warehouseChanged: newWarehouse !== receipt.warehouse,
          newStatus,
        };
      });

      const revisionOccurredAt =
        parseDateOnly(getCatalogInventoryLocalDateKey()) ?? new Date();
      const revisionStamp = Date.now();
      const movementInputs: Array<{
        catalogItemId: string;
        warehouse: CatalogWarehouse;
        delta: number;
        receiptId: string;
        note: string;
      }> = [];
      const itemProgresses: Array<{
        purchaseOrderItemId: string;
        orderedQuantity: number;
        receivedQuantity: number;
        remainingQuantity: number;
        status: LogisticsPurchaseOrderStatus;
      }> = [];

      for (const entry of validated) {
        const {
          item,
          receipt,
          oldBatchQty,
          newQty,
          delta,
          newWarehouse,
          newNote,
          warehouseChanged,
          newStatus,
        } = entry;
        await tx.logisticsReceipt.update({
          where: { id: receipt.id },
          data: {
            quantity: newQty,
            warehouse: newWarehouse,
            note: newNote,
            picId: pic.id,
            receivedAt: dispatchedAt,
          },
        });
        const updated = await tx.logisticsPurchaseOrderItem.updateMany({
          where: {
            id: item.id,
            purchaseOrderId: purchaseOrder.id,
            receivedQuantity: item.receivedQuantity,
          },
          data: {
            receivedQuantity: { increment: delta },
            status: newStatus,
          },
        });
        if (updated.count !== 1) {
          throw new LogisticsActionError(
            "QTY item telah berubah. Muat ulang halaman sebelum revisi kembali.",
          );
        }
        if (item.catalogItemId && warehouseChanged) {
          movementInputs.push(
            {
              catalogItemId: item.catalogItemId,
              warehouse: receipt.warehouse,
              delta: -oldBatchQty,
              receiptId: receipt.id,
              note: `Revisi Surat Jalan ${dispatchReference} ${purchaseOrder.poNumber} - pindah gudang`,
            },
            {
              catalogItemId: item.catalogItemId,
              warehouse: newWarehouse,
              delta: newQty,
              receiptId: receipt.id,
              note: `Revisi Surat Jalan ${dispatchReference} ${purchaseOrder.poNumber}${newNote ? ` · ${newNote}` : ""}`,
            },
          );
        } else if (item.catalogItemId && delta !== 0) {
          movementInputs.push({
            catalogItemId: item.catalogItemId,
            warehouse: newWarehouse,
            delta,
            receiptId: receipt.id,
            note: `Revisi Surat Jalan ${dispatchReference} ${purchaseOrder.poNumber}${newNote ? ` · ${newNote}` : ""}`,
          });
        }
        const projectedReceived = item.receivedQuantity + delta;
        itemProgresses.push({
          purchaseOrderItemId: item.id,
          orderedQuantity: item.orderedQuantity,
          receivedQuantity: projectedReceived,
          remainingQuantity: Math.max(0, item.orderedQuantity - projectedReceived),
          status: newStatus,
        });
      }

      for (const [movementIndex, movement] of movementInputs
        .sort((a, b) => a.catalogItemId.localeCompare(b.catalogItemId))
        .entries()) {
        const sourceId = `${movement.receiptId}#revisi-${revisionStamp}-${movementIndex}`;
        if (movement.delta > 0) {
          await applyCatalogStockMovement(tx, {
            catalogItemId: movement.catalogItemId,
            warehouse: movement.warehouse,
            direction: "OUT",
            quantity: movement.delta,
            occurredAt: revisionOccurredAt,
            note: movement.note,
            createdBy: access.session.user.id,
            source: "OUTBOUND_PO",
            sourceId,
            preventNegativeStock: true,
          });
        } else if (movement.delta < 0) {
          await applyCatalogStockMovement(tx, {
            catalogItemId: movement.catalogItemId,
            warehouse: movement.warehouse,
            direction: "IN",
            quantity: -movement.delta,
            occurredAt: revisionOccurredAt,
            note: movement.note,
            createdBy: access.session.user.id,
            source: "OUTBOUND_PO",
            sourceId,
            preventNegativeStock: false,
          });
        }
      }

      if (purchaseOrder.poMode === "CONSIGNMENT") {
        const siteName = purchaseOrder.projectName || purchaseOrder.userName;
        for (const [movementIndex, movement] of movementInputs
          .sort((a, b) => a.catalogItemId.localeCompare(b.catalogItemId))
          .entries()) {
          const sourceId = `${movement.receiptId}#revisi-${revisionStamp}-${movementIndex}`;
          if (movement.delta > 0) {
            await applyCatalogConsignmentSiteStock(tx, {
              catalogItemId: movement.catalogItemId,
              siteName,
              projectKey: normalizeFinanceKey(purchaseOrder.projectName),
              direction: "IN",
              quantity: movement.delta,
              occurredAt: revisionOccurredAt,
              note: `Revisi Consignment ${purchaseOrder.poNumber}`,
              counterpartyName: purchaseOrder.userName,
              createdBy: access.session.user.id,
              source: "OUTBOUND_PO",
              sourceId,
            });
          } else if (movement.delta < 0) {
            await applyCatalogConsignmentSiteStock(tx, {
              catalogItemId: movement.catalogItemId,
              siteName,
              projectKey: normalizeFinanceKey(purchaseOrder.projectName),
              direction: "OUT",
              quantity: -movement.delta,
              occurredAt: revisionOccurredAt,
              note: `Revisi Consignment ${purchaseOrder.poNumber}`,
              counterpartyName: purchaseOrder.userName,
              createdBy: access.session.user.id,
              source: "OUTBOUND_PO",
              sourceId,
            });
          }
        }
      }

      const openItems = await tx.logisticsPurchaseOrderItem.count({
        where: { purchaseOrderId: purchaseOrder.id, status: "OPEN" },
      });
      const purchaseOrderStatus: LogisticsPurchaseOrderStatus =
        openItems === 0 ? "CLOSED" : "OPEN";
      await tx.logisticsPurchaseOrder.update({
        where: { id: purchaseOrder.id },
        data: { status: purchaseOrderStatus },
      });

      if (!purchaseOrder.sourceServiceOrderId) {
        await syncOutboundDispatchBillingSource(tx, {
          purchaseOrderId: purchaseOrder.id,
          dispatchReference,
          occurredAt: dispatchedAt,
        });
      }

      return {
        dispatchReference,
        dispatchedAt,
        pic,
        purchaseOrderId: purchaseOrder.id,
        purchaseOrderStatus,
        itemProgresses,
      };
    }, LOGISTICS_TRANSACTION_OPTIONS);
    revalidatePath("/[locale]/(routes)/mektek/logistics", "page");
    revalidatePath("/[locale]/(routes)/mektek/logistics/spreadsheet", "page");
    revalidatePath("/[locale]/(routes)/mektek/items", "page");
    revalidatePath("/[locale]/(routes)/mektek/items/spreadsheet", "page");
    revalidatePath("/[locale]/(routes)/mektek/[id]", "page");
    return { data: result };
  } catch (error) {
    console.log("[UPDATE_MEKTEK_OUTBOUND_DISPATCH]", error);
    if (error instanceof LogisticsActionError) return { error: error.message };
    if (error instanceof Error && error.message.includes("Stok")) {
      return { error: error.message };
    }
    const retryMessage = getTransactionRetryMessage(error, "Barang Keluar");
    if (retryMessage) return { error: retryMessage };
    return { error: "Gagal memperbarui Surat Jalan Monitoring PO" };
  }
}

function buildReceivingReference(poNumber: string) {
  const day = getCatalogInventoryLocalDateKey().replaceAll("-", "");
  return normalizeLogisticsReference(
    `RCV-${poNumber}-${day}-${randomUUID().slice(0, 8)}`,
  );
}

function formatOutboundDeliveryNotePrefix(date: Date): string {
  const year = date.getUTCFullYear() % 100;
  const month = date.getUTCMonth() + 1;
  return `${String(year).padStart(2, "0")}${String(month).padStart(2, "0")}`;
}

async function buildOutboundDeliveryNoteNumber(
  tx: Prisma.TransactionClient,
  dispatchedAt: Date,
): Promise<string> {
  const prefix = formatOutboundDeliveryNotePrefix(dispatchedAt);
  const existing = await tx.logisticsReceipt.findMany({
    where: {
      receivingReference: { startsWith: prefix },
      purchaseOrderItem: { purchaseOrder: { flow: "OUTBOUND" } },
    },
    select: { receivingReference: true },
  });
  let maxSequence = 0;
  for (const row of existing) {
    const tail = row.receivingReference.slice(prefix.length);
    const parsed = Number.parseInt(tail, 10);
    if (Number.isFinite(parsed) && parsed > maxSequence) {
      maxSequence = parsed;
    }
  }
  let attempt = maxSequence + 1;
  for (let guard = 0; guard < 100; guard += 1) {
    const candidate = `${prefix}${String(attempt).padStart(2, "0")}`;
    const collision = await tx.logisticsReceipt.findFirst({
      where: {
        receivingReference: { equals: candidate, mode: "insensitive" },
      },
      select: { id: true },
    });
    if (!collision) return candidate;
    attempt += 1;
  }
  throw new LogisticsActionError(
    "Gagal membuat nomor Surat Jalan unik, coba lagi",
  );
}

export async function recordMektekReceivingPurchaseOrderReceipt(
  input: MektekReceivingReceiptInput,
) {
  const access = await ensureLogisticsManager("RECEIVING");
  if ("error" in access) return { error: access.error };
  const purchaseOrderId = compactText(input?.purchaseOrderId);
  const picId = compactText(input?.picId);
  const receivedAt = parseDateOnly(input?.receivedAt);
  const rawItems = Array.isArray(input?.items) ? input.items : [];
  const items = rawItems.map((item) => ({
    purchaseOrderItemId: compactText(item?.purchaseOrderItemId),
    quantity: parsePositiveInteger(item?.quantity),
    warehouse: item?.warehouse,
    note: boundedText(item?.note, MAX_NOTE_LEN),
  }));
  if (!purchaseOrderId) return { error: "Purchase Order wajib dipilih" };
  if (!picId) return { error: "PIC wajib dipilih" };
  if (!receivedAt) return { error: "Tanggal Masuk tidak valid" };
  if (items.length === 0) return { error: "Pilih minimal satu item yang diterima" };
  if (
    items.some(
      (item) =>
        !item.purchaseOrderItemId ||
        !item.quantity ||
        !isWarehouse(item.warehouse),
    )
  ) {
    return { error: "QTY dan gudang setiap item penerimaan wajib valid" };
  }
  if (new Set(items.map((item) => item.purchaseOrderItemId)).size !== items.length) {
    return { error: "Item penerimaan tidak boleh duplikat" };
  }
  const today = parseDateOnly(getCatalogInventoryLocalDateKey());
  if (today && receivedAt > today) {
    return { error: "Tanggal Masuk tidak boleh melebihi hari ini" };
  }

  try {
    const result = await prismadb.$transaction(async (tx) => {
      const pic = await tx.logisticsPic.findFirst({
        where: { id: picId, isActive: true },
        select: { id: true, name: true },
      });
      if (!pic) throw new LogisticsActionError("PIC tidak aktif atau tidak ditemukan");
      const purchaseOrder = await tx.logisticsPurchaseOrder.findUnique({
        where: { id: purchaseOrderId },
        select: {
          id: true,
          poNumber: true,
          flow: true,
          inputDate: true,
          items: {
            orderBy: { position: "asc" },
            select: {
              id: true,
              catalogItemId: true,
              source: true,
              partName: true,
              partNumber: true,
              machine: true,
              orderedQuantity: true,
              receivedQuantity: true,
              status: true,
            },
          },
        },
      });
      if (!purchaseOrder || purchaseOrder.flow !== "RECEIVING") {
        throw new LogisticsActionError("Purchase Order Receiving tidak ditemukan");
      }
      if (receivedAt < purchaseOrder.inputDate) {
        throw new LogisticsActionError(
          "Tanggal Masuk tidak boleh sebelum Tanggal Input PO",
        );
      }
      for (const item of purchaseOrder.items) {
        if (item.source !== "MANUAL" || item.catalogItemId) continue;
        const catalogItem = await ensureManualReceivingCatalogItem(tx, {
          partName: item.partName,
          partNumber: item.partNumber,
          machine: item.machine || "Receiving",
          poNumber: purchaseOrder.poNumber,
        });
        await tx.logisticsPurchaseOrderItem.update({
          where: { id: item.id },
          data: { catalogItemId: catalogItem.id },
        });
        item.catalogItemId = catalogItem.id;
      }
      const byId = new Map(purchaseOrder.items.map((item) => [item.id, item]));
      const validated = items.map((inputItem) => {
        const item = byId.get(inputItem.purchaseOrderItemId);
        if (!item) {
          throw new LogisticsActionError(
            "Terdapat item yang bukan bagian dari Purchase Order Receiving ini",
          );
        }
        if (!item.catalogItemId && item.source !== "MANUAL") {
          throw new LogisticsActionError(
            "Item Receiving lama belum terhubung ke Catalog / Item",
          );
        }
        const progress = validateLogisticsReceipt({
          orderedQuantity: item.orderedQuantity,
          receivedQuantity: item.receivedQuantity,
          incomingQuantity: inputItem.quantity!,
        });
        if ("error" in progress) {
          throw new LogisticsActionError(`${progress.error} untuk item PO`);
        }
        return { item, input: inputItem, progress: progress.data };
      });

      await tx.logisticsPurchaseOrder.update({
        where: { id: purchaseOrder.id },
        data: { updatedAt: new Date() },
      });
      const reference = buildReceivingReference(purchaseOrder.poNumber);
      const receipts: Array<Awaited<ReturnType<typeof tx.logisticsReceipt.create>>> = [];
      const movementInputs: Array<{
        receiptId: string;
        catalogItemId: string;
        warehouse: CatalogWarehouse;
        quantity: number;
        note: string;
      }> = [];
      for (const entry of validated) {
        const quantity = entry.input.quantity!;
        const updated = await tx.logisticsPurchaseOrderItem.updateMany({
          where: {
            id: entry.item.id,
            purchaseOrderId: purchaseOrder.id,
            status: "OPEN",
            receivedQuantity: { lte: entry.item.orderedQuantity - quantity },
          },
          data: {
            receivedQuantity: { increment: quantity },
            status: entry.progress.status,
          },
        });
        if (updated.count !== 1) {
          throw new LogisticsActionError(
            "QTY item telah berubah. Muat ulang halaman sebelum input kembali.",
          );
        }
        const receipt = await tx.logisticsReceipt.create({
          data: {
            purchaseOrderItemId: entry.item.id,
            picId: pic.id,
            receivingReference: reference,
            quantity,
            warehouse: entry.input.warehouse,
            receivedAt,
            note: entry.input.note || null,
            createdBy: access.session.user.id,
          },
        });
        receipts.push(receipt);
        if (entry.item.catalogItemId) {
          movementInputs.push({
            receiptId: receipt.id,
            catalogItemId: entry.item.catalogItemId,
            warehouse: entry.input.warehouse as CatalogWarehouse,
            quantity,
            note: `Receiving ${purchaseOrder.poNumber}${entry.input.note ? ` · ${entry.input.note}` : ""}`,
          });
        }
      }
      for (const movement of movementInputs.sort((a, b) =>
        a.catalogItemId.localeCompare(b.catalogItemId),
      )) {
        await applyCatalogStockMovement(tx, {
          catalogItemId: movement.catalogItemId,
          warehouse: movement.warehouse,
          direction: "IN",
          quantity: movement.quantity,
          occurredAt: receivedAt,
          note: movement.note,
          createdBy: access.session.user.id,
          source: "RECEIVING",
          sourceId: movement.receiptId,
        });
      }
      const openItems = await tx.logisticsPurchaseOrderItem.count({
        where: { purchaseOrderId: purchaseOrder.id, status: "OPEN" },
      });
      const purchaseOrderStatus = openItems === 0 ? "CLOSED" : "OPEN";
      await tx.logisticsPurchaseOrder.update({
        where: { id: purchaseOrder.id },
        data: { status: purchaseOrderStatus },
      });
      await syncReceivingPayableSource(tx, {
        purchaseOrderId: purchaseOrder.id,
        receivingReference: reference,
        occurredAt: receivedAt,
      });
      return {
        receipts,
        receivingReference: reference,
        purchaseOrderId: purchaseOrder.id,
        purchaseOrderStatus,
        itemProgresses: validated.map(({ item, progress }) => ({
          purchaseOrderItemId: item.id,
          ...progress,
        })),
      };
    }, LOGISTICS_TRANSACTION_OPTIONS);
    revalidatePath("/[locale]/(routes)/mektek/receiving", "page");
    revalidatePath("/[locale]/(routes)/mektek/items", "page");
    revalidatePath("/[locale]/(routes)/mektek/items/spreadsheet", "page");
    return { data: result };
  } catch (error) {
    console.log("[RECORD_MEKTEK_RECEIVING]", error);
    if (error instanceof LogisticsActionError) return { error: error.message };
    const retryMessage = getTransactionRetryMessage(error, "Receiving");
    if (retryMessage) return { error: retryMessage };
    return { error: "Gagal mencatat barang masuk Receiving" };
  }
}
