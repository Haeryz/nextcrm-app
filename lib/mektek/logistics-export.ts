export const LOGISTICS_DELIVERY_NOTE_EXPORT_HEADERS = [
  "No SJ",
  "Tanggal",
  "Due Date",
  "Status",
  "PO",
  "Batch",
  "User/Perusahaan",
  "Project",
  "Item Name",
  "Kode Barang",
  "PO Class",
  "QTY Order",
  "QTY Keluar",
  "QTY Sisa",
] as const;

export const LOGISTICS_PO_MONTHLY_EXPORT_HEADERS = [
  "No",
  "User/Perusahaan",
  "PO",
  "Batch",
  "Project",
  "Item Name",
  "Kode Barang",
  "PO Class",
  "QTY Order",
  "QTY Keluar",
  "QTY Sisa",
  "Status",
] as const;

export type LogisticsPoExportType = "delivery-note" | "purchase-order";

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

export function getLogisticsPoExportYearRange(year: number) {
  if (!Number.isInteger(year) || year < 2000 || year > 9999) {
    throw new Error("Tahun export tidak valid");
  }
  return {
    year,
    start: new Date(Date.UTC(year, 0, 1)),
    end: new Date(Date.UTC(year + 1, 0, 1)),
  };
}

export function resolveLogisticsPoExportRange(
  fromMonth: string | null,
  toMonth: string | null,
  year: string | null,
  month: string | null,
) {
  if (fromMonth || toMonth) {
    const from = fromMonth || toMonth || "";
    const to = toMonth || fromMonth || "";
    return getLogisticsPoExportRange(from, to);
  }
  if (year) {
    const parsedYear = Number(year);
    const range = getLogisticsPoExportYearRange(parsedYear);
    return {
      fromMonth: String(parsedYear),
      toMonth: String(parsedYear),
      start: range.start,
      end: range.end,
    };
  }
  const single = month || "";
  return getLogisticsPoExportRange(single, single);
}

export function parseLogisticsPoExportType(
  value: string | null,
): LogisticsPoExportType {
  if (value === "delivery-note" || value === "purchase-order") return value;
  throw new Error("Jenis recap export tidak valid");
}

type ExportReceipt = {
  receivingReference: string;
  quantity: number;
  receivedAt: Date;
  createdAt: Date;
};

export type ExportPurchaseOrder = {
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
    receipts: ExportReceipt[];
  }>;
};

type ExportRange = ReturnType<typeof getLogisticsPoExportRange>;

type DeliveryNoteLine = {
  itemIndex: number;
  quantity: number;
};

type DeliveryNoteGroup = {
  reference: string;
  receivedAt: Date;
  createdAt: Date;
  lines: DeliveryNoteLine[];
};

const dateFormatter = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

const formatDate = (value: Date) => dateFormatter.format(value);

function getBatchCount(order: ExportPurchaseOrder) {
  return new Set(
    order.items.flatMap((item) =>
      item.receipts.map((receipt) => receipt.receivingReference),
    ),
  ).size;
}

function getDeliveryNoteGroups(order: ExportPurchaseOrder) {
  const groups = new Map<string, DeliveryNoteGroup>();

  order.items.forEach((item, itemIndex) => {
    item.receipts.forEach((receipt) => {
      const current = groups.get(receipt.receivingReference);
      if (current) {
        current.lines.push({ itemIndex, quantity: receipt.quantity });
        if (receipt.receivedAt < current.receivedAt) {
          current.receivedAt = receipt.receivedAt;
        }
        if (receipt.createdAt < current.createdAt) {
          current.createdAt = receipt.createdAt;
        }
        return;
      }
      groups.set(receipt.receivingReference, {
        reference: receipt.receivingReference,
        receivedAt: receipt.receivedAt,
        createdAt: receipt.createdAt,
        lines: [{ itemIndex, quantity: receipt.quantity }],
      });
    });
  });

  return Array.from(groups.values()).sort(
    (left, right) =>
      left.receivedAt.getTime() - right.receivedAt.getTime() ||
      left.createdAt.getTime() - right.createdAt.getTime() ||
      left.reference.localeCompare(right.reference),
  );
}

export function buildLogisticsDeliveryNoteExportRows(
  orders: ExportPurchaseOrder[],
  range: ExportRange,
) {
  const preparedGroups = orders.flatMap((order) => {
    const dispatchedByItem = order.items.map(() => 0);
    const batch = `${getBatchCount(order)} batch Barang Keluar`;

    return getDeliveryNoteGroups(order).flatMap((group) => {
      for (const line of group.lines) {
        dispatchedByItem[line.itemIndex] += line.quantity;
      }

      if (group.receivedAt < range.start || group.receivedAt >= range.end) {
        return [];
      }

      const status = order.items.every(
        (item, itemIndex) =>
          dispatchedByItem[itemIndex] >= item.orderedQuantity,
      )
        ? "Closed"
        : "Open";
      const lines = [...group.lines].sort(
        (left, right) => left.itemIndex - right.itemIndex,
      );

      return [
        {
          receivedAt: group.receivedAt,
          createdAt: group.createdAt,
          reference: group.reference,
          poNumber: order.poNumber,
          rows: lines.map((line, lineIndex) => {
            const item = order.items[line.itemIndex];
            return {
              "No SJ": lineIndex === 0 ? group.reference : "",
              Tanggal: lineIndex === 0 ? formatDate(group.receivedAt) : "",
              "Due Date": lineIndex === 0 ? formatDate(order.dueDate) : "",
              Status: lineIndex === 0 ? status : "",
              PO: order.poNumber,
              Batch: batch,
              "User/Perusahaan": order.userName,
              Project: order.projectName,
              "Item Name": item.partName,
              "Kode Barang": item.partNumber || "",
              "PO Class": order.poType,
              "QTY Order": item.orderedQuantity,
              "QTY Keluar": line.quantity,
              "QTY Sisa": Math.max(
                item.orderedQuantity - dispatchedByItem[line.itemIndex],
                0,
              ),
            };
          }),
        },
      ];
    });
  });

  return preparedGroups
    .sort(
      (left, right) =>
        left.receivedAt.getTime() - right.receivedAt.getTime() ||
        left.createdAt.getTime() - right.createdAt.getTime() ||
        left.reference.localeCompare(right.reference) ||
        left.poNumber.localeCompare(right.poNumber),
    )
    .flatMap((group) => group.rows);
}

export function buildLogisticsPoMonthlyExportRows(
  orders: ExportPurchaseOrder[],
) {
  return orders.flatMap((order, orderIndex) => {
    const batch = `${getBatchCount(order)} batch Barang Keluar`;
    return order.items.map((item, itemIndex) => ({
      No: itemIndex === 0 ? orderIndex + 1 : "",
      "User/Perusahaan": order.userName,
      PO: order.poNumber,
      Batch: batch,
      Project: order.projectName,
      "Item Name": item.partName,
      "Kode Barang": item.partNumber || "",
      "PO Class": order.poType,
      "QTY Order": item.orderedQuantity,
      "QTY Keluar": item.receivedQuantity,
      "QTY Sisa": Math.max(item.orderedQuantity - item.receivedQuantity, 0),
      Status: order.status === "CLOSED" ? "Closed" : "Open",
    }));
  });
}
