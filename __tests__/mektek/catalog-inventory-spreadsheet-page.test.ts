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
});
