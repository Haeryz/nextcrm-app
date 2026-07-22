"use server";

import type {
  CatalogProductionChannel,
  CatalogStockDirection,
  CatalogWarehouse,
  Prisma,
} from "@prisma/client";
import { revalidatePath } from "next/cache";

import { authOptions } from "@/lib/auth";
import { getCatalogImageSource } from "@/lib/catalog-images";
import {
  calculateCatalogInventoryMonth,
  getCatalogInventoryLocalDateKey,
  getCatalogInventoryMonthKey,
  getCatalogInventoryMonthRange,
  parseCatalogInventoryDateKey,
  type CatalogInventorySnapshot,
} from "@/lib/mektek/catalog-inventory";
import {
  applyCatalogStockMovement,
  recomputeCatalogInventoryFromMonth,
} from "@/lib/mektek/catalog-stock-ledger";
import { canManageMektekCatalog } from "@/lib/mektek/permissions";
import { prismadb } from "@/lib/prisma";
import { getServerSession } from "@/lib/session";

const DEFAULT_PAGE_SIZE = 18;

type InventoryItemRecord = {
  id: string;
  machine: string;
  imagePath: string | null;
  imageMimeType: string | null;
  partNumber: string | null;
  description: string;
  price: number | null;
  productionChannel: CatalogProductionChannel | null;
  rearLocation: string | null;
  frontLocation: string | null;
  rearStock: number;
  frontStock: number;
  remark: string | null;
};

type InventoryMonthRecord = {
  catalogItemId: string;
  month: Date;
  openingRearStock: number;
  openingFrontStock: number;
  closingRearStock: number;
  closingFrontStock: number;
  movements: Array<{
    warehouse: CatalogWarehouse;
    direction: CatalogStockDirection;
    quantity: number;
    occurredAt: Date;
  }>;
};

function compactText(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function catalogWhere(input?: {
  query?: string;
  machine?: string;
  productionChannel?: string;
}): Prisma.CatalogItemWhereInput {
  const query = compactText(input?.query);
  const machine = compactText(input?.machine);
  const rawChannel = compactText(input?.productionChannel).toUpperCase();
  const productionChannel: CatalogProductionChannel | undefined =
    rawChannel === "POWERTRAIN" || rawChannel === "THERMAL"
      ? rawChannel
      : undefined;

  return {
    ...(machine ? { machine } : {}),
    ...(productionChannel ? { productionChannel } : {}),
    ...(query
      ? {
          OR: [
            { description: { contains: query, mode: "insensitive" } },
            { machine: { contains: query, mode: "insensitive" } },
            { partNumber: { contains: query, mode: "insensitive" } },
            { rearLocation: { contains: query, mode: "insensitive" } },
            { frontLocation: { contains: query, mode: "insensitive" } },
          ],
        }
      : {}),
  };
}

async function ensureCatalogManager() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { error: "Unauthorized: silakan Login" } as const;
  if (!canManageMektekCatalog(session.user)) {
    return {
      error:
        "Forbidden: akses Catalog / Item diperlukan",
    } as const;
  }
  return { session } as const;
}

function resolveMonth(month: unknown) {
  const value = compactText(month) || getCatalogInventoryMonthKey();
  try {
    return getCatalogInventoryMonthRange(value);
  } catch {
    return getCatalogInventoryMonthRange(getCatalogInventoryMonthKey());
  }
}

function inventorySnapshot(
  item: InventoryItemRecord,
  ledger: InventoryMonthRecord | undefined,
  initialMonth: Date | undefined,
  requestedMonth: string,
): CatalogInventorySnapshot {
  const ledgerMonth = ledger
    ? getCatalogInventoryMonthKey(new Date(ledger.month))
    : null;
  const isRequestedMonth = ledgerMonth === requestedMonth;
  const inventoryHasStarted =
    !initialMonth ||
    getCatalogInventoryMonthKey(initialMonth) <= requestedMonth;
  const openingRearStock = isRequestedMonth
    ? ledger!.openingRearStock
    : ledger?.closingRearStock ?? (inventoryHasStarted ? item.rearStock : 0);
  const openingFrontStock = isRequestedMonth
    ? ledger!.openingFrontStock
    : ledger?.closingFrontStock ?? (inventoryHasStarted ? item.frontStock : 0);
  const calculated = calculateCatalogInventoryMonth({
    month: requestedMonth,
    openingRearStock,
    openingFrontStock,
    movements: isRequestedMonth ? ledger!.movements : [],
  });

  return {
    id: item.id,
    itemName: item.description,
    productionChannel: item.productionChannel,
    machine: item.machine,
    partNumber: item.partNumber,
    remark: item.remark,
    rearLocation: item.rearLocation,
    frontLocation: item.frontLocation,
    ...calculated,
    openingStockEditable:
      isRequestedMonth &&
      !!initialMonth &&
      getCatalogInventoryMonthKey(initialMonth) === requestedMonth,
  };
}

