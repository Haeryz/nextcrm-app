import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("monthly catalogue inventory panel", () => {
  const source = readFileSync(
    resolve(
      process.cwd(),
      "app/[locale]/(routes)/mektek/items/_components/CatalogInventoryPanel.tsx",
    ),
    "utf8",
  );

  it("renders calendar day columns from the selected month's day count", () => {
    expect(source).toMatch(/Array\.from\(\{ length: daysInMonth \}/);
    expect(source).toMatch(/inventory\.dailyMovements\.map/);
    expect(source).toContain("Catat mutasi tanggal");
    expect(source).toContain("daily.inbound.total");
    expect(source).toContain("daily.outbound.total");
  });

  it("provides date-driven item movement recording and monthly Excel export", () => {
    expect(source).toContain("recordMektekCatalogStockMovement");
    expect(source).toContain("setMektekCatalogOpeningStock");
    expect(source).toContain('SelectTrigger aria-label="Item"');
    expect(source).toContain('SelectItem value="REAR"');
    expect(source).toContain('SelectItem value="FRONT"');
    expect(source).toContain('SelectItem value="IN"');
    expect(source).toContain('SelectItem value="OUT"');
    expect(source).toContain("/api/mektek/catalog-inventory/export?month=${month}");
  });
});
