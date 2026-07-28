const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");
const XLSX = require("xlsx");

require("dotenv").config({
  path: path.resolve(__dirname, "../.env.local"),
  quiet: true,
});
require("dotenv").config({
  path: path.resolve(__dirname, "../.env"),
  quiet: true,
});

const SOURCE_PATH = path.resolve(
  process.cwd(),
  "data_excel/SPARE PART ALL 2026.xlsx",
);
const SHEET_NAME = "JUL 26";
const INVENTORY_MONTH = new Date("2026-07-01T00:00:00.000Z");
const IMPORT_NOTE = "Impor SPARE PART ALL 2026.xlsx";
const isCommit = process.argv.includes("--commit");

function clean(value) {
  if (value === undefined || value === null) return "";
  return String(value).trim().replace(/\s+/g, " ");
}

function numeric(value, label) {
  if (value === undefined || value === null || clean(value) === "") return 0;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${label} harus berupa angka, ditemukan: ${value}`);
  }
  return parsed;
}

function integer(value, label) {
  const parsed = numeric(value, label);
  if (!Number.isInteger(parsed)) {
    throw new Error(`${label} harus berupa bilangan bulat, ditemukan: ${value}`);
  }
  return parsed;
}

function exactQuantity(value) {
  return Number(value.toFixed(10)).toString();
}

function nullablePartNumber(value) {
  const normalized = clean(value);
  return normalized && normalized !== "-" ? normalized : null;
}

function normalizeProductionChannel(value, rowNumber) {
  const normalized = clean(value).toUpperCase().replace(/\s+/g, "_");
  if (!normalized) return null;
  if (["POWERTRAIN", "THERMAL", "AC_RUANGAN"].includes(normalized)) {
    return normalized;
  }
  throw new Error(
    `Divisi produksi tidak dikenali pada baris Excel ${rowNumber}: ${value}`,
  );
}

function cellValue(sheet, row, column) {
  return sheet[`${column}${row}`]?.v ?? null;
}

function movementColumn(day, direction) {
  const zeroBasedColumn = 7 + (day - 1) * 2 + (direction === "OUT" ? 1 : 0);
  return XLSX.utils.encode_col(zeroBasedColumn);
}

function stableItemId(rowNumber, description, partNumber) {
  const digest = crypto
    .createHash("sha256")
    .update(`${rowNumber}|${description}|${partNumber || ""}`)
    .digest("hex")
    .slice(0, 16);
  return `spare-part-2026-${String(rowNumber).padStart(4, "0")}-${digest}`;
}

function loadSource() {
  if (!fs.existsSync(SOURCE_PATH)) {
    throw new Error(`File sumber tidak ditemukan: ${SOURCE_PATH}`);
  }

  const workbook = XLSX.readFile(SOURCE_PATH, {
    cellDates: true,
    cellFormula: true,
  });
  const sheet = workbook.Sheets[SHEET_NAME];
  if (!sheet) {
    throw new Error(`Sheet "${SHEET_NAME}" tidak ditemukan`);
  }

  const requiredHeaders = {
    A3: "No.",
    B3: "Product Type",
    C3: "Prod. Chnl",
    D3: "Brand",
    E3: "Part Number",
    G3: "Stock",
    BR3: "TOTAL",
    BT3: "Stock",
    BV3: "Remarks",
    BW3: "LOKASI G. BELAKANG",
    BX3: "LOKASI G. DEPAN",
  };
  for (const [address, expected] of Object.entries(requiredHeaders)) {
    if (clean(sheet[address]?.v) !== expected) {
      throw new Error(
        `Header ${address} berubah. Diharapkan "${expected}", ditemukan "${clean(
          sheet[address]?.v,
        )}"`,
      );
    }
  }

  const range = XLSX.utils.decode_range(sheet["!ref"]);
  const items = [];
  const sourceMovements = [];
  const skippedTemplateRows = [];

  for (let excelRow = 6; excelRow <= range.e.r + 1; excelRow += 1) {
    const rowNumber = integer(
      cellValue(sheet, excelRow, "A"),
      `Nomor baris Excel ${excelRow}`,
    );
    const description = clean(cellValue(sheet, excelRow, "B"));
    const rawChannel = clean(cellValue(sheet, excelRow, "C"));
    const brand = clean(cellValue(sheet, excelRow, "D"));
    const densoPartNumber = nullablePartNumber(
      cellValue(sheet, excelRow, "E"),
    );
    const nonDensoPartNumber = nullablePartNumber(
      cellValue(sheet, excelRow, "F"),
    );
    const exactOpeningStock = numeric(
      cellValue(sheet, excelRow, "G"),
      `Stok awal baris Excel ${excelRow}`,
    );
    const minStock = integer(
      cellValue(sheet, excelRow, "BU"),
      `Stok minimum baris Excel ${excelRow}`,
    );
    const excelRemark = clean(cellValue(sheet, excelRow, "BV"));
    const rearLocation = clean(cellValue(sheet, excelRow, "BW"));
    const frontLocation = clean(cellValue(sheet, excelRow, "BX"));

    const dailyMovements = [];
    for (let day = 1; day <= 31; day += 1) {
      for (const direction of ["IN", "OUT"]) {
        const column = movementColumn(day, direction);
        const exactQuantityValue = numeric(
          cellValue(sheet, excelRow, column),
          `${direction} tanggal ${day}, baris Excel ${excelRow}`,
        );
        if (exactQuantityValue < 0) {
          throw new Error(
            `Pergerakan stok negatif pada ${column}${excelRow}: ${exactQuantityValue}`,
          );
        }
        if (exactQuantityValue > 0) {
          dailyMovements.push({
            day,
            direction,
            exactQuantity: exactQuantityValue,
            quantity: Math.round(exactQuantityValue),
          });
        }
      }
    }

    const hasPayload = Boolean(
      description ||
        rawChannel ||
        brand ||
        densoPartNumber ||
        nonDensoPartNumber ||
        exactOpeningStock ||
        minStock ||
        excelRemark ||
        rearLocation ||
        frontLocation ||
        dailyMovements.length,
    );
    if (!hasPayload) {
      skippedTemplateRows.push(excelRow);
      continue;
    }
    if (!rowNumber || !description) {
      throw new Error(
        `Baris Excel ${excelRow} berisi data tetapi nomor/nama spare part kosong`,
      );
    }

    const totalInbound = dailyMovements
      .filter((movement) => movement.direction === "IN")
      .reduce((sum, movement) => sum + movement.exactQuantity, 0);
    const totalOutbound = dailyMovements
      .filter((movement) => movement.direction === "OUT")
      .reduce((sum, movement) => sum + movement.exactQuantity, 0);
    const exactClosingStock =
      exactOpeningStock + totalInbound - totalOutbound;
    const cachedClosingStock = numeric(
      cellValue(sheet, excelRow, "BT"),
      `Stok akhir baris Excel ${excelRow}`,
    );
    if (Math.abs(cachedClosingStock - exactClosingStock) > 1e-9) {
      throw new Error(
        `Formula stok baris Excel ${excelRow} tidak cocok: ` +
          `hasil hitung ${exactClosingStock}, nilai BT ${cachedClosingStock}`,
      );
    }
    const openingStock = Math.round(exactOpeningStock);
    const closingStock = Math.round(exactClosingStock);
    const roundedMovementClosing =
      openingStock +
      dailyMovements
        .filter((movement) => movement.direction === "IN")
        .reduce((sum, movement) => sum + movement.quantity, 0) -
      dailyMovements
        .filter((movement) => movement.direction === "OUT")
        .reduce((sum, movement) => sum + movement.quantity, 0);
    if (roundedMovementClosing !== closingStock) {
      throw new Error(
        `Pembulatan stok baris Excel ${excelRow} tidak dapat direkonsiliasi`,
      );
    }

    const partNumber = densoPartNumber || nonDensoPartNumber;
    const catalogPartNumber =
      densoPartNumber && nonDensoPartNumber ? nonDensoPartNumber : null;
    const productionChannel = normalizeProductionChannel(
      rawChannel,
      excelRow,
    );
    const machine = excelRemark || "All";
    const remarkParts = [];
    if (excelRemark) remarkParts.push(excelRemark);
    if (brand) remarkParts.push(`Merek: ${brand}`);
    const remark = remarkParts.join(" | ") || null;
    const searchText = [
      description,
      productionChannel,
      brand,
      densoPartNumber,
      nonDensoPartNumber,
      machine,
      rearLocation,
      frontLocation,
      remark,
    ]
      .filter(Boolean)
      .join(" ")
      .toLocaleLowerCase("id-ID");
    const id = stableItemId(rowNumber, description, partNumber);
    const inventoryMonthId = crypto.randomUUID();

    items.push({
      id,
      machine,
      rowNumber,
      illustration: null,
      imagePath: null,
      imageData: null,
      imageMimeType: null,
      partNumber,
      catalogPartNumber,
      description,
      quantity: exactQuantity(exactClosingStock),
      previousQuantity: exactQuantity(exactOpeningStock),
      quantityUpdatedAt: null,
      price: null,
      remark,
      productionChannel,
      rearLocation: rearLocation || null,
      frontLocation: frontLocation || null,
      rearStock: closingStock,
      frontStock: 0,
      minStock,
      searchText,
      inventoryMonthId,
      openingStock,
      closingStock,
      sourceExcelRow: excelRow,
    });

    for (const movement of dailyMovements) {
      sourceMovements.push({
        catalogItemId: id,
        inventoryMonthId,
        warehouse: "REAR",
        direction: movement.direction,
        quantity: movement.quantity,
        occurredAt: new Date(
          `2026-07-${String(movement.day).padStart(2, "0")}T12:00:00+08:00`,
        ),
        note:
          movement.exactQuantity === movement.quantity
            ? IMPORT_NOTE
            : `${IMPORT_NOTE} (nilai Excel: ${exactQuantity(
                movement.exactQuantity,
              )})`,
        source: "MANUAL",
      });
    }
  }

  const ids = new Set(items.map((item) => item.id));
  if (ids.size !== items.length) {
    throw new Error("ID hasil transformasi tidak unik");
  }

  return {
    items,
    sourceMovements,
    skippedTemplateRows,
    sourceSha256: crypto
      .createHash("sha256")
      .update(fs.readFileSync(SOURCE_PATH))
      .digest("hex"),
  };
}

