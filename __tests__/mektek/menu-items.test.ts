import getMektekMenuItems from "@/app/[locale]/(routes)/components/menu-items/Mektek";

describe("Mektek sidebar menu", () => {
  it("groups Catalog, Monitoring PO, and Receiving under Logistics", () => {
    const menu = getMektekMenuItems({
      isAdmin: true,
      userStatus: "ACTIVE",
    });
    const logistics = menu.find((item) => item.title === "Logistics");

    expect(logistics?.items?.map((item) => item.title)).toEqual([
      "Catalog / Item",
      "Monitoring PO",
      "Receiving",
    ]);
  });

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

  it.each([
    ["MONITORING_PO", ["Catalog / Item", "Monitoring PO"]],
    ["RECEIVING", ["Catalog / Item", "Receiving"]],
  ] as const)("shows only Catalog and %s to scoped Logistics staff", (area, expected) => {
    const menu = getMektekMenuItems({
      isAdmin: false,
      staffDivision: "LOGISTICS",
      logisticsStaffArea: area,
      userStatus: "ACTIVE",
    });
    const logistics = menu.find((item) => item.title === "Logistics");

    expect(menu.map((item) => item.title)).toEqual(["Logistics"]);
    expect(logistics?.items?.map((item) => item.title)).toEqual(expected);
  });
});
