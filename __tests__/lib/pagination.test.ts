import { getPaginationItems } from "@/lib/pagination";

describe("getPaginationItems", () => {
  it("shows every page when the result set is short", () => {
    expect(getPaginationItems(3, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it("keeps the current page centered with boundary links", () => {
    expect(getPaginationItems(5, 10)).toEqual([
      1,
      "ellipsis",
      3,
      4,
      5,
      6,
      7,
      "ellipsis",
      10,
    ]);
  });

  it("uses a compact range near the first and last page", () => {
    expect(getPaginationItems(1, 10)).toEqual([1, 2, 3, 4, "ellipsis", 10]);
    expect(getPaginationItems(10, 10)).toEqual([1, "ellipsis", 7, 8, 9, 10]);
  });

  it("normalizes invalid page values", () => {
    expect(getPaginationItems(99, 3)).toEqual([1, 2, 3]);
    expect(getPaginationItems(1, 0)).toEqual([1]);
  });
});
