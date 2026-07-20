import {
  formatMektekVehicleChoiceLabel,
  normalizeMektekVehiclePlateNumber,
} from "@/lib/mektek/customer-vehicles";

describe("customer vehicle helpers", () => {
  it("normalizes equivalent plate formats to one stable key", () => {
    expect(normalizeMektekVehiclePlateNumber(" B 1234-XYZ ")).toBe("B1234XYZ");
    expect(normalizeMektekVehiclePlateNumber("b 1234 xyz")).toBe("B1234XYZ");
  });

  it("builds a readable vehicle choice label", () => {
    expect(
      formatMektekVehicleChoiceLabel({
        name: "Toyota Avanza 2021",
        plateNumber: "B 1234 XYZ",
        fleetNumber: null,
      }),
    ).toBe("B 1234 XYZ · Toyota Avanza 2021");
    expect(
      formatMektekVehicleChoiceLabel({
        name: "Hino Ranger",
        plateNumber: "DK 8001 AB",
        fleetNumber: "TR-07",
      }),
    ).toBe("DK 8001 AB · Hino Ranger · Lambung TR-07");
  });
});
