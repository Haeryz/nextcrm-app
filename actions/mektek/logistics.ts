"use server";

import { revalidatePath } from "next/cache";
import type { LogisticsPurchaseOrderStatus, Prisma } from "@prisma/client";

import { authOptions } from "@/lib/auth";
import {
  isLogisticsPurchaseOrderType,
  normalizeLogisticsReference,
  validateLogisticsReceipt,
} from "@/lib/mektek/logistics";
import { getCatalogInventoryLocalDateKey } from "@/lib/mektek/catalog-inventory";
import { canManageMektekLogistics } from "@/lib/mektek/permissions";
import { boundedText } from "@/lib/mektek/sanitize";
import { prismadb } from "@/lib/prisma";
import { getServerSession } from "@/lib/session";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PO_NUMBER_LEN = 80;
const MAX_NAME_LEN = 160;
const MAX_PART_LEN = 180;
const MAX_PART_NUMBER_LEN = 100;
const MAX_PO_TYPE_LEN = 60;
const MAX_NOTE_LEN = 500;
const MAX_DELIVERY_NOTE_LEN = 100;
const MAX_ITEMS_PER_PO = 100;

export type LogisticsPurchaseOrderItemInput = {
  partName: string;
  partNumber?: string;
  orderedQuantity: string | number;
};

export type LogisticsPurchaseOrderInput = {
  poNumber: string;
  supplierName: string;
  userName: string;
  projectName: string;
  inputDate: string;
  dueDate: string;
  poType: string;
  notes?: string;
  items: LogisticsPurchaseOrderItemInput[];
};

export type LogisticsReceiptInput = {
  purchaseOrderItemId: string;
  picId: string;
  deliveryNoteNumber: string;
  quantity: string | number;
  receivedAt: string;
  note?: string;
};

export type LogisticsPurchaseOrderReceiptInput = {
  purchaseOrderId: string;
  picId: string;
  deliveryNoteNumber: string;
  receivedAt: string;
  items: Array<{
    purchaseOrderItemId: string;
    quantity: string | number;
    note?: string;
  }>;
};

class LogisticsActionError extends Error {}

