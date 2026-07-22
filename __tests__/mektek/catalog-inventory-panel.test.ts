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

  it("renders non-interactive calendar day columns from the selected month", () => {
    expect(source).toMatch(/Array\.from\(\{ length: daysInMonth \}/);
    expect(source).toMatch(/inventory\.dailyMovements\.map/);
    expect(source).not.toContain("Catat mutasi tanggal");
    expect(source).not.toContain("aria-label={`Catat ${item.description}, tanggal");
    expect(source).toContain("daily.inbound.total");
    expect(source).toContain("daily.outbound.total");
  });

  it("starts item movement recording from the item name and supports Excel export", () => {
    expect(source).toContain("recordMektekCatalogStockMovement");
    expect(source).toContain("setMektekCatalogOpeningStock");
    expect(source).toContain("Catat mutasi stok untuk");
    expect(source).toContain("onClick={() => openMovement(item)}");
    expect(source).not.toContain('SelectTrigger aria-label="Item"');
    expect(source).toContain('SelectItem value="REAR"');
    expect(source).toContain('SelectItem value="FRONT"');
    expect(source).toContain('SelectItem value="IN"');
    expect(source).toContain('SelectItem value="OUT"');
    expect(source).toContain("/api/mektek/catalog-inventory/export?month=${month}");
  });
});
