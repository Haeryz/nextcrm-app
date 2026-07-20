import { buildMektekServiceCustomerUpsert } from "@/lib/mektek/service-customer";

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
});
