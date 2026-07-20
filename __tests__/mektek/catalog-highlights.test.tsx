import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import CustomerCatalogHighlights from "@/app/[locale]/customer/_components/CustomerCatalogHighlights";

describe("CustomerCatalogHighlights", () => {
  it("renders popular and newest catalogue discovery", () => {
    const base = { machine: "PC200", partNumber: null, quantity: "4", price: 100000, imagePath: null };
    const markup = renderToStaticMarkup(
      <CustomerCatalogHighlights
        locale="id"
        popular={[{ ...base, id: "filter", description: "Oil Filter", createdAt: new Date("2026-07-01"), soldQuantity: 14 }]}
        newest={[{ ...base, id: "seal", description: "New Seal", createdAt: new Date("2026-07-20") }]}
      />,
    );
    expect(markup).toContain("Paling banyak dibeli");
    expect(markup).toContain("14 terjual");
    expect(markup).toContain("Baru di katalog");
    expect(markup).toContain("New Seal");
    expect(markup).toContain("view=sparepart");
  });
});
