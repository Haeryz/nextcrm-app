import { normalizeMektekLineItems } from "@/lib/mektek/items";

export type MektekServiceOrderExportOrder = {
  id: string;
  title?: string | null;
  taskStatus?: string | null;
  dueDateAt?: Date | string | null;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
  content?: string | null;
  tags?: unknown;
  assigned_user?: {
    id: string;
    name: string | null;
    email?: string | null;
  } | null;
};

export const MEKTEK_SERVICE_ORDER_EXPORT_HEADERS = [
  "ID",
  "Nama Customer",
  "Tipe Customer",
  "Telepon",
  "Alamat",
  "Kendaraan",
  "Nomor Plat",
  "Nomor Lambung",
  "KM Mobil",
  "Teknisi",
  "Status",
  "Keluhan",
  "ETA",
  "Tanggal Masuk",
  "Terakhir Update",
  "Jumlah Timeline",
  "Jumlah Item Servis",
  "Jumlah Sparepart",
  "Subtotal Servis",
  "Subtotal Sparepart",
] as const;

const SERVICE_TITLE_PREFIXES = ["MEKTEK Service - ", "MEKTEK AC - "];
const MAKASSAR_OFFSET_MS = 8 * 60 * 60 * 1000;

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

function stripServicePrefix(title: string) {
  const prefix = SERVICE_TITLE_PREFIXES.find((item) => title.startsWith(item));
  return prefix ? title.slice(prefix.length) : title;
}

function formatExportDate(value: Date | string | null | undefined) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeZone: "Asia/Makassar",
  }).format(date);
}

export function getMektekServiceOrderExportMonthKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Makassar",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? "";
  const month = parts.find((part) => part.type === "month")?.value ?? "";
  return `${year}-${month}`;
}

export function getMektekServiceOrderExportMonthRange(month: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match) throw new Error("Bulan export harus menggunakan format YYYY-MM");
  const year = Number(match[1]);
  const monthNumber = Number(match[2]);
  if (monthNumber < 1 || monthNumber > 12) {
    throw new Error("Bulan export tidak valid");
  }

  return {
    month,
    start: new Date(
      Date.UTC(year, monthNumber - 1, 1) - MAKASSAR_OFFSET_MS,
    ),
    end: new Date(Date.UTC(year, monthNumber, 1) - MAKASSAR_OFFSET_MS),
  };
}

export function buildMektekServiceOrderExportRows(
  orders: MektekServiceOrderExportOrder[],
) {
  return orders.map((order) => {
    const tags =
      order.tags && typeof order.tags === "object" && !Array.isArray(order.tags)
        ? (order.tags as Record<string, unknown>)
        : {};
    const normalizedItems = normalizeMektekLineItems(tags, order.content);
    const technicianTag =
      tags.technician &&
      typeof tags.technician === "object" &&
      !Array.isArray(tags.technician)
        ? (tags.technician as Record<string, unknown>)
        : {};
    const technicianName =
      text(tags.technicians) ||
      order.assigned_user?.name ||
      order.assigned_user?.email ||
      text(technicianTag.name) ||
      text(technicianTag.email);

    return {
      ID: order.id,
      "Nama Customer": text(tags.customerName),
      "Tipe Customer": tags.customerType === "B2B" ? "Perusahaan" : "Standard",
      Telepon: text(tags.phone),
      Alamat: text(tags.address),
      Kendaraan: text(tags.vehicle),
      "Nomor Plat": text(tags.vehiclePlateNumber),
      "Nomor Lambung": text(tags.vehicleFleetNumber),
      "KM Mobil":
        typeof tags.vehicleMileageKm === "number" ? tags.vehicleMileageKm : "",
      Teknisi: technicianName,
      Status: order.taskStatus ?? "",
      Keluhan: stripServicePrefix(order.title ?? ""),
      ETA: formatExportDate(order.dueDateAt),
      "Tanggal Masuk": formatExportDate(order.createdAt),
      "Terakhir Update": formatExportDate(order.updatedAt),
      "Jumlah Timeline": Array.isArray(tags.timeline) ? tags.timeline.length : 0,
      "Jumlah Item Servis": normalizedItems.serviceItems.length,
      "Jumlah Sparepart": normalizedItems.sparepartItems.length,
      "Subtotal Servis": normalizedItems.serviceSubtotal,
      "Subtotal Sparepart": normalizedItems.sparepartSubtotal,
    };
  });
}
