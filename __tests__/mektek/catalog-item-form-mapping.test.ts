import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("Catalogue Item form field mapping", () => {
  const source = readFileSync(
    resolve(
      process.cwd(),
      "app/[locale]/(routes)/mektek/items/_components/CatalogItemManager.tsx",
    ),
    "utf8",
  );

  it("maps Item Name, Machine, and Part Number to their correct values", () => {
    expect(source).toMatch(
      /<Field label="Item Name">[\s\S]*?value=\{value\.itemName\}[\s\S]*?update\("itemName"/,
    );
    expect(source).toMatch(
      /<Field label="Machine">[\s\S]*?value=\{value\.machine\}[\s\S]*?update\("machine"/,
    );
    expect(source).toMatch(
      /<Field label="Part Number">[\s\S]*?value=\{value\.partNumber[\s\S]*?update\("partNumber"/,
    );
  });

  it("includes production channel and both warehouse locations", () => {
    expect(source).toContain('label="Production Channel"');
    expect(source).toContain(
      '<SelectItem value="POWERTRAIN">Powertrain</SelectItem>',
    );
    expect(source).toContain(
      '<SelectItem value="THERMAL">Thermal</SelectItem>',
    );
    expect(source).not.toContain("jarang bergerak");
    expect(source).not.toContain("sering bergerak");
    expect(source).toContain('label="Lokasi G. Belakang"');
    expect(source).toContain('label="Lokasi G. Depan"');
    expect(source).toContain('label="Stok Awal G. Belakang"');
    expect(source).toContain('label="Stok Awal G. Depan"');
  });
});
