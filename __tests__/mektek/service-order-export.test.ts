import {
  buildMektekServiceOrderExportRows,
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
        Sparepart: "Filter oli x2",
        "Jumlah Item Servis": 0,
        "Jumlah Sparepart": 1,
      }),
    );
  });
});
