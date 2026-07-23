export const LOGISTICS_PO_EXPORT_HEADERS = [
  "No",
  "Tanggal",
  "Due Date",
  "Nomor Surat Jalan",
  "PO",
  "Batch",
  "User",
  "Project",
  "Item Name",
  "Kode Barang",
  "PO Class (Normal/Consignment)",
  "QTY Order",
  "QTY Keluar",
  "QTY Sisa",
  "Status",
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
  status: string;
  userName: string;
  projectName: string;
  inputDate: Date;
  dueDate: Date;
  deliveryDate: Date | null;
  poType: string;
  items: Array<{
    partName: string;
    partNumber: string | null;
    orderedQuantity: number;
    receivedQuantity: number;
    receipts: Array<{ receivingReference: string }>;
  }>;
};

const dateKey = (value: Date) => value.toISOString().slice(0, 10);

export function buildLogisticsPoExportRows(orders: ExportPurchaseOrder[]) {
  return orders.flatMap((order, orderIndex) => {
    const batches = new Set(
      order.items.flatMap((item) =>
        item.receipts.map((receipt) => receipt.receivingReference),
      ),
    );
    return order.items.map((item, itemIndex) => {
      const deliveryNoteNumbers = Array.from(
        new Set(item.receipts.map((receipt) => receipt.receivingReference)),
      );
      return {
        No: itemIndex === 0 ? orderIndex + 1 : "",
        Tanggal: dateKey(order.inputDate),
        "Due Date": dateKey(order.dueDate),
        "Nomor Surat Jalan": deliveryNoteNumbers.join(", "),
        PO: order.poNumber,
        Batch: `${batches.size} batch Barang Keluar`,
        User: order.userName,
        Project: order.projectName,
        "Item Name": item.partName,
        "Kode Barang": item.partNumber || "",
        "PO Class (Normal/Consignment)": order.poType,
        "QTY Order": item.orderedQuantity,
        "QTY Keluar": item.receivedQuantity,
        "QTY Sisa": Math.max(item.orderedQuantity - item.receivedQuantity, 0),
        Status: order.status === "CLOSED" ? "Closed" : "Open",
      };
    });
  });
}
