export const STAFF_DIVISIONS = [
  "OPERATIONS",
  "CUSTOMER_SERVICE",
  "TECHNICAL",
  "LOGISTICS",
  "FINANCE",
  "HUMAN_RESOURCES",
] as const;

export type StaffDivision = (typeof STAFF_DIVISIONS)[number];

export const STAFF_DIVISION_LABELS: Record<StaffDivision, string> = {
  OPERATIONS: "Operations",
  CUSTOMER_SERVICE: "Customer Service",
  TECHNICAL: "Technical",
  LOGISTICS: "Logistics",
  FINANCE: "Finance",
  HUMAN_RESOURCES: "Human Resources",
};

export function isStaffDivision(value: unknown): value is StaffDivision {
  return (
    typeof value === "string" &&
    (STAFF_DIVISIONS as readonly string[]).includes(value)
  );
}
