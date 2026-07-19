import { buildMektekServiceCustomerUpsert } from "@/lib/mektek/service-customer";

describe("buildMektekServiceCustomerUpsert", () => {
  it("creates new customers and deduplicates existing customers by normalized phone", () => {
    expect(
      buildMektekServiceCustomerUpsert({
        customerName: "Dewi",
        phone: "+62 812-3456-7890",
        phoneNormalized: "6281234567890",
        customerType: "B2B",
      }),
    ).toEqual({
      where: { phoneNormalized: "6281234567890" },
      update: {
        phone: "+62 812-3456-7890",
        customerType: "B2B",
      },
      create: {
        username: "Dewi",
        phone: "+62 812-3456-7890",
        phoneNormalized: "6281234567890",
        customerType: "B2B",
      },
    });
  });
});
