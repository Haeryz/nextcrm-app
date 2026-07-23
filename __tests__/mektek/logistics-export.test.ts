import {
  buildLogisticsDeliveryNoteExportRows,
  buildLogisticsPoMonthlyExportRows,
  getLogisticsPoExportRange,
  LOGISTICS_DELIVERY_NOTE_EXPORT_HEADERS,
  LOGISTICS_PO_MONTHLY_EXPORT_HEADERS,
} from "@/lib/mektek/logistics-export";

const orders = [
  {
    poNumber: "PO-ABC-123",
    status: "CLOSED",
    userName: "PT Perseroan Terbatas",
    projectName: "Project Acumalaka",
    inputDate: new Date("2026-07-10T00:00:00.000Z"),
    dueDate: new Date("2026-07-24T00:00:00.000Z"),
    deliveryDate: null,
    poType: "Normal",
    items: [
      {
        partName: "Thermostat",
        partNumber: "ND077500-2580",
        orderedQuantity: 2,
        receivedQuantity: 2,
        receipts: [
          {
            receivingReference: "SJ-001",
            quantity: 1,
            receivedAt: new Date("2026-07-22T00:00:00.000Z"),
            createdAt: new Date("2026-07-22T01:00:00.000Z"),
          },
          {
            receivingReference: "SJ-003",
            quantity: 1,
            receivedAt: new Date("2026-07-24T00:00:00.000Z"),
            createdAt: new Date("2026-07-24T01:00:00.000Z"),
          },
        ],
      },
      {
        partName: "Snap Ring",
        partNumber: "146300-5010",
        orderedQuantity: 1,
        receivedQuantity: 1,
        receipts: [
          {
            receivingReference: "SJ-001",
            quantity: 1,
            receivedAt: new Date("2026-07-22T00:00:00.000Z"),
            createdAt: new Date("2026-07-22T01:01:00.000Z"),
          },
        ],
      },
      {
        partName: "Aselole",
        partNumber: "666",
        orderedQuantity: 1,
        receivedQuantity: 1,
        receipts: [
          {
            receivingReference: "SJ-001",
            quantity: 1,
            receivedAt: new Date("2026-07-22T00:00:00.000Z"),
            createdAt: new Date("2026-07-22T01:02:00.000Z"),
          },
        ],
      },
    ],
  },
  {
    poNumber: "PO-ALMK-007",
    status: "OPEN",
    userName: "PT Panglima Perang",
    projectName: "Lokasi Dimana",
    inputDate: new Date("2026-07-11T00:00:00.000Z"),
    dueDate: new Date("2026-07-24T00:00:00.000Z"),
    deliveryDate: null,
    poType: "Consignment",
    items: [
      {
        partName: "Filter AC",
        partNumber: "145520-7855",
        orderedQuantity: 20,
        receivedQuantity: 1,
        receipts: [
          {
            receivingReference: "SJ-002",
            quantity: 1,
            receivedAt: new Date("2026-07-23T00:00:00.000Z"),
            createdAt: new Date("2026-07-23T01:00:00.000Z"),
          },
        ],
      },
    ],
  },
];