async function ensureLogisticsManager() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { error: "Unauthorized: silakan Login" } as const;
  if (!canManageMektekLogistics(session.user)) {
    return {
      error: "Forbidden: hanya staf Logistics atau Admin yang dapat mengelola PO",
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

function normalizePurchaseOrderInput(input: LogisticsPurchaseOrderInput) {
  const poNumber = normalizeLogisticsReference(
    boundedText(input?.poNumber, MAX_PO_NUMBER_LEN),
  );
  const supplierName = boundedText(input?.supplierName, MAX_NAME_LEN);
  const userName = boundedText(input?.userName, MAX_NAME_LEN);
  const projectName = boundedText(input?.projectName, MAX_NAME_LEN);
  const poType = boundedText(input?.poType, MAX_PO_TYPE_LEN) || "Normal";
  const notes = boundedText(input?.notes, MAX_NOTE_LEN);
  const inputDate = parseDateOnly(input?.inputDate);
  const dueDate = parseDateOnly(input?.dueDate);

  if (!poNumber) return { error: "PO No. wajib diisi" } as const;
  if (!supplierName) return { error: "Supplier wajib diisi" } as const;
  if (!userName) return { error: "User / PT wajib diisi" } as const;
  if (!projectName) return { error: "Job Site / Project wajib diisi" } as const;
  if (!isLogisticsPurchaseOrderType(poType)) {
    return { error: "PO Type harus Normal atau Consignment" } as const;
  }
  if (!inputDate) return { error: "Tanggal Input tidak valid" } as const;
  if (!dueDate) return { error: "Due To tidak valid" } as const;
  if (dueDate < inputDate) {
    return { error: "Due To tidak boleh sebelum Tanggal Input" } as const;
  }
  if (!Array.isArray(input?.items) || input.items.length === 0) {
    return { error: "Minimal satu Part wajib ditambahkan" } as const;
  }
  if (input.items.length > MAX_ITEMS_PER_PO) {
    return { error: `Maksimal ${MAX_ITEMS_PER_PO} Part dalam satu PO` } as const;
  }

  const itemKeys = new Set<string>();
  const items: Array<{
    position: number;
    partName: string;
    partNumber: string | null;
    orderedQuantity: number;
  }> = [];

  for (const [index, item] of input.items.entries()) {
    const partName = boundedText(item?.partName, MAX_PART_LEN);
    const partNumber = boundedText(item?.partNumber, MAX_PART_NUMBER_LEN);
    const orderedQuantity = parsePositiveInteger(item?.orderedQuantity);
    if (!partName) return { error: `Part baris ${index + 1} wajib diisi` } as const;
    if (!orderedQuantity) {
      return {
        error: `QTY Order baris ${index + 1} harus berupa angka bulat lebih dari 0`,
      } as const;
    }

    const itemKey = `${partName.toUpperCase()}|${partNumber.toUpperCase()}`;
    if (itemKeys.has(itemKey)) {
      return { error: `Part ${partName} tercantum lebih dari satu kali` } as const;
    }
    itemKeys.add(itemKey);
    items.push({
      position: index + 1,
      partName,
      partNumber: partNumber || null,
      orderedQuantity,
    });
  }

  return {
    data: {
      poNumber,
      supplierName,
      userName,
      projectName,
      inputDate,
      dueDate,
      poType,
      notes: notes || null,
      items,
    },
  } as const;
}

function logisticsWhere(input?: {
  query?: string;
  status?: string;
}): Prisma.LogisticsPurchaseOrderWhereInput {
  const query = compactText(input?.query);
  const rawStatus = compactText(input?.status).toUpperCase();
  const status: LogisticsPurchaseOrderStatus | undefined =
    rawStatus === "OPEN" || rawStatus === "CLOSED" ? rawStatus : undefined;

  return {
    ...(status ? { status } : {}),
    ...(query
      ? {
          OR: [
            { poNumber: { contains: query, mode: "insensitive" } },
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
                          deliveryNoteNumber: {
                            contains: query,
                            mode: "insensitive",
                          },
                        },
                      },
                    },
                    {
                      receipts: {
                        some: {
                          pic: {
                            name: { contains: query, mode: "insensitive" },
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

export async function listMektekLogisticsPurchaseOrders(input?: {
  query?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}) {
  const access = await ensureLogisticsManager();
  if ("error" in access) return { error: access.error };

  const pageSize = Math.min(
    Math.max(Number(input?.pageSize) || DEFAULT_PAGE_SIZE, 1),
    50,
  );
  const requestedPage = Math.max(Number(input?.page) || 1, 1);
  const where = logisticsWhere(input);
  const totalCount = await prismadb.logisticsPurchaseOrder.count({ where });
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const page = Math.min(requestedPage, totalPages);
  const today =
    parseDateOnly(getCatalogInventoryLocalDateKey()) ??
    new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()));

  const [purchaseOrders, statusCounts, quantities, overduePurchaseOrders] =
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
              receipts: {
                orderBy: [{ receivedAt: "desc" }, { createdAt: "desc" }],
                select: {
                  id: true,
                  purchaseOrderItemId: true,
                  deliveryNoteNumber: true,
                  quantity: true,
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
        _count: { _all: true },
      }),
      prismadb.logisticsPurchaseOrderItem.aggregate({
        _sum: { orderedQuantity: true, receivedQuantity: true },
      }),
      prismadb.logisticsPurchaseOrder.count({
        where: { status: "OPEN", dueDate: { lt: today } },
      }),
    ]);

  const openPurchaseOrders =
    statusCounts.find((row) => row.status === "OPEN")?._count._all ?? 0;
  const closedPurchaseOrders =
    statusCounts.find((row) => row.status === "CLOSED")?._count._all ?? 0;
  const totalOrdered = quantities._sum.orderedQuantity ?? 0;
  const totalReceived = quantities._sum.receivedQuantity ?? 0;

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
        overduePurchaseOrders,
        totalOrdered,
        totalReceived,
        totalRemaining: Math.max(0, totalOrdered - totalReceived),
      },
    },
  };
}

export async function createMektekLogisticsPurchaseOrder(
  input: LogisticsPurchaseOrderInput,
) {
  const access = await ensureLogisticsManager();
  if ("error" in access) return { error: access.error };

  const normalized = normalizePurchaseOrderInput(input);
  if ("error" in normalized) return { error: normalized.error };

  try {
    const purchaseOrder = await prismadb.logisticsPurchaseOrder.create({
      data: {
        poNumber: normalized.data.poNumber,
        supplierName: normalized.data.supplierName,
        userName: normalized.data.userName,
        projectName: normalized.data.projectName,
        inputDate: normalized.data.inputDate,
        dueDate: normalized.data.dueDate,
        poType: normalized.data.poType,
        notes: normalized.data.notes,
        createdBy: access.session.user.id,
        items: { create: normalized.data.items },
      },
      include: { items: true },
    });

    revalidatePath("/[locale]/(routes)/mektek/logistics", "page");
    return { data: purchaseOrder };
  } catch (error) {
    console.log("[CREATE_MEKTEK_LOGISTICS_PO]", error);
    if (isPrismaUniqueError(error)) {
      return { error: `PO No. ${normalized.data.poNumber} sudah terdaftar` };
    }
    return { error: "Gagal membuat Purchase Order Logistics" };
  }
}

export async function recordMektekLogisticsPurchaseOrderReceipt(
  input: LogisticsPurchaseOrderReceiptInput,
) {
  const access = await ensureLogisticsManager();
  if ("error" in access) return { error: access.error };

  const purchaseOrderId = compactText(input?.purchaseOrderId);
  const picId = compactText(input?.picId);
  const deliveryNoteNumber = normalizeLogisticsReference(
    boundedText(input?.deliveryNoteNumber, MAX_DELIVERY_NOTE_LEN),
  );
  const receivedAt = parseDateOnly(input?.receivedAt);
  const rawItems = Array.isArray(input?.items) ? input.items : [];
  const items = rawItems.map((item) => ({
    purchaseOrderItemId: compactText(item?.purchaseOrderItemId),
    quantity: parsePositiveInteger(item?.quantity),
    note: boundedText(item?.note, MAX_NOTE_LEN),
  }));

  if (!purchaseOrderId) return { error: "Purchase Order wajib dipilih" };
  if (!picId) return { error: "PIC wajib dipilih" };
  if (!deliveryNoteNumber) return { error: "Nomor Surat Jalan wajib diisi" };
  if (!receivedAt) return { error: "Tanggal Masuk tidak valid" };
  if (items.length === 0) {
    return { error: "Pilih minimal satu item yang diterima" };
  }
  if (items.some((item) => !item.purchaseOrderItemId || !item.quantity)) {
    return { error: "QTY Masuk setiap item harus berupa angka bulat lebih dari 0" };
  }
  if (new Set(items.map((item) => item.purchaseOrderItemId)).size !== items.length) {
    return { error: "Item Surat Jalan tidak boleh duplikat" };
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
      if (!pic) {
        throw new LogisticsActionError("PIC tidak aktif atau tidak ditemukan");
      }

      const purchaseOrder = await tx.logisticsPurchaseOrder.findUnique({
        where: { id: purchaseOrderId },
        select: {
          id: true,
          poNumber: true,
          inputDate: true,
          items: {
            orderBy: { position: "asc" },
            select: {
              id: true,
              orderedQuantity: true,
              receivedQuantity: true,
              status: true,
            },
          },
        },
      });
      if (!purchaseOrder) {
        throw new LogisticsActionError("Purchase Order tidak ditemukan");
      }
      if (receivedAt < purchaseOrder.inputDate) {
        throw new LogisticsActionError(
          "Tanggal Masuk tidak boleh sebelum Tanggal Input PO",
        );
      }

      const purchaseOrderItems = new Map(
        purchaseOrder.items.map((item) => [item.id, item]),
      );
      const validatedItems = items.map((inputItem) => {
        const item = purchaseOrderItems.get(inputItem.purchaseOrderItemId);
        if (!item) {
          throw new LogisticsActionError(
            "Terdapat item yang bukan bagian dari Purchase Order ini",
          );
        }
        const validation = validateLogisticsReceipt({
          orderedQuantity: item.orderedQuantity,
          receivedQuantity: item.receivedQuantity,
          incomingQuantity: inputItem.quantity!,
        });
        if ("error" in validation) {
          throw new LogisticsActionError(`${validation.error} untuk item PO`);
        }
        return {
          item,
          quantity: inputItem.quantity!,
          note: inputItem.note,
          progress: validation.data,
        };
      });

      // Lock the PO header so duplicate delivery-note checks and all item
      // increments for this PO are serialized as one atomic receipt.
      await tx.logisticsPurchaseOrder.update({
        where: { id: purchaseOrder.id },
        data: { updatedAt: new Date() },
      });

      const duplicateReceipt = await tx.logisticsReceipt.findFirst({
        where: {
          deliveryNoteNumber,
          purchaseOrderItem: { purchaseOrderId: purchaseOrder.id },
        },
        select: { id: true },
      });
      if (duplicateReceipt) {
        throw new LogisticsActionError(
          `Surat Jalan ${deliveryNoteNumber} sudah pernah diinput untuk PO ini`,
        );
      }

      const receipts = [];
      for (const validatedItem of validatedItems) {
        const updated = await tx.logisticsPurchaseOrderItem.updateMany({
          where: {
            id: validatedItem.item.id,
            purchaseOrderId: purchaseOrder.id,
            status: "OPEN",
            receivedQuantity: {
              lte: validatedItem.item.orderedQuantity - validatedItem.quantity,
            },
          },
          data: {
            receivedQuantity: { increment: validatedItem.quantity },
            status: validatedItem.progress.status,
          },
        });
        if (updated.count !== 1) {
          throw new LogisticsActionError(
            "QTY item telah berubah. Muat ulang halaman sebelum input kembali.",
          );
        }

        const receipt = await tx.logisticsReceipt.create({
          data: {
            purchaseOrderItemId: validatedItem.item.id,
            picId: pic.id,
            deliveryNoteNumber,
            quantity: validatedItem.quantity,
            receivedAt,
            note: validatedItem.note || null,
            createdBy: access.session.user.id,
          },
        });
        receipts.push(receipt);
      }

      const openItems = await tx.logisticsPurchaseOrderItem.count({
        where: { purchaseOrderId: purchaseOrder.id, status: "OPEN" },
      });
      const purchaseOrderStatus = openItems === 0 ? "CLOSED" : "OPEN";
      await tx.logisticsPurchaseOrder.update({
        where: { id: purchaseOrder.id },
        data: { status: purchaseOrderStatus },
      });

      return {
        receipts,
        purchaseOrderId: purchaseOrder.id,
        purchaseOrderStatus,
        itemProgresses: validatedItems.map(({ item, progress }) => ({
          purchaseOrderItemId: item.id,
          ...progress,
        })),
      };
    });

    revalidatePath("/[locale]/(routes)/mektek/logistics", "page");
    revalidatePath("/[locale]/(routes)/mektek/logistics/spreadsheet", "page");
    return { data: result };
  } catch (error) {
    console.log("[RECORD_MEKTEK_LOGISTICS_PO_RECEIPT]", error);
    if (error instanceof LogisticsActionError) return { error: error.message };
    if (isPrismaUniqueError(error)) {
      return {
        error: `Surat Jalan ${deliveryNoteNumber} sudah pernah diinput untuk PO ini`,
      };
    }
    return { error: "Gagal mencatat Surat Jalan Logistics" };
  }
}

