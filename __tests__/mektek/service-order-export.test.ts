import {
  buildMektekServiceOrderExportRows,
  buildMektekServiceOrderExportSummary,
  getMektekServiceOrderExportMonthRange,
} from "@/lib/mektek/service-order-export";

describe("monthly service-order export", () => {
  it("uses Asia/Makassar calendar-month boundaries", () => {
    const range = getMektekServiceOrderExportMonthRange("2026-01");

    expect(range.start.toISOString()).toBe("2025-12-31T16:00:00.000Z");
    expect(range.end.toISOString()).toBe("2026-01-31T16:00:00.000Z");
  });

  it("builds rows with customer and vehicle identity", () => {
    const rows = buildMektekServiceOrderExportRows([
      {
        id: "order-1",
        serviceNumber: "SRV-202601-0001",
        title: "MEKTEK Service - AC tidak dingin",
        taskStatus: "ACTIVE",
        createdAt: new Date("2026-01-10T01:00:00.000Z"),
        updatedAt: new Date("2026-01-11T01:00:00.000Z"),
        dueDateAt: new Date("2026-01-12T01:00:00.000Z"),
        content: "Periksa kompresor",
        tags: {
          customerName: "Budi",
          phone: "+628123456789",
          vehicle: "Toyota Avanza 2021",
          vehiclePlateNumber: "B 1234 XYZ",
          vehicleFleetNumber: null,
          vehicleMileageKm: 42_000,
          customerType: "B2B",
          address: "Denpasar",
          serviceItems: [
            {
              name: "Servis kompresor",
              quantity: 1,
              unitPrice: 100_000,
              total: 100_000,
            },
          ],
          sparepartItems: [
            {
              name: "Kompresor",
              quantity: 1,
              unitPrice: 100_000,
              total: 100_000,
              partNumber: "PN-001",
            },
          ],
          discount: 10_000,
          ppnEnabled: true,
          pphEnabled: true,
        },
        assigned_user: { id: "tech-1", name: "Made", email: null },
      },
    ]);

    expect(rows[0]).toEqual(
      expect.objectContaining({
        ID: "order-1",
        "No. Service": "SRV-202601-0001",
        "Nama Customer": "Budi",
        Kendaraan: "Toyota Avanza 2021",
        "Nomor Plat": "B 1234 XYZ",
        Teknisi: "Made",
        Keluhan: "Periksa kompresor",
        Sparepart: "Kompresor",
        QTY: 1,
        "Part Number": "PN-001",
        "Harga Sparepart": 100_000,
        "Total Tagihan Bruto": 210_900,
        "PPh 23 Dipotong": 2_000,
        "Total Dibayar": 208_900,
      }),
    );
  });

  it("shows '-' in Keluhan and lists sparepart text for sparepart-only orders", () => {
    const rows = buildMektekServiceOrderExportRows([
      {
        id: "order-2",
        serviceNumber: "SRV-202601-0002",
        title: "MEKTEK Sparepart - Andi",
        taskStatus: "AWAITING_PAYMENT",
        createdAt: new Date("2026-01-10T01:00:00.000Z"),
        updatedAt: null,
        dueDateAt: null,
        content: "-",
        tags: {
          customerName: "Andi",
          phone: "+628123456789",
          customerType: "STANDARD",
          orderType: "SPAREPART_ONLY",
          serviceItems: [],
          sparepartItems: [
            {
              name: "Filter oli",
              quantity: 2,
              unitPrice: 50_000,
              total: 100_000,
            },
          ],
          discount: 0,
        },
        assigned_user: null,
      },
    ]);

    expect(rows[0]).toEqual(
      expect.objectContaining({
        Keluhan: "-",
        Sparepart: "Filter oli",
        QTY: 2,
        "Part Number": "",
        "Harga Sparepart": 50_000,
        "Jumlah Item Servis": 0,
        "Jumlah Sparepart": 1,
      }),
    );
  });

  it("expands one order with multiple spareparts into separate rows", () => {
    const rows = buildMektekServiceOrderExportRows([
      {
        id: "order-3",
        serviceNumber: "SRV-202601-0003",
        title: "MEKTEK Service - Servis besar",
        taskStatus: "COMPLETE",
        createdAt: new Date("2026-01-15T01:00:00.000Z"),
        updatedAt: null,
        dueDateAt: null,
        content: "Servis besar",
        tags: {
          customerName: "Citra",
          customerType: "STANDARD",
          serviceItems: [
            {
              name: "Servis AC",
              quantity: 1,
              unitPrice: 200_000,
              total: 200_000,
            },
          ],
          sparepartItems: [
            {
              name: "Kompresor",
              quantity: 1,
              unitPrice: 1_000_000,
              total: 1_000_000,
              partNumber: "PN-A",
            },
            {
              name: "Filter oli",
              quantity: 3,
              unitPrice: 50_000,
              total: 150_000,
              partNumber: "PN-B",
            },
            {
              name: "Freon",
              quantity: 2,
              unitPrice: 75_000,
              total: 150_000,
            },
          ],
          discount: 0,
        },
        assigned_user: null,
      },
    ]);

    expect(rows).toHaveLength(3);
    expect(rows[0]).toEqual(
      expect.objectContaining({
        ID: "order-3",
        Sparepart: "Kompresor",
        QTY: 1,
        "Part Number": "PN-A",
        "Harga Sparepart": 1_000_000,
        "Subtotal Sparepart": 1_300_000,
        "Total Tagihan Bruto": 1_500_000,
      }),
    );
    expect(rows[1]).toEqual({
      Sparepart: "Filter oli",
      QTY: 3,
      "Part Number": "PN-B",
      "Harga Sparepart": 50_000,
    });
    expect(rows[2]).toEqual({
      Sparepart: "Freon",
      QTY: 2,
      "Part Number": "",
      "Harga Sparepart": 75_000,
    });
  });

  it("produces a single row with '-' for orders without spareparts", () => {
    const rows = buildMektekServiceOrderExportRows([
      {
        id: "order-4",
        serviceNumber: "SRV-202601-0004",
        title: "MEKTEK Service - Servis ringan",
        taskStatus: "ACTIVE",
        createdAt: new Date("2026-01-20T01:00:00.000Z"),
        updatedAt: null,
        dueDateAt: null,
        content: "Servis ringan",
        tags: {
          customerName: "Dewi",
          customerType: "STANDARD",
          serviceItems: [
            {
              name: "Cuci AC",
              quantity: 1,
              unitPrice: 100_000,
              total: 100_000,
            },
          ],
          sparepartItems: [],
          discount: 0,
        },
        assigned_user: null,
      },
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual(
      expect.objectContaining({
        ID: "order-4",
        Sparepart: "-",
        QTY: "",
        "Part Number": "",
        "Harga Sparepart": 0,
        "Jumlah Sparepart": 0,
      }),
    );
  });

  it("deduplicates order counts in the summary when spareparts span multiple rows", () => {
    const rows = buildMektekServiceOrderExportRows([
      {
        id: "order-5",
        title: "MEKTEK Service - Multi",
        taskStatus: "ACTIVE",
        createdAt: new Date("2026-01-10T01:00:00.000Z"),
        content: "Multi sparepart",
        tags: {
          customerName: "Eka",
          customerType: "STANDARD",
          serviceItems: [],
          sparepartItems: [
            { name: "Part A", quantity: 1, unitPrice: 100_000, total: 100_000 },
            { name: "Part B", quantity: 2, unitPrice: 50_000, total: 100_000 },
          ],
          discount: 0,
        },
        assigned_user: null,
      },
      {
        id: "order-6",
        title: "MEKTEK Service - Single",
        taskStatus: "COMPLETE",
        createdAt: new Date("2026-01-11T01:00:00.000Z"),
        content: "Single sparepart",
        tags: {
          customerName: "Fajar",
          customerType: "STANDARD",
          serviceItems: [],
          sparepartItems: [
            { name: "Part C", quantity: 1, unitPrice: 200_000, total: 200_000 },
          ],
          discount: 0,
        },
        assigned_user: null,
      },
    ]);

    expect(rows).toHaveLength(3);
    const summary = buildMektekServiceOrderExportSummary(rows, "2026-01");
    const summaryMap = new Map(
      summary.map((entry) => [entry.Metrik, entry.Nilai]),
    );
    expect(summaryMap.get("Total Pesanan")).toBe(2);
    expect(summaryMap.get("In Progress")).toBe(1);
    expect(summaryMap.get("Selesai")).toBe(1);
    expect(summaryMap.get("Subtotal Sparepart")).toBe(400_000);
  });
});
