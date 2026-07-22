import {
  MAX_VEHICLE_MILEAGE_KM,
  parseVehicleMileageKm,
} from "@/lib/mektek/vehicle-mileage";

describe("parseVehicleMileageKm", () => {
  it.each(["", "   ", null, undefined])(
    "accepts a missing optional odometer value",
    (input) => {
      expect(parseVehicleMileageKm(input)).toEqual({ data: null });
    },
  );

  it.each([
    ["0", 0],
    ["125000", 125000],
    [999999, 999999],
  ])("accepts a non-negative whole-number odometer value", (input, expected) => {
    expect(parseVehicleMileageKm(input)).toEqual({ data: expected });
  });

  it.each(["12.5", "1e3", "-1", "12 km", MAX_VEHICLE_MILEAGE_KM + 1])(
    "rejects an invalid or out-of-range odometer value",
    (input) => {
      expect(parseVehicleMileageKm(input)).toEqual({
        error: `KM mobil wajib berupa angka bulat antara 0 dan ${MAX_VEHICLE_MILEAGE_KM.toLocaleString("id-ID")}`,
      });
    },
  );
});
