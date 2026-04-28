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

function imageBytesByKey(images) {
  const result = new Map();

  for (const image of images) {
    if (!image?.key || !image?.file || !image?.mimeType) {
      throw new Error(`Invalid image record in ${catalogPath}`);
    }

    const filePath = path.resolve(process.cwd(), image.file);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Extracted catalog image missing: ${filePath}`);
    }

    result.set(image.key, {
      mimeType: image.mimeType,
      bytes: fs.readFileSync(filePath),
    });
  }

  return result;
}

function validateItems(items, imagePayloads) {
  const ids = new Set();

  for (const item of items) {
    if (!item?.id || !item?.machine || !item?.description || !item?.searchText) {
      throw new Error(`Invalid catalog item in ${catalogPath}`);
    }
    if (ids.has(item.id)) {
      throw new Error(`Duplicate catalog item id: ${item.id}`);
    }
    ids.add(item.id);

    if (item.imageKey && !imagePayloads.has(item.imageKey)) {
      throw new Error(`Catalog item ${item.id} references missing image ${item.imageKey}`);
    }
  }
}

async function importCatalog() {
  const catalog = loadCleanCatalog();
  const imagePayloads = imageBytesByKey(catalog.images);
  validateItems(catalog.items, imagePayloads);

  await prisma.$transaction([
    prisma.catalogItem.deleteMany({}),
    prisma.catalogImage.deleteMany({}),
  ]);

  const referencedImageKeys = new Set(
    catalog.items.map((item) => item.imageKey).filter(Boolean)
  );
  const imageIdByKey = new Map();

  for (const imageKey of referencedImageKeys) {
    const image = imagePayloads.get(imageKey);
    const created = await prisma.catalogImage.create({
      data: {
        mimeType: image.mimeType,
        bytes: image.bytes,
      },
      select: {
        id: true,
      },
    });
    imageIdByKey.set(imageKey, created.id);
  }

  for (const item of catalog.items) {
    await prisma.catalogItem.create({
      data: {
        id: item.id,
        machine: item.machine,
        rowNumber: item.rowNumber,
        illustration: item.illustration,
        partNumber: item.partNumber,
        catalogPartNumber: item.catalogPartNumber,
        description: item.description,
        quantity: item.quantity,
        price: item.price,
        remark: item.remark,
        searchText: item.searchText,
        imageId: item.imageKey ? imageIdByKey.get(item.imageKey) || null : null,
      },
    });
  }

  const missingImages = catalog.items.filter((item) => !item.imageKey).length;
  console.log(
    `Imported ${catalog.items.length} catalogue items and ${imageIdByKey.size} images into Postgres. ${missingImages} items have no image.`
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
