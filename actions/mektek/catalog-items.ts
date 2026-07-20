"use server";

import crypto from "crypto";
import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";

import { authOptions } from "@/lib/auth";
import { prismadb } from "@/lib/prisma";
import { canCreateMektekOrders } from "@/lib/mektek/permissions";
import { getServerSession } from "@/lib/session";
import { getCatalogImageSource } from "@/lib/catalog-images";
import { buildMektekDashboardAnalytics } from "@/lib/mektek/dashboard-analytics";
import {
  buildCatalogHighlights,
  buildQuantityUpdateData,
} from "@/lib/mektek/catalog-insights";
import { mektekOrderWhere } from "@/lib/mektek/orders";

const DEFAULT_PAGE_SIZE = 24;

export type CatalogItemInput = {
  id?: string;
  machine: string;
  partNumber?: string;
  description: string;
  quantity?: string;
  price?: number | string;
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
  if (!canCreateMektekOrders(session.user)) {
    return { error: "Forbidden: hanya Admin atau CS MekTek yang dapat mengelola Catalogue Items" };
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
  const description = compactText(input.description);
  const partNumber = nullableText(input.partNumber);
  const quantity = nullableText(input.quantity);
  const price = parsePositiveInt(input.price);

  if (!machine) return { error: "Machine wajib diisi" };
  if (!description) return { error: "Description wajib diisi" };

  return {
    data: {
      machine,
      partNumber,
      description,
      quantity,
      price,
      searchText: buildSearchText({
        machine,
        partNumber,
        description,
      }),
    },
  };
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
    `${slugify(normalized.data.machine || "catalog-item")}-${crypto
      .randomBytes(5)
      .toString("hex")}`;

  try {
    const item = await prismadb.catalogItem.create({
      data: {
        id,
        rowNumber: 0,
        ...normalized.data,
      },
      select: { id: true },
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
    const current = await prismadb.catalogItem.findUnique({
      where: { id: itemId },
      select: { quantity: true },
    });
    if (!current) return { error: "Catalogue Item tidak ditemukan" };
    const item = await prismadb.catalogItem.update({
      where: { id: itemId },
      data: {
        ...normalized.data,
        ...buildQuantityUpdateData(current.quantity, normalized.data.quantity),
      },
      select: { id: true },
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
