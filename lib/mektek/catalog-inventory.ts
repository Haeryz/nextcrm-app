export const CATALOG_PRODUCTION_CHANNELS = ["POWERTRAIN", "THERMAL"] as const;
export const CATALOG_WAREHOUSES = ["REAR", "FRONT"] as const;
export const CATALOG_STOCK_DIRECTIONS = ["IN", "OUT"] as const;

export type CatalogProductionChannel =
  (typeof CATALOG_PRODUCTION_CHANNELS)[number];
export type CatalogWarehouse = (typeof CATALOG_WAREHOUSES)[number];
export type CatalogStockDirection =
  (typeof CATALOG_STOCK_DIRECTIONS)[number];

export type CatalogStockMovementValue = {
  warehouse: CatalogWarehouse;
  direction: CatalogStockDirection;
  quantity: number;
  occurredAt: Date | string;
};

export type CatalogDailyInbound = {
  day: number;
  rear: number;
  front: number;
  total: number;
};

export type CatalogInventorySnapshot = {
  id: string;
  itemName: string;
  productionChannel: CatalogProductionChannel | null;
  machine: string;
  partNumber: string | null;
  remark: string | null;
  rearLocation: string | null;
  frontLocation: string | null;
  openingRearStock: number;
  openingFrontStock: number;
  closingRearStock: number;
  closingFrontStock: number;
  openingStockEditable: boolean;
  totalInbound: number;
  dailyInbound: CatalogDailyInbound[];
};

export function getCatalogProductionChannelLabel(
  channel: CatalogProductionChannel | null,
) {
  if (channel === "POWERTRAIN") return "Powertrain";
  if (channel === "THERMAL") return "Thermal";
  return "";
}

export function getCatalogInventoryMonthKey(date?: Date) {
  if (!date) return getCatalogInventoryLocalDateKey().slice(0, 7);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function getCatalogInventoryLocalDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Makassar",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: "year" | "month" | "day") =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export function parseCatalogInventoryDateKey(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new Error("Tanggal mutasi tidak valid");
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error("Tanggal mutasi tidak valid");
  }
  return date;
}

export function getCatalogInventoryMonthRange(month: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match) throw new Error("Bulan inventory harus menggunakan format YYYY-MM");

  const year = Number(match[1]);
  const monthNumber = Number(match[2]);
  if (monthNumber < 1 || monthNumber > 12) {
    throw new Error("Bulan inventory tidak valid");
  }

  const start = new Date(Date.UTC(year, monthNumber - 1, 1));
  const end = new Date(Date.UTC(year, monthNumber, 1));
  const daysInMonth = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();

  return { month, year, monthNumber, start, end, daysInMonth };
}

export function calculateCatalogInventoryMonth({
  month,
  openingRearStock,
  openingFrontStock,
  movements,
}: {
  month: string;
  openingRearStock: number;
  openingFrontStock: number;
  movements: CatalogStockMovementValue[];
}) {
  const range = getCatalogInventoryMonthRange(month);
  const dailyInbound: CatalogDailyInbound[] = Array.from(
    { length: range.daysInMonth },
    (_, index) => ({ day: index + 1, rear: 0, front: 0, total: 0 }),
  );
  let closingRearStock = Math.max(0, Math.floor(openingRearStock));
  let closingFrontStock = Math.max(0, Math.floor(openingFrontStock));
  let totalInbound = 0;

  for (const movement of movements) {
    const occurredAt = new Date(movement.occurredAt);
    if (
      Number.isNaN(occurredAt.getTime()) ||
      occurredAt < range.start ||
      occurredAt >= range.end
    ) {
      continue;
    }

    const quantity = Math.floor(Number(movement.quantity));
    if (!Number.isFinite(quantity) || quantity <= 0) continue;
    const delta = movement.direction === "IN" ? quantity : -quantity;

    if (movement.warehouse === "REAR") closingRearStock += delta;
    else closingFrontStock += delta;

    if (movement.direction === "IN") {
      const daily = dailyInbound[occurredAt.getUTCDate() - 1];
      if (!daily) continue;
      if (movement.warehouse === "REAR") daily.rear += quantity;
      else daily.front += quantity;
      daily.total += quantity;
      totalInbound += quantity;
    }
  }

  if (closingRearStock < 0 || closingFrontStock < 0) {
    throw new Error("Mutasi akan membuat stok gudang menjadi negatif");
  }

  return {
    month,
    openingRearStock: Math.max(0, Math.floor(openingRearStock)),
    openingFrontStock: Math.max(0, Math.floor(openingFrontStock)),
    closingRearStock,
    closingFrontStock,
    totalInbound,
    dailyInbound,
  };
}

export function rolloverCatalogInventoryMonth(previous: {
  closingRearStock: number;
  closingFrontStock: number;
}) {
  return {
    openingRearStock: previous.closingRearStock,
    openingFrontStock: previous.closingFrontStock,
  };
}

export function buildCatalogInventoryExportTable(
  snapshots: CatalogInventorySnapshot[],
  month: string,
) {
  const { daysInMonth } = getCatalogInventoryMonthRange(month);
  const dayHeaders = Array.from(
    { length: daysInMonth },
    (_, index) => `Tanggal ${index + 1}`,
  );
  const headers = [
    "No",
    "Item Name",
    "Production Channel",
    "Machine",
    "Part Number",
    "Stok Awal G. Belakang",
    "Stok Awal G. Depan",
    ...dayHeaders,
    "Total Masuk",
    "Stok Akhir G. Belakang",
    "Stok Akhir G. Depan",
    "Total Stok Akhir",
    "Remark",
    "Lokasi G. Belakang",
    "Lokasi G. Depan",
  ];
  const rows = snapshots.map((snapshot, index) => {
    const row: Record<string, string | number> = {
      No: index + 1,
      "Item Name": snapshot.itemName,
      "Production Channel": getCatalogProductionChannelLabel(
        snapshot.productionChannel,
      ),
      Machine: snapshot.machine,
      "Part Number": snapshot.partNumber ?? "",
      "Stok Awal G. Belakang": snapshot.openingRearStock,
      "Stok Awal G. Depan": snapshot.openingFrontStock,
    };

    for (let day = 1; day <= daysInMonth; day += 1) {
      const inbound = snapshot.dailyInbound[day - 1]?.total ?? 0;
      row[`Tanggal ${day}`] = inbound || "";
    }

    row["Total Masuk"] = snapshot.totalInbound;
    row["Stok Akhir G. Belakang"] = snapshot.closingRearStock;
    row["Stok Akhir G. Depan"] = snapshot.closingFrontStock;
    row["Total Stok Akhir"] =
      snapshot.closingRearStock + snapshot.closingFrontStock;
    row.Remark = snapshot.remark ?? "";
    row["Lokasi G. Belakang"] = snapshot.rearLocation ?? "";
    row["Lokasi G. Depan"] = snapshot.frontLocation ?? "";
    return row;
  });

  return { headers, rows };
}
