import "dotenv/config";

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { Prisma } from "@prisma/client";
import { prismadb } from "../lib/prisma";

type CatalogItemInput = {
  id: string;
  machine: string;
  rowNumber: number;
  partNumber: string | null;
  catalogPartNumber: string | null;
  description: string;
  quantity: string | null;
  price: number | null;
  remark: string | null;
  searchText: string;
  productionChannel: "POWERTRAIN" | "THERMAL" | "AC_RUANGAN" | null;
  rearLocation: string | null;
  frontLocation: string | null;
  rearStock: number;
  frontStock: number;
  minStock: number;
};

type Payload = {
  sourceFileName: string;
  sheetName: string;
  stats: { items: number };
  items: CatalogItemInput[];
};

async function main() {
  const commit = process.argv.includes("--commit");
  const dataPath = resolve(".tmp/spare-part-catalog.json");
  const data = JSON.parse(await readFile(dataPath, "utf8")) as Payload;

  if (!commit) {
    console.log(
      JSON.stringify(
        {
          mode: "dry-run",
          source: data.sourceFileName,
          sheet: data.sheetName,
          items: data.items.length,
          channels: [...new Set(data.items.map((i) => i.productionChannel).filter(Boolean))],
        },
        null,
        2,
      ),
    );
    return;
  }

  const existing = await prismadb.catalogItem.count();
  console.log(`Existing catalog items before import: ${existing}`);

  if (existing > 0) {
    const deleted = await prismadb.catalogItem.deleteMany({});
    console.log(`Deleted ${deleted.count} existing catalog items.`);
  }

  const chunks = <T>(values: T[], size: number) => {
    const result: T[][] = [];
    for (let i = 0; i < values.length; i += size) result.push(values.slice(i, i + size));
    return result;
  };

  const items: Prisma.CatalogItemCreateManyInput[] = data.items.map((item) => ({
    id: item.id,
    machine: item.machine,
    rowNumber: item.rowNumber,
    illustration: null,
    imagePath: null,
    partNumber: item.partNumber,
    catalogPartNumber: item.catalogPartNumber,
    description: item.description,
    quantity: item.quantity,
    price: item.price,
    remark: item.remark,
    productionChannel: item.productionChannel,
    rearLocation: item.rearLocation,
    frontLocation: item.frontLocation,
    rearStock: item.rearStock,
    frontStock: item.frontStock,
    minStock: item.minStock,
    searchText: item.searchText,
  }));

  for (const group of chunks(items, 500)) {
    await prismadb.catalogItem.createMany({ data: group });
  }

  const total = await prismadb.catalogItem.count();
  console.log(
    JSON.stringify(
      { mode: "commit", imported: items.length, totalCatalogItems: total },
      null,
      2,
    ),
  );
}

main().finally(() => prismadb.$disconnect());
