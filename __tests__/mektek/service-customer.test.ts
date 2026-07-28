import { buildMektekServiceCustomerUpsert } from "@/lib/mektek/service-customer";
import { formatMektekCustomerNumber } from "@/lib/mektek/customer-number";

describe("buildMektekServiceCustomerUpsert", () => {
  it("creates new customers and deduplicates existing customers by normalized phone", () => {
    expect(
      buildMektekServiceCustomerUpsert({
        customerName: "Dewi",
        phone: "+62 812-3456-7890",
        phoneNormalized: "6281234567890",
        customerType: "B2B",
        vehicleName: "Toyota Avanza 2021",
        vehiclePlateNumber: "B 1234 XYZ",
        vehicleFleetNumber: "UNIT-017",
      }),
    ).toEqual({
      where: { phoneNormalized: "6281234567890" },
      update: {
        phone: "+62 812-3456-7890",
        customerType: "B2B",
        vehicleName: "Toyota Avanza 2021",
        vehiclePlateNumber: "B 1234 XYZ",
        vehicleFleetNumber: "UNIT-017",
      },
      create: {
        customerNumber: expect.stringMatching(/^PLG-[A-F0-9]{10}$/),
        username: "Dewi",
        phone: "+62 812-3456-7890",
        phoneNormalized: "6281234567890",
        customerType: "B2B",
        vehicleName: "Toyota Avanza 2021",
        vehiclePlateNumber: "B 1234 XYZ",
        vehicleFleetNumber: "UNIT-017",
      },
    });
  });

  it("clears the company-only fleet number for a standard customer", () => {
    const result = buildMektekServiceCustomerUpsert({
      customerName: "Dewi",
      phone: "081234567890",
      phoneNormalized: "6281234567890",
      customerType: "STANDARD",
      vehicleName: "Honda Brio",
      vehiclePlateNumber: "B 9876 ABC",
      vehicleFleetNumber: "IGNORED",
    });

    expect(result.update.vehicleFleetNumber).toBeNull();
    expect(result.create.vehicleFleetNumber).toBeNull();
  });

  it("does not overwrite stored vehicle data for a sparepart-only order", () => {
    const result = buildMektekServiceCustomerUpsert({
      customerName: "Dewi",
      phone: "081234567890",
      phoneNormalized: "6281234567890",
      customerType: "STANDARD",
    });

    expect(result.update).toEqual({
      phone: "081234567890",
      customerType: "STANDARD",
    });
    expect(result.create).not.toHaveProperty("vehicleName");
    expect(result.create).not.toHaveProperty("vehiclePlateNumber");
    expect(result.create).not.toHaveProperty("vehicleFleetNumber");
  });
});

describe("formatMektekCustomerNumber", () => {
  it("prefers the stored public number", () => {
    expect(
      formatMektekCustomerNumber(
        "PLG-A1B2C3D4E5",
        "0d65fb77-d0bf-4cf8-8bcc-f32374d9c801",
      ),
    ).toBe("PLG-A1B2C3D4E5");
  });

  it("uses a compact compatibility value for legacy customers", () => {
    expect(
      formatMektekCustomerNumber(
        null,
        "0d65fb77-d0bf-4cf8-8bcc-f32374d9c801",
      ),
    ).toBe("PLG-0D65FB77D0");
  });
});