async function loadInventorySnapshots(
  items: InventoryItemRecord[],
  month: string,
) {
  if (items.length === 0) return [];
  const range = getCatalogInventoryMonthRange(month);
  const itemIds = items.map((item) => item.id);
  const [ledgers, initialLedgers] = await Promise.all([
    prismadb.catalogInventoryMonth.findMany({
      where: {
        catalogItemId: { in: itemIds },
        month: { lte: range.start },
      },
      distinct: ["catalogItemId"],
      orderBy: [{ catalogItemId: "asc" }, { month: "desc" }],
      select: {
        catalogItemId: true,
        month: true,
        openingRearStock: true,
        openingFrontStock: true,
        closingRearStock: true,
        closingFrontStock: true,
        movements: {
          orderBy: { occurredAt: "asc" },
          select: {
            warehouse: true,
            direction: true,
            quantity: true,
            occurredAt: true,
          },
        },
      },
    }),
    prismadb.catalogInventoryMonth.findMany({
      where: { catalogItemId: { in: itemIds } },
      distinct: ["catalogItemId"],
      orderBy: [{ catalogItemId: "asc" }, { month: "asc" }],
      select: { catalogItemId: true, month: true },
    }),
  ]);
  const ledgerByItem = new Map(
    ledgers.map((ledger) => [ledger.catalogItemId, ledger]),
  );
  const initialMonthByItem = new Map(
    initialLedgers.map((ledger) => [ledger.catalogItemId, ledger.month]),
  );
  return items.map((item) =>
    inventorySnapshot(
      item,
      ledgerByItem.get(item.id),
      initialMonthByItem.get(item.id),
      month,
    ),
  );
}

const inventoryItemSelect = {
  id: true,
  machine: true,
  imagePath: true,
  imageMimeType: true,
  partNumber: true,
  description: true,
  price: true,
  productionChannel: true,
  rearLocation: true,
  frontLocation: true,
  rearStock: true,
  frontStock: true,
  remark: true,
} satisfies Prisma.CatalogItemSelect;

export async function listMektekCatalogInventoryItems(input?: {
  query?: string;
  machine?: string;
  productionChannel?: string;
  month?: string;
  page?: number;
  pageSize?: number;
}) {
  const access = await ensureCatalogManager();
  if ("error" in access) throw new Error(access.error);

  const range = resolveMonth(input?.month);
  const pageSize = Math.min(
    Math.max(Number(input?.pageSize) || DEFAULT_PAGE_SIZE, 1),
    60,
  );
  const requestedPage = Math.max(Number(input?.page) || 1, 1);
  const where = catalogWhere(input);
  const [totalCount, machines] = await Promise.all([
    prismadb.catalogItem.count({ where }),
    prismadb.catalogItem.findMany({
      distinct: ["machine"],
      orderBy: { machine: "asc" },
      select: { machine: true },
    }),
  ]);
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const page = Math.min(requestedPage, totalPages);
  const items = await prismadb.catalogItem.findMany({
    where,
    orderBy: [{ description: "asc" }, { machine: "asc" }],
    skip: (page - 1) * pageSize,
    take: pageSize,
    select: inventoryItemSelect,
  });
  const snapshots = await loadInventorySnapshots(items, range.month);
  const snapshotByItem = new Map(snapshots.map((snapshot) => [snapshot.id, snapshot]));

  return {
    items: items.map(({ imageMimeType, ...item }) => ({
      ...item,
      imagePath: getCatalogImageSource({
        id: item.id,
        imageMimeType,
        imagePath: item.imagePath,
      }),
      inventory: snapshotByItem.get(item.id)!,
    })),
    machines: machines.map((row) => row.machine),
    month: range.month,
    daysInMonth: range.daysInMonth,
    page,
    pageSize,
    totalCount,
    totalPages,
  };
}

