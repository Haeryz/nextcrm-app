import {
  CUSTOMER_PASSWORD_GROUPS,
  DEFAULT_CUSTOMER_PASSWORD_LENGTH,
  generateRandomCustomerPassword,
} from "@/lib/mektek/customer-password-generator";

describe("customer password generator", () => {
  it("generates a password with every required character group", () => {
    const password = generateRandomCustomerPassword(16, () => 0);

    expect(password).toHaveLength(16);
    for (const group of CUSTOMER_PASSWORD_GROUPS) {
      expect([...password].some((character) => group.includes(character))).toBe(true);
    }
  });

  it("uses the secure default length and enforces safe bounds", () => {
    expect(generateRandomCustomerPassword(undefined, () => 0)).toHaveLength(
      DEFAULT_CUSTOMER_PASSWORD_LENGTH,
    );
    expect(generateRandomCustomerPassword(2, () => 0)).toHaveLength(12);
    expect(generateRandomCustomerPassword(100, () => 0)).toHaveLength(64);
  });
});
