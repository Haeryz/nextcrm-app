import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("catalog inventory spreadsheet route", () => {
  const itemsPageSource = readFileSync(
    resolve(process.cwd(), "app/[locale]/(routes)/mektek/items/page.tsx"),
    "utf8",
  );
  const spreadsheetPageSource = readFileSync(
    resolve(
      process.cwd(),
      "app/[locale]/(routes)/mektek/items/spreadsheet/page.tsx",
    ),
    "utf8",
  );
  const inventoryPanelSource = readFileSync(
    resolve(
      process.cwd(),
      "app/[locale]/(routes)/mektek/items/_components/CatalogInventoryPanel.tsx",
    ),
    "utf8",
  );
  const catalogManagerSource = readFileSync(
    resolve(
      process.cwd(),
      "app/[locale]/(routes)/mektek/items/_components/CatalogItemManager.tsx",
    ),
    "utf8",
  );

  it("keeps the inventory spreadsheet on a dedicated route", () => {
    expect(itemsPageSource).toContain("/mektek/items/spreadsheet");
    expect(itemsPageSource).not.toContain("<CatalogInventoryPanel");
    expect(spreadsheetPageSource).toContain(
      "getMektekCatalogInventoryExportData",
    );
    expect(spreadsheetPageSource).toContain("<CatalogInventoryPanel");
  });

  it("loads the full export data source instead of one paginated item page", () => {
    expect(spreadsheetPageSource).not.toContain("pageSize");
    expect(spreadsheetPageSource).toContain("inventory.snapshots");
  });

  it("shows movement classification in Catalog / Item instead of the spreadsheet", () => {
    expect(catalogManagerSource).toContain("<span>Pergerakan</span>");
    expect(catalogManagerSource).toContain("<CatalogMovementBadge");
    expect(inventoryPanelSource).not.toContain("stock-card-movement");
    expect(inventoryPanelSource).not.toContain(">Pergerakan</th>");
  });

  it("moves the Stok Rendah indicator and filter to Catalog / Item", () => {
    expect(catalogManagerSource).toContain("Stok Rendah");
    expect(catalogManagerSource).toContain("AlertTriangle");
    expect(inventoryPanelSource).not.toContain("Stok Rendah");
    expect(itemsPageSource).toContain('paramName="lowStock"');
    expect(itemsPageSource).toContain("lowStock");
  });
});
