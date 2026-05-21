const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");
const { Pool } = require("pg");
const { PrismaPg } = require("@prisma/adapter-pg");

require("dotenv").config({ path: path.resolve(__dirname, "../.env.local") });
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({
  adapter: new PrismaPg(pool),
});
const catalogPath = path.resolve(
  process.cwd(),
  "lib/catalog/generated/catalog-clean.json"
);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function assertCleanCatalog(catalog) {
  if (!catalog || !Array.isArray(catalog.items) || !Array.isArray(catalog.images)) {
    throw new Error(
      "Invalid clean catalog payload. Run: python scripts/tmp_extract_catalog.py"
    );
  }
}

function loadCleanCatalog() {
  if (!fs.existsSync(catalogPath)) {
    throw new Error(
      `Clean catalog not found: ${catalogPath}\nRun: python scripts/tmp_extract_catalog.py --source "PART CATALOG ALL.xlsx"`
    );
  }

  const catalog = readJson(catalogPath);
  assertCleanCatalog(catalog);
  return catalog;
}

function imagePathsByKey(images) {
  const result = new Map();

  for (const image of images) {
    if (!image?.key || !image?.file || !image?.mimeType) {
      throw new Error(`Invalid image record in ${catalogPath}`);
    }

    const filePath = path.resolve(process.cwd(), image.file);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Extracted catalog image missing: ${filePath}`);
    }

    const publicPath = `/${image.file.replace(/^public\//, "")}`;
    result.set(image.key, publicPath);
  }

  return result;
}

function validateItems(items, imagePaths) {
  const ids = new Set();

  for (const item of items) {
    if (!item?.id || !item?.machine || !item?.description || !item?.searchText) {
      throw new Error(`Invalid catalog item in ${catalogPath}`);
    }
    if (ids.has(item.id)) {
      throw new Error(`Duplicate catalog item id: ${item.id}`);
    }
    ids.add(item.id);

    if (item.imageKey && !imagePaths.has(item.imageKey)) {
      throw new Error(`Catalog item ${item.id} references missing image ${item.imageKey}`);
    }
  }
}

async function importCatalog() {
  const catalog = loadCleanCatalog();
  const imagePaths = imagePathsByKey(catalog.images);
  validateItems(catalog.items, imagePaths);

  await prisma.catalogItem.deleteMany({});

  for (const item of catalog.items) {
    await prisma.catalogItem.create({
      data: {
        id: item.id,
        machine: item.machine,
        rowNumber: item.rowNumber,
        illustration: item.illustration,
        imagePath: item.imageKey ? imagePaths.get(item.imageKey) || null : null,
        partNumber: item.partNumber,
        catalogPartNumber: item.catalogPartNumber,
        description: item.description,
        quantity: item.quantity,
        price: item.price,
        remark: item.remark,
        searchText: item.searchText,
      },
    });
  }

  const missingImages = catalog.items.filter((item) => !item.imageKey).length;
  console.log(
    `Imported ${catalog.items.length} catalogue items with ${imagePaths.size} extracted image files into Postgres. ${missingImages} items have no image.`
  );
}

importCatalog()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