export async function recordMektekLogisticsReceipt(input: LogisticsReceiptInput) {
  const access = await ensureLogisticsManager();
  if ("error" in access) return { error: access.error };

  const purchaseOrderItemId = compactText(input?.purchaseOrderItemId);
  const picId = compactText(input?.picId);
  const deliveryNoteNumber = normalizeLogisticsReference(
    boundedText(input?.deliveryNoteNumber, MAX_DELIVERY_NOTE_LEN),
  );
  const quantity = parsePositiveInteger(input?.quantity);
  const receivedAt = parseDateOnly(input?.receivedAt);
  const note = boundedText(input?.note, MAX_NOTE_LEN);

  if (!purchaseOrderItemId) return { error: "Item PO wajib dipilih" };
  if (!picId) return { error: "PIC wajib dipilih" };
  if (!deliveryNoteNumber) return { error: "Nomor Surat Jalan wajib diisi" };
  if (!quantity) {
    return { error: "QTY Masuk harus berupa angka bulat lebih dari 0" };
  }
  if (!receivedAt) return { error: "Tanggal Masuk tidak valid" };
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
      if (!pic) {
        throw new LogisticsActionError("PIC tidak aktif atau tidak ditemukan");
      }

      const item = await tx.logisticsPurchaseOrderItem.findUnique({
        where: { id: purchaseOrderItemId },
        include: {
          purchaseOrder: {
            select: { id: true, inputDate: true, poNumber: true },
          },
        },
      });
      if (!item) throw new LogisticsActionError("Item PO tidak ditemukan");
      if (receivedAt < item.purchaseOrder.inputDate) {
        throw new LogisticsActionError(
          "Tanggal Masuk tidak boleh sebelum Tanggal Input PO",
        );
      }

      const validation = validateLogisticsReceipt({
        orderedQuantity: item.orderedQuantity,
        receivedQuantity: item.receivedQuantity,
        incomingQuantity: quantity,
      });
      if ("error" in validation) throw new LogisticsActionError(validation.error);

      // Lock the PO header so receipts for different items in the same PO are
      // serialized. Without this lock, two simultaneous final receipts could
      // each see the other item as OPEN and leave the parent PO incorrectly open.
      await tx.logisticsPurchaseOrder.update({
        where: { id: item.purchaseOrder.id },
        data: { updatedAt: new Date() },
      });

      const updated = await tx.logisticsPurchaseOrderItem.updateMany({
        where: {
          id: item.id,
          status: "OPEN",
          receivedQuantity: { lte: item.orderedQuantity - quantity },
        },
        data: {
          receivedQuantity: { increment: quantity },
          status: validation.data.status,
        },
      });
      if (updated.count !== 1) {
        throw new LogisticsActionError(
          "QTY item telah berubah. Muat ulang halaman sebelum input kembali.",
        );
      }

      const receipt = await tx.logisticsReceipt.create({
        data: {
          purchaseOrderItemId: item.id,
          picId: pic.id,
          deliveryNoteNumber,
          quantity,
          receivedAt,
          note: note || null,
          createdBy: access.session.user.id,
        },
      });

      const openItems = await tx.logisticsPurchaseOrderItem.count({
        where: { purchaseOrderId: item.purchaseOrder.id, status: "OPEN" },
      });
      const purchaseOrderStatus = openItems === 0 ? "CLOSED" : "OPEN";
      await tx.logisticsPurchaseOrder.update({
        where: { id: item.purchaseOrder.id },
        data: { status: purchaseOrderStatus },
      });

      return {
        receipt,
        purchaseOrderId: item.purchaseOrder.id,
        purchaseOrderStatus,
        itemProgress: validation.data,
      };
    });

    revalidatePath("/[locale]/(routes)/mektek/logistics", "page");
    return { data: result };
  } catch (error) {
    console.log("[RECORD_MEKTEK_LOGISTICS_RECEIPT]", error);
    if (error instanceof LogisticsActionError) return { error: error.message };
    if (isPrismaUniqueError(error)) {
      return {
        error: `Surat Jalan ${deliveryNoteNumber} sudah pernah diinput untuk item ini`,
      };
    }
    return { error: "Gagal mencatat barang masuk Logistics" };
  }
}
