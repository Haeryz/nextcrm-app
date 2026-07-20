type MektekServiceCustomerType = "STANDARD" | "B2B";

type MektekServiceCustomerInput = {
  customerName: string;
  phone: string;
  phoneNormalized: string;
  customerType: MektekServiceCustomerType;
  vehicleName: string;
  vehiclePlateNumber: string;
  vehicleFleetNumber: string;
};

export function buildMektekServiceCustomerUpsert(
  input: MektekServiceCustomerInput,
) {
  const vehicleFleetNumber =
    input.customerType === "B2B" ? input.vehicleFleetNumber : null;

  return {
    where: {
      phoneNormalized: input.phoneNormalized,
    },
    update: {
      phone: input.phone,
      customerType: input.customerType,
      vehicleName: input.vehicleName,
      vehiclePlateNumber: input.vehiclePlateNumber,
      vehicleFleetNumber,
    },
    create: {
      username: input.customerName,
      phone: input.phone,
      phoneNormalized: input.phoneNormalized,
      customerType: input.customerType,
      vehicleName: input.vehicleName,
      vehiclePlateNumber: input.vehiclePlateNumber,
      vehicleFleetNumber,
    },
  };
}