describe("Monitoring PO monthly export", () => {
  it("returns a half-open UTC range for a selected month span", () => {
    expect(getLogisticsPoExportRange("2026-05", "2026-07")).toEqual({
      fromMonth: "2026-05",
      toMonth: "2026-07",
      start: new Date("2026-05-01T00:00:00.000Z"),
      end: new Date("2026-08-01T00:00:00.000Z"),
    });
  });

  it.each([
    ["2026-13", "2026-13", "Bulan awal export tidak valid"],
    ["2026-08", "2026-07", "Bulan awal export tidak boleh setelah bulan akhir"],
    ["2023-01", "2026-01", "Rentang export maksimal 36 bulan"],
  ])("rejects an invalid range", (fromMonth, toMonth, message) => {
    expect(() => getLogisticsPoExportRange(fromMonth, toMonth)).toThrow(message);
  });

  it("builds SJ Bulanan grouped by delivery-note number with historical remaining quantities", () => {
    expect(LOGISTICS_DELIVERY_NOTE_EXPORT_HEADERS).toEqual([
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
    ]);

    const range = getLogisticsPoExportRange("2026-07", "2026-07");
    const rows = buildLogisticsDeliveryNoteExportRows(orders, range);

    expect(rows).toEqual([
      {
        "No SJ": "SJ-001",
        Tanggal: "22 Juli 2026",
        "Due Date": "24 Juli 2026",
        Status: "Open",
        PO: "PO-ABC-123",
        Batch: "2 batch Barang Keluar",
        "User/Perusahaan": "PT Perseroan Terbatas",
        Project: "Project Acumalaka",
        "Item Name": "Thermostat",
        "Kode Barang": "ND077500-2580",
        "PO Class": "Normal",
        "QTY Order": 2,
        "QTY Keluar": 1,
        "QTY Sisa": 1,
      },
      {
        "No SJ": "",
        Tanggal: "",
        "Due Date": "",
        Status: "",
        PO: "PO-ABC-123",
        Batch: "2 batch Barang Keluar",
        "User/Perusahaan": "PT Perseroan Terbatas",
        Project: "Project Acumalaka",
        "Item Name": "Snap Ring",
        "Kode Barang": "146300-5010",
        "PO Class": "Normal",
        "QTY Order": 1,
        "QTY Keluar": 1,
        "QTY Sisa": 0,
      },
      {
        "No SJ": "",
        Tanggal: "",
        "Due Date": "",
        Status: "",
        PO: "PO-ABC-123",
        Batch: "2 batch Barang Keluar",
        "User/Perusahaan": "PT Perseroan Terbatas",
        Project: "Project Acumalaka",
        "Item Name": "Aselole",
        "Kode Barang": "666",
        "PO Class": "Normal",
        "QTY Order": 1,
        "QTY Keluar": 1,
        "QTY Sisa": 0,
      },
      expect.objectContaining({
        "No SJ": "SJ-002",
        Status: "Open",
        PO: "PO-ALMK-007",
        "QTY Keluar": 1,
        "QTY Sisa": 19,
      }),
      expect.objectContaining({
        "No SJ": "SJ-003",
        Status: "Closed",
        PO: "PO-ABC-123",
        "Item Name": "Thermostat",
        "QTY Keluar": 1,
        "QTY Sisa": 0,
      }),
    ]);
  });

  it("builds Recap PO Bulanan with numbering grouped by PO", () => {
    expect(LOGISTICS_PO_MONTHLY_EXPORT_HEADERS).toEqual([
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
    ]);

    expect(buildLogisticsPoMonthlyExportRows(orders)).toEqual([
      {
        No: 1,
        "User/Perusahaan": "PT Perseroan Terbatas",
        PO: "PO-ABC-123",
        Batch: "2 batch Barang Keluar",
        Project: "Project Acumalaka",
        "Item Name": "Thermostat",
        "Kode Barang": "ND077500-2580",
        "PO Class": "Normal",
        "QTY Order": 2,
        "QTY Keluar": 2,
        "QTY Sisa": 0,
        Status: "Closed",
      },
      expect.objectContaining({
        No: "",
        PO: "PO-ABC-123",
        "Item Name": "Snap Ring",
        Status: "Closed",
      }),
      expect.objectContaining({
        No: "",
        PO: "PO-ABC-123",
        "Item Name": "Aselole",
        Status: "Closed",
      }),
      expect.objectContaining({
        No: 2,
        "User/Perusahaan": "PT Panglima Perang",
        PO: "PO-ALMK-007",
        "QTY Order": 20,
        "QTY Keluar": 1,
        "QTY Sisa": 19,
        Status: "Open",
      }),
    ]);
  });
});
