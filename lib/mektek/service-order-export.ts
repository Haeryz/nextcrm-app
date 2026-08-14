import {
  buildMektekFinancialSummary,
  type MektekPaymentRecord,
} from "@/lib/mektek/financials";

export type MektekServiceOrderExportOrder = {
  id: string;
  serviceNumber?: string | null;
  title?: string | null;
  taskStatus?: string | null;
  dueDateAt?: Date | string | null;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
  content?: string | null;
  tags?: unknown;
  mektekPayments?: MektekPaymentRecord[];
  assigned_user?: {
    id: string;
    name: string | null;
    email?: string | null;
  } | null;
};

export const MEKTEK_SERVICE_ORDER_EXPORT_HEADERS = [
  "No. Service",
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
  "Sparepart",
  "QTY",
  "Part Number",
  "Harga Sparepart",
  "ETA",
  "Tanggal Masuk",
  "Terakhir Update",
  "Jumlah Timeline",
  "Jumlah Item Servis",
  "Jumlah Sparepart",
  "Subtotal Servis",
  "Subtotal Sparepart",
  "Diskon",
  "DPP",
  "PPN",
  "Total Tagihan Bruto",
  "PPh 23 Dipotong",
  "Total Dibayar",
  "Sudah Dibayar",
  "Sisa Bayar",
  "Status Pembayaran",
  "Metode Pembayaran",
] as const;

const FINANCIAL_EXPORT_COLUMNS = [
  "Subtotal Servis",
  "Subtotal Sparepart",
  "Diskon",
  "DPP",
  "PPN",
  "Total Tagihan Bruto",
  "PPh 23 Dipotong",
  "Total Dibayar",
  "Sudah Dibayar",
  "Sisa Bayar",
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

export function getMektekServiceOrderExportYearRange(year: number) {
  if (!Number.isInteger(year) || year < 2000 || year > 9999) {
    throw new Error("Tahun export tidak valid");
  }
  return {
    year,
    start: new Date(Date.UTC(year, 0, 1) - MAKASSAR_OFFSET_MS),
    end: new Date(Date.UTC(year + 1, 0, 1) - MAKASSAR_OFFSET_MS),
  };
}

function parseExportMonth(value: string, label: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) throw new Error(`${label} harus menggunakan format YYYY-MM`);
  const year = Number(match[1]);
  const monthNumber = Number(match[2]);
  if (monthNumber < 1 || monthNumber > 12) {
    throw new Error(`${label} tidak valid`);
  }
  return { value, year, monthNumber };
}

export function getMektekServiceOrderExportMonthSpan(
  fromMonth: string,
  toMonth: string,
) {
  const from = parseExportMonth(fromMonth, "Bulan awal export");
  const to = parseExportMonth(toMonth, "Bulan akhir export");
  const fromIndex = from.year * 12 + from.monthNumber - 1;
  const toIndex = to.year * 12 + to.monthNumber - 1;
  if (fromIndex > toIndex) {
    throw new Error("Bulan awal export tidak boleh setelah bulan akhir");
  }
  if (toIndex - fromIndex > 35) {
    throw new Error("Rentang export maksimal 36 bulan");
  }
  return {
    fromMonth: from.value,
    toMonth: to.value,
    start: new Date(
      Date.UTC(from.year, from.monthNumber - 1, 1) - MAKASSAR_OFFSET_MS,
    ),
    end: new Date(Date.UTC(to.year, to.monthNumber, 1) - MAKASSAR_OFFSET_MS),
  };
}

