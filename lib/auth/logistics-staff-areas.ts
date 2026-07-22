export const LOGISTICS_STAFF_AREAS = ["MONITORING_PO", "RECEIVING"] as const;

export type LogisticsStaffArea = (typeof LOGISTICS_STAFF_AREAS)[number];

export const LOGISTICS_STAFF_AREA_LABELS: Record<LogisticsStaffArea, string> = {
  MONITORING_PO: "Monitoring PO",
  RECEIVING: "Receiving",
};

export function isLogisticsStaffArea(
  value: unknown,
): value is LogisticsStaffArea {
  return LOGISTICS_STAFF_AREAS.some((area) => area === value);
}
