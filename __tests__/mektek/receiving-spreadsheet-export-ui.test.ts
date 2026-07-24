import fs from "fs";
import path from "path";

describe("Receiving export control", () => {
  it("places the server-generated Excel export on the consolidated Receiving page", () => {
    const source = fs.readFileSync(
      path.join(
        process.cwd(),
        "app/[locale]/(routes)/mektek/receiving/page.tsx",
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