export async function recordMektekCatalogStockMovement(input: {
  catalogItemId: string;
  warehouse: CatalogWarehouse;
  direction: CatalogStockDirection;
  quantity: number | string;
  occurredOn: string;
  note?: string;
}) {
  const access = await ensureCatalogManager();
  if ("error" in access) return { error: access.error };

  const catalogItemId = compactText(input?.catalogItemId);
  const quantity = Number(input?.quantity);
  const occurredOn = compactText(input?.occurredOn);
  if (!catalogItemId) return { error: "Catalogue Item wajib dipilih" };
  if (input.warehouse !== "REAR" && input.warehouse !== "FRONT") {
    return { error: "Gudang tidak valid" };
  }
  if (input.direction !== "IN" && input.direction !== "OUT") {
    return { error: "Jenis mutasi stok tidak valid" };
  }
  if (!Number.isInteger(quantity) || quantity <= 0) {
    return { error: "Quantity mutasi harus lebih dari 0" };
  }
  let occurredAt: Date;
  try {
    occurredAt = parseCatalogInventoryDateKey(occurredOn);
  } catch {
    return { error: "Tanggal mutasi tidak valid" };
  }
  const todayKey = getCatalogInventoryLocalDateKey();
  if (occurredOn > todayKey) {
    return { error: "Tanggal mutasi tidak boleh berada di masa depan" };
  }

  const range = getCatalogInventoryMonthRange(occurredOn.slice(0, 7));

  try {
    await prismadb.$transaction(async (tx) => {
      await applyCatalogStockMovement(tx, {
        catalogItemId,
        warehouse: input.warehouse,
        direction: input.direction,
        quantity,
        occurredAt,
        note: compactText(input.note) || null,
        createdBy: access.session.user.id,
        source: "MANUAL",
      });
    });

    revalidatePath("/[locale]/(routes)/mektek/items", "page");
    revalidatePath("/[locale]/(routes)/mektek/items/spreadsheet", "page");
    return { data: { catalogItemId, month: range.month } };
  } catch (error) {
    console.log("[RECORD_MEKTEK_CATALOG_STOCK_MOVEMENT]", error);
    return {
      error:
        error instanceof Error
          ? error.message
          : "Gagal mencatat mutasi stok Catalogue Item",
    };
  }
}

export async function setMektekCatalogOpeningStock(input: {
  catalogItemId: string;
  month: string;
  openingRearStock: number | string;
  openingFrontStock: number | string;
}) {
  const access = await ensureCatalogManager();
  if ("error" in access) return { error: access.error };

  const catalogItemId = compactText(input?.catalogItemId);
  const openingRearStock = Number(input?.openingRearStock);
  const openingFrontStock = Number(input?.openingFrontStock);
  if (!catalogItemId) return { error: "Catalogue Item wajib dipilih" };
  if (
    !Number.isInteger(openingRearStock) ||
    openingRearStock < 0 ||
    !Number.isInteger(openingFrontStock) ||
    openingFrontStock < 0
  ) {
    return { error: "Stok awal harus berupa angka 0 atau lebih" };
  }

  let range: ReturnType<typeof getCatalogInventoryMonthRange>;
  try {
    range = getCatalogInventoryMonthRange(compactText(input?.month));
  } catch {
    return { error: "Bulan stok awal tidak valid" };
  }

  try {
    await prismadb.$transaction(async (tx) => {
      const firstLedger = await tx.catalogInventoryMonth.findFirst({
        where: { catalogItemId },
        orderBy: { month: "asc" },
      });
      if (!firstLedger) throw new Error("Bulan stok awal tidak ditemukan");
      if (getCatalogInventoryMonthKey(firstLedger.month) !== range.month) {
        throw new Error("Stok awal hanya dapat diubah pada bulan inventory pertama");
      }
      await tx.catalogInventoryMonth.update({
        where: { id: firstLedger.id },
        data: { openingRearStock, openingFrontStock },
      });
      await recomputeCatalogInventoryFromMonth(
        tx,
        catalogItemId,
        firstLedger.month,
      );
    });
    revalidatePath("/[locale]/(routes)/mektek/items", "page");
    revalidatePath("/[locale]/(routes)/mektek/items/spreadsheet", "page");
    return { data: { catalogItemId, month: range.month } };
  } catch (error) {
    console.log("[SET_MEKTEK_CATALOG_OPENING_STOCK]", error);
    return {
      error:
        error instanceof Error ? error.message : "Gagal memperbarui stok awal",
    };
  }
}

export async function getMektekCatalogInventoryExportData(month?: string) {
  const access = await ensureCatalogManager();
  if ("error" in access) throw new Error(access.error);
  const range = resolveMonth(month);
  const items = await prismadb.catalogItem.findMany({
    orderBy: [{ description: "asc" }, { machine: "asc" }],
    select: inventoryItemSelect,
  });
  const snapshots = await loadInventorySnapshots(items, range.month);
  return { month: range.month, snapshots };
}
