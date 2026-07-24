"use server";

import crypto from "crypto";
import { revalidatePath } from "next/cache";
import type { CatalogProductionChannel, Prisma } from "@prisma/client";

import { authOptions } from "@/lib/auth";
import { prismadb } from "@/lib/prisma";
import { canManageMektekCatalog } from "@/lib/mektek/permissions";
import { getServerSession } from "@/lib/session";
import { getCatalogImageSource } from "@/lib/catalog-images";
import { buildMektekDashboardAnalytics } from "@/lib/mektek/dashboard-analytics";
import { buildCatalogHighlights } from "@/lib/mektek/catalog-insights";
import { mektekOrderWhere } from "@/lib/mektek/orders";
import {
  getCatalogInventoryMonthKey,
  getCatalogInventoryMonthRange,
} from "@/lib/mektek/catalog-inventory";
import { applyCatalogStockMovement } from "@/lib/mektek/catalog-stock-ledger";

const DEFAULT_PAGE_SIZE = 24;

export type CatalogItemInput = {
  id?: string;
  itemName: string;
  machine: string;
  partNumber?: string;
  price?: number | string;
  productionChannel?: CatalogProductionChannel | "";
  rearLocation?: string;
  frontLocation?: string;
  remark?: string;
  initialRearStock?: number | string;
  initialFrontStock?: number | string;
};

function compactText(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function nullableText(value: unknown) {
  const text = compactText(value);
  return text ? text : null;
}

function parsePositiveInt(value: unknown) {
  const numeric =
    typeof value === "number" ? value : Number(String(value ?? "").replace(/\D/g, ""));
  return Number.isFinite(numeric) && numeric > 0 ? Math.floor(numeric) : null;
}

function parseNonNegativeInt(value: unknown) {
  const raw = compactText(value);
  if (!raw) return 0;
  const numeric = Number(raw);
  return Number.isInteger(numeric) && numeric >= 0 ? numeric : null;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

function buildSearchText(input: {
  machine: string;
  partNumber?: string | null;
  description: string;
}) {
  return [input.machine, input.partNumber, input.description]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

async function ensureCatalogManager() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { error: "Unauthorized: silakan Login" };
  if (!canManageMektekCatalog(session.user)) {
    return { error: "Forbidden: akses Catalog / Item diperlukan" };
  }
  return { session };
}

function catalogWhere(input?: {
  query?: string;
  machine?: string;
}): Prisma.CatalogItemWhereInput {
  const query = compactText(input?.query);
  const machine = compactText(input?.machine);

  return {
    ...(machine ? { machine } : {}),
    ...(query
      ? {
          OR: [
            { description: { contains: query, mode: "insensitive" } },
            { machine: { contains: query, mode: "insensitive" } },
            { partNumber: { contains: query, mode: "insensitive" } },
          ],
        }
      : {}),
  };
}

function normalizeCatalogInput(input: CatalogItemInput) {
  const machine = compactText(input.machine);
  const description = compactText(input.itemName);
  const partNumber = nullableText(input.partNumber);
  const price = parsePositiveInt(input.price);
  const initialRearStock = parseNonNegativeInt(input.initialRearStock);
  const initialFrontStock = parseNonNegativeInt(input.initialFrontStock);
  const rearStockProvided = compactText(input.initialRearStock) !== "";
  const frontStockProvided = compactText(input.initialFrontStock) !== "";
  const rawProductionChannel = compactText(input.productionChannel).toUpperCase();
  const productionChannel: CatalogProductionChannel | null =
    rawProductionChannel === "POWERTRAIN" || rawProductionChannel === "THERMAL"
      ? rawProductionChannel
      : null;

  if (!machine) return { error: "Machine wajib diisi" };
  if (!description) return { error: "Item Name wajib diisi" };
  if (initialRearStock === null || initialFrontStock === null) {
    return { error: "Stok awal harus berupa angka 0 atau lebih" };
  }

  return {
    data: {
      machine,
      partNumber,
      description,
      price,
      productionChannel,
      rearLocation: nullableText(input.rearLocation),
      frontLocation: nullableText(input.frontLocation),
      remark: nullableText(input.remark),
      searchText: buildSearchText({
        machine,
        partNumber,
        description,
      }),
    },
    initialRearStock,
    initialFrontStock,
    rearStockProvided,
    frontStockProvided,
  };
}

async function adjustCatalogWarehouseStock(
  tx: Prisma.TransactionClient,
  input: {
    catalogItemId: string;
    warehouse: "REAR" | "FRONT";
    currentStock: number;
    targetStock: number;
    createdBy: string;
  },
) {
  const difference = input.targetStock - input.currentStock;
  if (difference === 0) return;

  await applyCatalogStockMovement(tx, {
    catalogItemId: input.catalogItemId,
    warehouse: input.warehouse,
    direction: difference > 0 ? "IN" : "OUT",
    quantity: Math.abs(difference),
    occurredAt: new Date(),
    note: `Koreksi total unit melalui Edit Spare Part (${input.currentStock} → ${input.targetStock})`,
    createdBy: input.createdBy,
    source: "MANUAL",
  });
}

export async function listMektekCatalogItems(input?: {
  query?: string;
  machine?: string;
  page?: number;
  pageSize?: number;
}) {
  const pageSize = Math.min(Math.max(Number(input?.pageSize) || DEFAULT_PAGE_SIZE, 1), 60);
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
    orderBy: [{ machine: "asc" }, { description: "asc" }],
    skip: (page - 1) * pageSize,
    take: pageSize,
    select: {
      id: true,
      machine: true,
      imagePath: true,
      imageMimeType: true,
      partNumber: true,
      description: true,
      quantity: true,
      price: true,
    },
  });

  return {
    items: items.map(({ imageMimeType, ...item }) => ({
      ...item,
      imagePath: getCatalogImageSource({
        id: item.id,
        imageMimeType,
        imagePath: item.imagePath,
      }),
    })),
    machines: machines.map((row) => row.machine),
    page,
    pageSize,
    totalCount,
    totalPages,
  };
}

