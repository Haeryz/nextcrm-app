import fs from "fs";
import path from "path";

describe("service-order export controls", () => {
  it("lets staff choose a month and downloads through the full-data API", () => {
    const source = fs.readFileSync(
      path.join(
        process.cwd(),
        "app/[locale]/(routes)/mektek/_components/ExcelExportButton.tsx",
      ),
      "utf8",
    );

    expect(source).toContain('type="month"');
    expect(source).toContain("/api/mektek/service-orders/export");
    expect(source).toContain("month=");
    expect(source).toContain("fromMonth=");
    expect(source).toContain("toMonth=");
    expect(source).toContain("year=");
    expect(source).not.toContain("XLSX.writeFile");
    expect(source).not.toContain("orders: ServiceOrder[]");
  });
});
