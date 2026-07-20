export type MektekCustomerVehicleValue = {
  name: string;
  plateNumber: string;
  fleetNumber?: string | null;
};

export function normalizeMektekVehiclePlateNumber(value: unknown) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

export function formatMektekVehicleChoiceLabel(
  vehicle: MektekCustomerVehicleValue,
) {
  return [
    vehicle.plateNumber,
    vehicle.name,
    vehicle.fleetNumber ? `Lambung ${vehicle.fleetNumber}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
}
