export const LOGISTICS_PO_EXPORT_HEADERS = [
  "PO No.",
  "Surat Jalan",
  "Status",
  "User / PT",
  "Project",
  "Tanggal Pengiriman",
  "Due Date",
  "PO Type",
  "Item",
  "Part Number",
  "Gudang",
  "QTY Order",
  "QTY Keluar",
  "QTY Sisa",
  "Keterangan Item",
  "Catatan PO",
] as const;

function parseMonth(value: string, label: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) throw new Error(`${label} tidak valid`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) throw new Error(`${label} tidak valid`);
  return { value, year, month };
}

export function getLogisticsPoExportRange(fromMonth: string, toMonth: string) {
  const from = parseMonth(fromMonth, "Bulan awal export");
  const to = parseMonth(toMonth, "Bulan akhir export");
  const fromIndex = from.year * 12 + from.month - 1;
  const toIndex = to.year * 12 + to.month - 1;
  if (fromIndex > toIndex) {
    throw new Error("Bulan awal export tidak boleh setelah bulan akhir");
  }
  if (toIndex - fromIndex > 35) {
    throw new Error("Rentang export maksimal 36 bulan");
  }
  return {
    fromMonth: from.value,
    toMonth: to.value,
    start: new Date(Date.UTC(from.year, from.month - 1, 1)),
    end: new Date(Date.UTC(to.year, to.month, 1)),
  };
}

type ExportPurchaseOrder = {
  poNumber: string;
  deliveryNoteNumber: string | null;
  status: string;
  userName: string;
  projectName: string;
  inputDate: Date;
  dueDate: Date;
  poType: string;
  notes: string | null;
  items: Array<{
    position: number;
    partName: string;
    partNumber: string | null;
    warehouse: string | null;
    orderedQuantity: number;
    receivedQuantity: number;
    note: string | null;
  }>;
};

const dateKey = (value: Date) => value.toISOString().slice(0, 10);

export function buildLogisticsPoExportRows(orders: ExportPurchaseOrder[]) {
  return orders.flatMap((order) =>
    [...order.items]
      .sort((left, right) => left.position - right.position)
      .map((item) => ({
        "PO No.": order.poNumber,
        "Surat Jalan": order.deliveryNoteNumber || "-",
        Status: order.status === "CLOSED" ? "Closed" : "Open",
        "User / PT": order.userName,
        Project: order.projectName,
        "Tanggal Pengiriman": dateKey(order.inputDate),
        "Due Date": dateKey(order.dueDate),
        "PO Type": order.poType,
        Item: item.partName,
        "Part Number": item.partNumber || "-",
        Gudang:
          item.warehouse === "FRONT"
            ? "Gudang Depan"
            : item.warehouse === "REAR"
              ? "Gudang Belakang"
              : "-",
        "QTY Order": item.orderedQuantity,
        "QTY Keluar": item.receivedQuantity,
        "QTY Sisa": Math.max(item.orderedQuantity - item.receivedQuantity, 0),
        "Keterangan Item": item.note || "",
        "Catatan PO": order.notes || "",
      })),
  );
}
