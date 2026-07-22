import {
  inferMektekCustomerType,
  resolveMektekCustomerNames,
} from "@/lib/mektek/customer-type";

describe("MekTek customer company detection", () => {
  it.each(["PT Maju Jaya", "CV. Sumber Makmur", "pt. karya", "cv abadi"])(
    "recognizes Indonesian company prefixes",
    (name) => expect(inferMektekCustomerType(name)).toBe("B2B"),
  );

  it("keeps ordinary personal names standard", () => {
    expect(inferMektekCustomerType("Budi Santoso")).toBe("STANDARD");
  });

  it("supports a company alone or a company represented by a person", () => {
    expect(resolveMektekCustomerNames({ companyName: "PT Maju", contactName: "" }))
      .toEqual({ customerName: "PT Maju", companyName: "PT Maju", contactName: null });
    expect(resolveMektekCustomerNames({ companyName: "CV Abadi", contactName: "Sari" }))
      .toEqual({ customerName: "CV Abadi", companyName: "CV Abadi", contactName: "Sari" });
  });
});
