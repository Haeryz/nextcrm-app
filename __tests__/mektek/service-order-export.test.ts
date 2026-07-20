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
          customerType: "STANDARD",
          address: "Denpasar",
          serviceItems: [],
          sparepartItems: [],
        },
        assigned_user: { id: "tech-1", name: "Made", email: null },
      },
    ]);

    expect(rows[0]).toEqual(
      expect.objectContaining({
        ID: "order-1",
        "Nama Customer": "Budi",
        Kendaraan: "Toyota Avanza 2021",
        "Nomor Plat": "B 1234 XYZ",
        Teknisi: "Made",
        Keluhan: "AC tidak dingin",
      }),
    );
  });
});
