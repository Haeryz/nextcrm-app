type MektekServiceCustomerType = "STANDARD" | "B2B";

type MektekServiceCustomerInput = {
  customerName: string;
  phone: string;
  phoneNormalized: string;
  customerType: MektekServiceCustomerType;
  vehicleName?: string;
  vehiclePlateNumber?: string;
  vehicleFleetNumber?: string;
};

export function buildMektekServiceCustomerUpsert(
  input: MektekServiceCustomerInput,
) {
  const hasVehicle = Boolean(
    input.vehicleName?.trim() && input.vehiclePlateNumber?.trim(),
  );
  const vehicleFleetNumber =
    input.customerType === "B2B" ? input.vehicleFleetNumber ?? null : null;
  const vehicleFields = hasVehicle
    ? {
        vehicleName: input.vehicleName,
        vehiclePlateNumber: input.vehiclePlateNumber,
        vehicleFleetNumber,
      }
    : {};

  return {
    where: {
      phoneNormalized: input.phoneNormalized,
    },
    update: {
      phone: input.phone,
      customerType: input.customerType,
      ...vehicleFields,
    },
    create: {
      customerNumber: createMektekCustomerNumber(),
      username: input.customerName,
      phone: input.phone,
      phoneNormalized: input.phoneNormalized,
      customerType: input.customerType,
      ...vehicleFields,
    },
  };
}
import { createMektekCustomerNumber } from "@/lib/mektek/customer-number";
