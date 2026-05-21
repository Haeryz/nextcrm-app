"use server";

import crypto from "crypto";
import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";

import { authOptions } from "@/lib/auth";
import { prismadb } from "@/lib/prisma";
import { canCreateMektekOrders } from "@/lib/mektek/permissions";
import { getServerSession } from "@/lib/session";

const DEFAULT_PAGE_SIZE = 24;

export type CatalogItemInput = {
  id?: string;
  machine: string;
  rowNumber?: number | string;
  illustration?: string;
  imagePath?: string;
  partNumber?: string;
  catalogPartNumber?: string;
  description: string;
  quantity?: string;
  price?: number | string;
  remark?: string;
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
  illustration?: string | null;
  partNumber?: string | null;
  catalogPartNumber?: string | null;
  description: string;
  remark?: string | null;
}) {
  return [
    input.machine,
    input.illustration,
    input.partNumber,
    input.catalogPartNumber,
    input.description,
    input.remark,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

async function ensureCatalogManager() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { error: "Unauthorized" };
  if (!canCreateMektekOrders(session.user)) {
    return { error: "Forbidden: only MekTek admin or CS can manage catalog items" };
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
            { searchText: { contains: query.toLowerCase() } },
            { description: { contains: query, mode: "insensitive" } },
            { machine: { contains: query, mode: "insensitive" } },
            { partNumber: { contains: query, mode: "insensitive" } },
            { catalogPartNumber: { contains: query, mode: "insensitive" } },
            { remark: { contains: query, mode: "insensitive" } },
          ],
        }
      : {}),
  };
}

function normalizeCatalogInput(input: CatalogItemInput) {
  const machine = compactText(input.machine);
  const description = compactText(input.description);
  const rowNumber = parsePositiveInt(input.rowNumber) ?? 0;
  const illustration = nullableText(input.illustration);
  const imagePath = nullableText(input.imagePath);
  const partNumber = nullableText(input.partNumber);
  const catalogPartNumber = nullableText(input.catalogPartNumber);
  const quantity = nullableText(input.quantity);
  const price = parsePositiveInt(input.price);
  const remark = nullableText(input.remark);

  if (!machine) return { error: "Machine is required" };
  if (!description) return { error: "Description is required" };

  return {
    data: {
      machine,
      rowNumber,
      illustration,
      imagePath,
      partNumber,
      catalogPartNumber,
      description,
      quantity,
      price,
      remark,
      searchText: buildSearchText({
        machine,
        illustration,
        partNumber,
        catalogPartNumber,
        description,
        remark,
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
    orderBy: [{ machine: "asc" }, { rowNumber: "asc" }, { description: "asc" }],
    skip: (page - 1) * pageSize,
    take: pageSize,
    select: {
      id: true,
      machine: true,
      rowNumber: true,
      illustration: true,
      imagePath: true,
      partNumber: true,
      catalogPartNumber: true,
      description: true,
      quantity: true,
      price: true,
      remark: true,
    },
  });

  return {
    items,
    machines: machines.map((row) => row.machine),
    page,
    pageSize,
    totalCount,
    totalPages,
  };
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
        ...normalized.data,
      },
    });
    revalidatePath("/[locale]/(routes)/mektek/items", "page");
    revalidatePath("/[locale]/customer", "page");
    return { data: item };
  } catch (error) {
    console.log("[CREATE_MEKTEK_CATALOG_ITEM]", error);
    return { error: "Failed to create catalog item" };
  }
}

export async function updateMektekCatalogItem(id: string, input: CatalogItemInput) {
  const access = await ensureCatalogManager();
  if ("error" in access) return { error: access.error };

  const itemId = compactText(id);
  if (!itemId) return { error: "Catalog item ID is required" };

  const normalized = normalizeCatalogInput(input);
  if ("error" in normalized) return { error: normalized.error };

  try {
    const item = await prismadb.catalogItem.update({
      where: { id: itemId },
      data: normalized.data,
    });
    revalidatePath("/[locale]/(routes)/mektek/items", "page");
    revalidatePath("/[locale]/customer", "page");
    return { data: item };
  } catch (error) {
    console.log("[UPDATE_MEKTEK_CATALOG_ITEM]", error);
    return { error: "Failed to update catalog item" };
  }
}

export async function deleteMektekCatalogItem(id: string) {
  const access = await ensureCatalogManager();
  if ("error" in access) return { error: access.error };

  const itemId = compactText(id);
  if (!itemId) return { error: "Catalog item ID is required" };

  try {
    await prismadb.catalogItem.delete({ where: { id: itemId } });
    revalidatePath("/[locale]/(routes)/mektek/items", "page");
    revalidatePath("/[locale]/customer", "page");
    return { data: { id: itemId } };
  } catch (error) {
    console.log("[DELETE_MEKTEK_CATALOG_ITEM]", error);
    return { error: "Failed to delete catalog item" };
  }
}
