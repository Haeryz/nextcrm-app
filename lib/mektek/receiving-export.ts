export const RECEIVING_PURCHASE_ORDER_EXPORT_HEADERS = [
  "No",
  "Job Site / Project",
  "Tanggal Create",
  "Due Date",
  "PO No. User",
  "PO Type",
  "Supplier",
  "Ringkasan Part",
  "Status",
  "QTY Masuk",
  "QTY Order",
  "QTY Sisa",
] as const;

export type ReceivingPurchaseOrderExportSource = {
  projectName: string;
  inputDate: Date;
  dueDate: Date;
  poNumber: string;
  poType: string;
  supplierName: string;
  status: string;
  items: Array<{
    partName: string;
    orderedQuantity: number;
    receivedQuantity: number;
  }>;
};

type ReceivingPurchaseOrderExportRow = Record<
  (typeof RECEIVING_PURCHASE_ORDER_EXPORT_HEADERS)[number],
  string | number
>;

const dateFormatter = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

function buildPartSummary(order: ReceivingPurchaseOrderExportSource) {
  if (order.items.length === 0) return "0 part";
  const names = order.items
    .slice(0, 2)
    .map((item) => item.partName)
    .join(", ");
  return `${order.items.length} part · ${names}${order.items.length > 2 ? ", …" : ""}`;
}

export function buildReceivingPurchaseOrderExportRows(
  orders: ReceivingPurchaseOrderExportSource[],
): ReceivingPurchaseOrderExportRow[] {
  return orders.map((order, index) => {
    const quantities = order.items.reduce(
      (totals, item) => ({
        ordered: totals.ordered + item.orderedQuantity,
        received: totals.received + item.receivedQuantity,
      }),
      { ordered: 0, received: 0 },
    );

    return {
      No: index + 1,
      "Job Site / Project": order.projectName,
      "Tanggal Create": dateFormatter.format(order.inputDate),
      "Due Date": dateFormatter.format(order.dueDate),
      "PO No. User": order.poNumber,
      "PO Type": order.poType,
      Supplier: order.supplierName,
      "Ringkasan Part": buildPartSummary(order),
      Status: order.status === "CLOSED" ? "Closed" : "Open",
      "QTY Masuk": quantities.received,
      "QTY Order": quantities.ordered,
      "QTY Sisa": Math.max(0, quantities.ordered - quantities.received),
    };
  });
}