export function buildMektekServiceOrderExportRows(
  orders: MektekServiceOrderExportOrder[],
) {
  const rows: Record<string, string | number>[] = [];

  for (const order of orders) {
    const tags =
      order.tags && typeof order.tags === "object" && !Array.isArray(order.tags)
        ? (order.tags as Record<string, unknown>)
        : {};
    const financials = buildMektekFinancialSummary(
      tags,
      order.content,
      order.mektekPayments,
    );
    const normalizedItems = financials.normalizedItems;
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
    const hasServiceItems = normalizedItems.serviceItems.length > 0;
    const sparepartItems = normalizedItems.sparepartItems;
    const paymentStatusLabel =
      financials.payment.status === "paid"
        ? "Lunas"
        : financials.payment.status === "partial"
          ? "Dibayar Sebagian"
          : "Belum Bayar";

    const commonFields: Record<string, string | number> = {
      "No. Service": order.serviceNumber ?? order.id.slice(0, 8),
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
      Keluhan: hasServiceItems
        ? (text(order.content) || stripServicePrefix(order.title ?? ""))
        : "-",
      ETA: formatExportDate(order.dueDateAt),
      "Tanggal Masuk": formatExportDate(order.createdAt),
      "Terakhir Update": formatExportDate(order.updatedAt),
      "Jumlah Timeline": Array.isArray(tags.timeline) ? tags.timeline.length : 0,
      "Jumlah Item Servis": normalizedItems.serviceItems.length,
      "Jumlah Sparepart": sparepartItems.length,
      "Status Pembayaran": paymentStatusLabel,
      "Metode Pembayaran": financials.payment.method,
    };

    const financialFields: Record<string, string | number> = {
      "Subtotal Servis": normalizedItems.serviceSubtotal,
      "Subtotal Sparepart": normalizedItems.sparepartSubtotal,
      Diskon: financials.discount,
      DPP: financials.taxBase,
      PPN: financials.tax,
      "Total Tagihan Bruto": financials.grossInvoiceTotal,
      "PPh 23 Dipotong": financials.pph,
      "Total Dibayar": financials.netPayable,
      "Sudah Dibayar": financials.amountPaid,
      "Sisa Bayar": financials.balanceDue,
    };

    const sparepartRows =
      sparepartItems.length === 0
        ? [{ name: "-", quantity: "" as string | number, partNumber: "", unitPrice: 0 }]
        : sparepartItems.map((item) => ({
            name: item.name,
            quantity: item.quantity,
            partNumber: item.partNumber || item.catalogPartNumber || "",
            unitPrice: item.unitPrice,
          }));

    sparepartRows.forEach((sparepart, index) => {
      if (index === 0) {
        rows.push({
          ...commonFields,
          Sparepart: sparepart.name,
          QTY: sparepart.quantity,
          "Part Number": sparepart.partNumber,
          "Harga Sparepart": sparepart.unitPrice,
          ...financialFields,
        });
      } else {
        rows.push({
          Sparepart: sparepart.name,
          QTY: sparepart.quantity,
          "Part Number": sparepart.partNumber,
          "Harga Sparepart": sparepart.unitPrice,
        });
      }
    });
  }

  return rows;
}

export function buildMektekServiceOrderExportSummary(
  rows: readonly object[],
  month: string,
) {
  const records = rows.map((row) => row as Record<string, unknown>);
  const uniqueRows = new Map<string, Record<string, unknown>>();
  for (const row of records) {
    const id = String(row.ID ?? "");
    if (id && !uniqueRows.has(id)) uniqueRows.set(id, row);
  }
  const uniqueRecords = [...uniqueRows.values()];
  const sum = (column: string) =>
    records.reduce((total, row) => {
      const value = row[column];
      return total + (typeof value === "number" && Number.isFinite(value) ? value : 0);
    }, 0);
  const countStatus = (status: string) =>
    uniqueRecords.filter((row) => row.Status === status).length;

  return [
    { Metrik: "Bulan Laporan", Nilai: month },
    { Metrik: "Total Pesanan", Nilai: uniqueRecords.length },
    { Metrik: "In Progress", Nilai: countStatus("ACTIVE") },
    { Metrik: "Pending", Nilai: countStatus("PENDING") },
    { Metrik: "Menunggu Pembayaran", Nilai: countStatus("AWAITING_PAYMENT") },
    { Metrik: "Selesai", Nilai: countStatus("COMPLETE") },
    { Metrik: "Subtotal Servis", Nilai: sum("Subtotal Servis") },
    { Metrik: "Subtotal Sparepart", Nilai: sum("Subtotal Sparepart") },
    { Metrik: "Diskon", Nilai: sum("Diskon") },
    { Metrik: "DPP", Nilai: sum("DPP") },
    { Metrik: "PPN", Nilai: sum("PPN") },
    { Metrik: "Total Tagihan Bruto", Nilai: sum("Total Tagihan Bruto") },
    { Metrik: "PPh 23 Dipotong", Nilai: sum("PPh 23 Dipotong") },
    { Metrik: "Total Dibayar", Nilai: sum("Total Dibayar") },
    { Metrik: "Sudah Dibayar", Nilai: sum("Sudah Dibayar") },
    { Metrik: "Sisa Bayar", Nilai: sum("Sisa Bayar") },
  ];
}
