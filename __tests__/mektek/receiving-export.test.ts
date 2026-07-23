import {
  buildReceivingPurchaseOrderExportRows,
  RECEIVING_PURCHASE_ORDER_EXPORT_HEADERS,
} from "@/lib/mektek/receiving-export";

describe("Receiving Purchase Order Excel export", () => {
  it("uses the same columns and one-row-per-PO totals as the spreadsheet", () => {
    expect(RECEIVING_PURCHASE_ORDER_EXPORT_HEADERS).toEqual([
      "No",
      "Job Site / Project",
      "Tanggal Input",
      "Due Date",
      "PO No. User",
      "PO Type",
      "Supplier",
      "Ringkasan Part",
      "Status",
      "QTY Masuk",
      "QTY Order",
      "QTY Sisa",
    ]);

    expect(
      buildReceivingPurchaseOrderExportRows([
        {
          projectName: "Site Morowali",
          inputDate: new Date("2026-07-22T00:00:00.000Z"),
          dueDate: new Date("2026-07-28T00:00:00.000Z"),
          poNumber: "PO-MTL-001",
          poType: "Normal",
          supplierName: "AirFilter",
          status: "OPEN",
          items: [
            {
              partName: "Filter AC",
              orderedQuantity: 10,
              receivedQuantity: 4,
            },
            {
              partName: "Thermostat",
              orderedQuantity: 2,
              receivedQuantity: 2,
            },
            {
              partName: "Snap Ring",
              orderedQuantity: 1,
              receivedQuantity: 0,
            },
          ],
        },
      ]),
    ).toEqual([
      {
        No: 1,
        "Job Site / Project": "Site Morowali",
        "Tanggal Input": "22 Juli 2026",
        "Due Date": "28 Juli 2026",
        "PO No. User": "PO-MTL-001",
        "PO Type": "Normal",
        Supplier: "AirFilter",
        "Ringkasan Part": "3 part · Filter AC, Thermostat, …",
        Status: "Open",
        "QTY Masuk": 6,
        "QTY Order": 13,
        "QTY Sisa": 7,
      },
    ]);
  });
});
