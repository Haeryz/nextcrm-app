import {
  isNavigationRouteActive,
  normalizeNavigationPathname,
} from "@/lib/navigation/route-matching";

describe("sidebar route matching", () => {
  it("removes the locale segment before matching navigation URLs", () => {
    expect(normalizeNavigationPathname("/id/mektek/items")).toBe(
      "/mektek/items",
    );
    expect(normalizeNavigationPathname("/en/mektek")).toBe("/mektek");
  });

  it("matches nested routes without matching lookalike path segments", () => {
    expect(
      isNavigationRouteActive(
        "/id/mektek/items/detail/123",
        "/mektek/items",
      ),
    ).toBe(true);
    expect(
      isNavigationRouteActive(
        "/id/mektek/items-archive",
        "/mektek/items",
      ),
    ).toBe(false);
  });

  it("supports exact routes", () => {
    expect(
      isNavigationRouteActive("/id/mektek", "/mektek", true),
    ).toBe(true);
    expect(
      isNavigationRouteActive("/id/mektek/history", "/mektek", true),
    ).toBe(false);
  });
});
