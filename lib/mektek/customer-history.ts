export function summarizeCustomerServiceHistory(
  statuses: readonly (string | null | undefined)[],
) {
  const completed = statuses.filter((status) => status === "COMPLETE").length;

  return {
    total: statuses.length,
    completed,
    open: statuses.length - completed,
  };
}
