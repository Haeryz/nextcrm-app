import { prismadb } from "@/lib/prisma";
import type { CatalogData, CatalogItem } from "@/lib/catalog/types";

type DbCatalogItem = {
  id: string;
  machine: string;
  rowNumber: number;
  illustration: string | null;
  partNumber: string | null;
  catalogPartNumber: string | null;
  description: string;
  quantity: string | null;
  price: number | null;
  remark: string | null;
  searchText: string;
  imageId: string | null;
};

function toCatalogItem(item: DbCatalogItem): CatalogItem {
  return {
    id: item.id,
    machine: item.machine,
    rowNumber: item.rowNumber,
    illustration: item.illustration ?? "",
    partNumber: item.partNumber ?? "",
    catalogPartNumber: item.catalogPartNumber ?? "",
    description: item.description,
    quantity: item.quantity,
    price: item.price,
    remark: item.remark ?? "",
    imageId: item.imageId,
    imageUrl: item.imageId ? `/api/catalog/images/${item.imageId}` : null,
    searchText: item.searchText,
  };
}

export async function getCatalogData(): Promise<CatalogData> {
  const items = await prismadb.catalogItem.findMany({
    orderBy: [{ machine: "asc" }, { rowNumber: "asc" }],
  });
  const machines = Array.from(new Set(items.map((item) => item.machine))).sort((a, b) =>
    a.localeCompare(b)
  );

  return {
    generatedAt: "",
    source: "Postgres CatalogItem",
    machines,
    items: items.map(toCatalogItem),
  };
}

export async function getCatalogItem(itemId: string): Promise<CatalogItem | null> {
  const item = await prismadb.catalogItem.findUnique({
    where: {
      id: itemId,
    },
  });
  return item ? toCatalogItem(item) : null;
}

export async function getRelatedCatalogItems(
  item: CatalogItem,
  limit = 6
): Promise<CatalogItem[]> {
  const items = await prismadb.catalogItem.findMany({
    where: {
      machine: item.machine,
      NOT: {
        id: item.id,
      },
    },
    orderBy: {
      rowNumber: "asc",
    },
    take: limit,
  });

  return items.map(toCatalogItem);
}

export function formatCatalogPrice(price: number | null): string {
  if (typeof price !== "number") return "Ask for price";
  return price.toLocaleString("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  });
}
