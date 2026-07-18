import {
  getCatalogImageSource,
  getExistingCatalogImagePath,
} from "@/lib/catalog-images";

describe("catalog image sources", () => {
  it("uses the uploaded-image endpoint when database image data exists", () => {
    expect(
      getCatalogImageSource({
        id: "item / 1",
        imageMimeType: "image/jpeg",
        imagePath: "/catalog/images/legacy.jpeg",
      }),
    ).toBe("/api/mektek/catalog-items/item%20%2F%201/image");
  });

  it("falls back to an existing static catalogue path", () => {
    expect(
      getCatalogImageSource({
        id: "item-1",
        imageMimeType: null,
        imagePath: "/catalog/images/legacy.jpeg",
      }),
    ).toBe("/catalog/images/legacy.jpeg");
  });

  it("allows only known catalogue image URLs", () => {
    expect(
      getExistingCatalogImagePath("/api/mektek/catalog-items/item-1/image"),
    ).toBe("/api/mektek/catalog-items/item-1/image");
    expect(getExistingCatalogImagePath("/uploads/arbitrary.png")).toBeNull();
    expect(getExistingCatalogImagePath("/catalog/images/../secret")).toBeNull();
  });
});
