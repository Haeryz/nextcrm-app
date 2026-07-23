import fs from "fs";
import path from "path";

describe("Receiving spreadsheet export control", () => {
  it("places a server-generated Excel export in the spreadsheet action toolbar", () => {
    const source = fs.readFileSync(
      path.join(
        process.cwd(),
        "app/[locale]/(routes)/mektek/receiving/spreadsheet/page.tsx",
      ),
      "utf8",
    );

    expect(source).toContain("Export Excel");
    expect(source).toContain("/api/mektek/receiving/purchase-orders/export");
    expect(source).toContain('queryString.set("q", query)');
    expect(source).toContain('queryString.set("status", status)');
    expect(source).not.toContain("XLSX.writeFile");
  });
});
