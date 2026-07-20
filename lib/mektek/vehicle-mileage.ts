export const MAX_VEHICLE_MILEAGE_KM = 99_999_999;

const error = () => ({
  error: `KM mobil wajib berupa angka bulat antara 0 dan ${MAX_VEHICLE_MILEAGE_KM.toLocaleString("id-ID")}`,
} as const);

export function parseVehicleMileageKm(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!/^\d+$/.test(raw)) return error();

  const mileage = Number(raw);
  if (!Number.isSafeInteger(mileage) || mileage > MAX_VEHICLE_MILEAGE_KM) {
    return error();
  }

  return { data: mileage } as const;
}
