type MektekServiceCustomerType = "STANDARD" | "B2B";

type MektekServiceCustomerInput = {
  customerName: string;
  phone: string;
  phoneNormalized: string;
  customerType: MektekServiceCustomerType;
};

export function buildMektekServiceCustomerUpsert(
  input: MektekServiceCustomerInput,
) {
  return {
    where: {
      phoneNormalized: input.phoneNormalized,
    },
    update: {
      phone: input.phone,
      customerType: input.customerType,
    },
    create: {
      username: input.customerName,
      phone: input.phone,
      phoneNormalized: input.phoneNormalized,
      customerType: input.customerType,
    },
  };
}