export async function getMektekCatalogHighlights() {
  const [newestItems, orders] = await Promise.all([
    prismadb.catalogItem.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        machine: true,
        imagePath: true,
        imageMimeType: true,
        partNumber: true,
        description: true,
        quantity: true,
        price: true,
        createdAt: true,
      },
    }),
    prismadb.crm_Accounts_Tasks.findMany({
      where: mektekOrderWhere(),
      select: {
        id: true,
        createdAt: true,
        taskStatus: true,
        content: true,
        tags: true,
      },
    }),
  ]);
  const salesRanks = buildMektekDashboardAnalytics(orders).topProducts;
  const popularIds = salesRanks
    .map((item) => item.catalogItemId)
    .filter((id): id is string => Boolean(id));
  const popularItems = popularIds.length
    ? await prismadb.catalogItem.findMany({
        where: { id: { in: popularIds } },
        select: {
          id: true,
          machine: true,
          imagePath: true,
          imageMimeType: true,
          partNumber: true,
          description: true,
          quantity: true,
          price: true,
          createdAt: true,
        },
      })
    : [];
  const uniqueItems = new Map(
    [...newestItems, ...popularItems].map((item) => [item.id, item]),
  );
  const mappedItems = [...uniqueItems.values()].map(({ imageMimeType, ...item }) => ({
    ...item,
    imagePath: getCatalogImageSource({
      id: item.id,
      imageMimeType,
      imagePath: item.imagePath,
    }),
  }));

  return buildCatalogHighlights(mappedItems, salesRanks);
}

