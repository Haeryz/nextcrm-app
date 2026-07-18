export type PaginationItem = number | "ellipsis";

/**
 * Build a compact, stable set of numbered pagination controls.
 * The first/last page are always reachable and the current page keeps two
 * neighbors on either side when space allows.
 */
export function getPaginationItems(
  currentPage: number,
  totalPages: number,
): PaginationItem[] {
  const normalizedTotal = Math.max(1, Math.floor(Number(totalPages) || 1));
  const normalizedCurrent = Math.min(
    normalizedTotal,
    Math.max(1, Math.floor(Number(currentPage) || 1)),
  );

  if (normalizedTotal <= 7) {
    return Array.from({ length: normalizedTotal }, (_, index) => index + 1);
  }

  if (normalizedCurrent <= 4) {
    return [1, 2, 3, 4, "ellipsis", normalizedTotal];
  }

  if (normalizedCurrent >= normalizedTotal - 3) {
    return [
      1,
      "ellipsis",
      normalizedTotal - 3,
      normalizedTotal - 2,
      normalizedTotal - 1,
      normalizedTotal,
    ];
  }

  return [
    1,
    "ellipsis",
    normalizedCurrent - 2,
    normalizedCurrent - 1,
    normalizedCurrent,
    normalizedCurrent + 1,
    normalizedCurrent + 2,
    "ellipsis",
    normalizedTotal,
  ];
}
