export type SupplyAllocationApprovalRow = {
  allocationId: string;
  purchaseOrderId: string;
  poNumber: string;
  poMode: "MANUAL" | "CONSIGNMENT";
  purchaseOrderStatus: string;
  customerName: string;
  projectName: string;
  counterpartyId: string;
  projectKey: string;
  itemKey: string;
  itemName: string;
  partNumber: string | null;
  quantity: number;
  supplyStartDate: string;
  supplyEndDate: string;
  reviewStatus: "CLEAR" | "BLOCKED" | "OVERRIDDEN";
};

export type SupplyConflictItem = Pick<
  SupplyAllocationApprovalRow,
  | "allocationId"
  | "itemName"
  | "partNumber"
  | "quantity"
  | "supplyStartDate"
  | "supplyEndDate"
  | "reviewStatus"
>;

export type SupplyConflictPurchaseOrder = Pick<
  SupplyAllocationApprovalRow,
  | "purchaseOrderId"
  | "poNumber"
  | "poMode"
  | "purchaseOrderStatus"
  | "customerName"
  | "projectName"
> & {
  supplyStartDate: string;
  supplyEndDate: string;
  items: SupplyConflictItem[];
};

export type SupplyConflictContext = {
  blockedPurchaseOrder: SupplyConflictPurchaseOrder;
  conflictingPurchaseOrders: SupplyConflictPurchaseOrder[];
};

const activeReviewStatuses = new Set(["CLEAR", "BLOCKED", "OVERRIDDEN"]);

export const supplyPeriodsOverlap = (
  left: Pick<SupplyAllocationApprovalRow, "supplyStartDate" | "supplyEndDate">,
  right: Pick<SupplyAllocationApprovalRow, "supplyStartDate" | "supplyEndDate">,
) =>
  left.supplyStartDate <= right.supplyEndDate &&
  left.supplyEndDate >= right.supplyStartDate;

const isOpposingSupplyAllocation = (
  current: SupplyAllocationApprovalRow,
  candidate: SupplyAllocationApprovalRow,
) =>
  current.purchaseOrderId !== candidate.purchaseOrderId &&
  current.counterpartyId === candidate.counterpartyId &&
  current.projectKey === candidate.projectKey &&
  current.itemKey === candidate.itemKey &&
  current.poMode !== candidate.poMode &&
  activeReviewStatuses.has(candidate.reviewStatus) &&
  supplyPeriodsOverlap(current, candidate);

const uniqueItems = (rows: SupplyAllocationApprovalRow[]) =>
  Array.from(new Map(rows.map((row) => [row.allocationId, row])).values())
    .sort((left, right) => left.itemName.localeCompare(right.itemName, "id-ID"))
    .map(
      (row): SupplyConflictItem => ({
        allocationId: row.allocationId,
        itemName: row.itemName,
        partNumber: row.partNumber,
        quantity: row.quantity,
        supplyStartDate: row.supplyStartDate,
        supplyEndDate: row.supplyEndDate,
        reviewStatus: row.reviewStatus,
      }),
    );

const purchaseOrderFromRows = (
  rows: SupplyAllocationApprovalRow[],
): SupplyConflictPurchaseOrder => {
  const first = rows[0];
  const starts = rows.map((row) => row.supplyStartDate).sort();
  const ends = rows.map((row) => row.supplyEndDate).sort();
  return {
    purchaseOrderId: first.purchaseOrderId,
    poNumber: first.poNumber,
    poMode: first.poMode,
    purchaseOrderStatus: first.purchaseOrderStatus,
    customerName: first.customerName,
    projectName: first.projectName,
    supplyStartDate: starts[0],
    supplyEndDate: ends.at(-1) ?? first.supplyEndDate,
    items: uniqueItems(rows),
  };
};

export const buildSupplyConflictContext = (
  blockedPurchaseOrderId: string,
  allocations: SupplyAllocationApprovalRow[],
): SupplyConflictContext | null => {
  const currentRows = allocations.filter(
    (row) => row.purchaseOrderId === blockedPurchaseOrderId,
  );
  if (!currentRows.length) return null;

  const matchedCurrentRows = new Map<string, SupplyAllocationApprovalRow>();
  const opposingRowsByPurchaseOrder = new Map<
    string,
    Map<string, SupplyAllocationApprovalRow>
  >();

  for (const current of currentRows) {
    for (const candidate of allocations) {
      if (!isOpposingSupplyAllocation(current, candidate)) continue;
      matchedCurrentRows.set(current.allocationId, current);
      const grouped =
        opposingRowsByPurchaseOrder.get(candidate.purchaseOrderId) ?? new Map();
      grouped.set(candidate.allocationId, candidate);
      opposingRowsByPurchaseOrder.set(candidate.purchaseOrderId, grouped);
    }
  }

  if (!matchedCurrentRows.size || !opposingRowsByPurchaseOrder.size) return null;

  return {
    blockedPurchaseOrder: purchaseOrderFromRows([...matchedCurrentRows.values()]),
    conflictingPurchaseOrders: [...opposingRowsByPurchaseOrder.values()]
      .map((rows) => purchaseOrderFromRows([...rows.values()]))
      .sort((left, right) => left.poNumber.localeCompare(right.poNumber, "id-ID")),
  };
};