export async function createMektekCatalogItem(input: CatalogItemInput) {
  const access = await ensureCatalogManager();
  if ("error" in access) return { error: access.error };

  const normalized = normalizeCatalogInput(input);
  if ("error" in normalized) return { error: normalized.error };

  const id =
    compactText(input.id) ||
    `${slugify(normalized.data.description || "catalog-item")}-${crypto
      .randomBytes(5)
      .toString("hex")}`;

  try {
    const month = getCatalogInventoryMonthRange(
      getCatalogInventoryMonthKey(),
    ).start;
    const item = await prismadb.$transaction(async (tx) => {
      const created = await tx.catalogItem.create({
        data: {
          id,
          rowNumber: 0,
          ...normalized.data,
          rearStock: normalized.initialRearStock,
          frontStock: normalized.initialFrontStock,
        },
        select: { id: true },
      });
      await tx.catalogInventoryMonth.create({
        data: {
          catalogItemId: created.id,
          month,
          openingRearStock: normalized.initialRearStock,
          openingFrontStock: normalized.initialFrontStock,
          closingRearStock: normalized.initialRearStock,
          closingFrontStock: normalized.initialFrontStock,
        },
      });
      return created;
    });
    revalidatePath("/[locale]/(routes)/mektek/items", "page");
    revalidatePath("/[locale]/(routes)/mektek/dashboard", "page");
    revalidatePath("/[locale]/customer", "page");
    return { data: item };
  } catch (error) {
    console.log("[CREATE_MEKTEK_CATALOG_ITEM]", error);
    return { error: "Gagal membuat Catalogue Item" };
  }
}

export async function updateMektekCatalogItem(id: string, input: CatalogItemInput) {
  const access = await ensureCatalogManager();
  if ("error" in access) return { error: access.error };

  const itemId = compactText(id);
  if (!itemId) return { error: "Catalogue Item ID wajib diisi" };

  const normalized = normalizeCatalogInput(input);
  if ("error" in normalized) return { error: normalized.error };

  try {
    const item = await prismadb.$transaction(async (tx) => {
      const current = await tx.catalogItem.update({
        where: { id: itemId },
        data: normalized.data,
        select: { id: true, rearStock: true, frontStock: true },
      });
      if (normalized.rearStockProvided) {
        await adjustCatalogWarehouseStock(tx, {
          catalogItemId: itemId,
          warehouse: "REAR",
          currentStock: current.rearStock,
          targetStock: normalized.initialRearStock,
          createdBy: access.session.user.id,
        });
      }
      if (normalized.frontStockProvided) {
        await adjustCatalogWarehouseStock(tx, {
          catalogItemId: itemId,
          warehouse: "FRONT",
          currentStock: current.frontStock,
          targetStock: normalized.initialFrontStock,
          createdBy: access.session.user.id,
        });
      }
      return { id: current.id };
    });
    revalidatePath("/[locale]/(routes)/mektek/items", "page");
    revalidatePath("/[locale]/(routes)/mektek/dashboard", "page");
    revalidatePath("/[locale]/customer", "page");
    return { data: item };
  } catch (error) {
    console.log("[UPDATE_MEKTEK_CATALOG_ITEM]", error);
    return { error: "Gagal memperbarui Catalogue Item" };
  }
}

export async function deleteMektekCatalogItem(id: string) {
  const access = await ensureCatalogManager();
  if ("error" in access) return { error: access.error };

  const itemId = compactText(id);
  if (!itemId) return { error: "Catalogue Item ID wajib diisi" };

  try {
    await prismadb.catalogItem.delete({ where: { id: itemId } });
    revalidatePath("/[locale]/(routes)/mektek/items", "page");
    revalidatePath("/[locale]/(routes)/mektek/dashboard", "page");
    revalidatePath("/[locale]/customer", "page");
    return { data: { id: itemId } };
  } catch (error) {
    console.log("[DELETE_MEKTEK_CATALOG_ITEM]", error);
    return { error: "Gagal menghapus Catalogue Item" };
  }
}
