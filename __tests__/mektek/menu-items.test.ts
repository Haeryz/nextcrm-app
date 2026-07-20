import getMektekMenuItems from "@/app/[locale]/(routes)/components/menu-items/Mektek";

describe("Mektek sidebar menu", () => {
  it("shows Voucher, Technician, then Sub-admin to the main admin", () => {
    const titles = getMektekMenuItems({
      isAdmin: true,
      userStatus: "ACTIVE",
    }).map((item) => item.title);

    expect(titles.slice(-3)).toEqual(["Voucher", "Technician", "Sub-admin"]);
  });

  it("does not expose either CRUD menu to non-admin division staff", () => {
    const titles = getMektekMenuItems({
      isAdmin: false,
      staffDivision: "TECHNICAL",
      userStatus: "ACTIVE",
    }).map((item) => item.title);

    expect(titles).not.toContain("Technician");
    expect(titles).not.toContain("Sub-admin");
  });
});