function databaseItem(item) {
  const {
    inventoryMonthId,
    openingStock,
    closingStock,
    sourceExcelRow,
    ...data
  } = item;
  return data;
}

function databaseMonth(item) {
  return {
    id: item.inventoryMonthId,
    catalogItemId: item.id,
    month: INVENTORY_MONTH,
    openingRearStock: item.openingStock,
    openingFrontStock: 0,
    closingRearStock: item.closingStock,
    closingFrontStock: 0,
  };
}

async function backupCurrentCatalog(prisma, sourceSha256) {
  const [items, inventoryMonths, stockMovements, consignmentSites] =
    await Promise.all([
      prisma.catalogItem.findMany(),
      prisma.catalogInventoryMonth.findMany(),
      prisma.catalogStockMovement.findMany(),
      prisma.catalogConsignmentSite.findMany(),
    ]);

  const serializableItems = items.map(({ imageData, ...item }) => ({
    ...item,
    imageDataBase64: imageData ? Buffer.from(imageData).toString("base64") : null,
  }));
  const backup = {
    metadata: {
      createdAt: new Date().toISOString(),
      targetHost: new URL(process.env.DATABASE_URL).hostname,
      sourceFile: path.relative(process.cwd(), SOURCE_PATH),
      sourceSha256,
    },
    catalogItems: serializableItems,
    inventoryMonths,
    stockMovements,
    consignmentSites,
  };
  const backupDirectory = path.resolve(process.cwd(), "backups");
  fs.mkdirSync(backupDirectory, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = path.join(
    backupDirectory,
    `catalog-before-spare-part-2026-${timestamp}.json`,
  );
  fs.writeFileSync(backupPath, `${JSON.stringify(backup, null, 2)}\n`, {
    mode: 0o600,
  });
  return backupPath;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL tidak tersedia");
  }
  const target = new URL(process.env.DATABASE_URL);
  if (!target.hostname.endsWith(".neon.tech")) {
    throw new Error(
      `Target ditolak karena bukan Neon: ${target.hostname}`,
    );
  }

  const transformed = loadSource();
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    const [
      currentItems,
      currentMonths,
      currentMovements,
      currentSites,
      linkedPurchaseOrderItems,
    ] = await Promise.all([
      prisma.catalogItem.count(),
      prisma.catalogInventoryMonth.count(),
      prisma.catalogStockMovement.count(),
      prisma.catalogConsignmentSite.count(),
      prisma.logisticsPurchaseOrderItem.count({
        where: { catalogItemId: { not: null } },
      }),
    ]);
    const summary = {
      mode: isCommit ? "commit" : "dry-run",
      targetHost: target.hostname,
      sourceSha256: transformed.sourceSha256,
      existing: {
        items: currentItems,
        inventoryMonths: currentMonths,
        stockMovements: currentMovements,
        consignmentSites: currentSites,
        linkedPurchaseOrderItems,
      },
      replacement: {
        items: transformed.items.length,
        inventoryMonths: transformed.items.length,
        stockMovements: transformed.sourceMovements.length,
        skippedEmptyTemplateRows: transformed.skippedTemplateRows.length,
        rearStock: transformed.items.reduce(
          (sum, item) => sum + item.rearStock,
          0,
        ),
        frontStock: 0,
        negativeStockItems: transformed.items.filter(
          (item) => item.rearStock < 0,
        ).length,
        roundedStockItems: transformed.items.filter(
          (item) =>
            Number(item.quantity) !== item.rearStock ||
            Number(item.previousQuantity) !== item.openingStock,
        ).length,
      },
    };
    console.log(JSON.stringify(summary));

    if (!isCommit) return;
    if (linkedPurchaseOrderItems > 0) {
      throw new Error(
        `${linkedPurchaseOrderItems} item purchase order masih tertaut; impor dibatalkan`,
      );
    }

    const backupPath = await backupCurrentCatalog(
      prisma,
      transformed.sourceSha256,
    );
    console.log(JSON.stringify({ backupPath }));

    await prisma.$transaction(
      async (transaction) => {
        await transaction.catalogItem.deleteMany({});
        await transaction.catalogItem.createMany({
          data: transformed.items.map(databaseItem),
        });
        await transaction.catalogInventoryMonth.createMany({
          data: transformed.items.map(databaseMonth),
        });
        if (transformed.sourceMovements.length) {
          await transaction.catalogStockMovement.createMany({
            data: transformed.sourceMovements,
          });
        }
      },
      {
        isolationLevel: "Serializable",
        maxWait: 30_000,
        timeout: 120_000,
      },
    );

    const [insertedItems, insertedMonths, insertedMovements, stock] =
      await Promise.all([
        prisma.catalogItem.count(),
        prisma.catalogInventoryMonth.count(),
        prisma.catalogStockMovement.count(),
        prisma.catalogItem.aggregate({
          _sum: { rearStock: true, frontStock: true },
        }),
      ]);
    const verification = {
      insertedItems,
      insertedMonths,
      insertedMovements,
      rearStock: stock._sum.rearStock,
      frontStock: stock._sum.frontStock,
    };
    if (
      insertedItems !== transformed.items.length ||
      insertedMonths !== transformed.items.length ||
      insertedMovements !== transformed.sourceMovements.length
    ) {
      throw new Error(
        `Verifikasi pasca-impor gagal: ${JSON.stringify(verification)}`,
      );
    }
    console.log(JSON.stringify({ completed: true, verification, backupPath }));
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
