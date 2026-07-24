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

  it("maps the Indonesian item identity fields to their correct values", () => {
    expect(source).toMatch(
      /<Field label="Nama Spare Part">[\s\S]*?value=\{value\.itemName\}[\s\S]*?update\("itemName"/,
    );
    expect(source).toMatch(
      /<Field label="Mesin">[\s\S]*?value=\{value\.machine\}[\s\S]*?update\("machine"/,
    );
    expect(source).toMatch(
      /<Field label="Nomor Part">[\s\S]*?value=\{value\.partNumber[\s\S]*?update\("partNumber"/,
    );
  });

  it("includes production channel and both warehouse locations", () => {
    expect(source).toContain('label="Divisi Produksi"');
    expect(source).toContain(
      '<SelectItem value="POWERTRAIN">Powertrain</SelectItem>',
    );
    expect(source).toContain(
      '<SelectItem value="THERMAL">Thermal</SelectItem>',
    );
    expect(source).not.toContain("jarang bergerak");
    expect(source).not.toContain("sering bergerak");
    expect(source).toContain('label="Lokasi Gudang Belakang"');
    expect(source).toContain('label="Lokasi Gudang Depan"');
    expect(source).toContain('"Stok Awal G. Belakang"');
    expect(source).toContain('"Stok Awal G. Depan"');
    expect(source).toContain('"Total Unit Gudang Belakang"');
    expect(source).toContain('"Total Unit Gudang Depan"');
    expect(source).toMatch(/initialRearStock:\s*String\(item\.rearStock\)/);
    expect(source).toMatch(/initialFrontStock:\s*String\(item\.frontStock\)/);
  });
});
