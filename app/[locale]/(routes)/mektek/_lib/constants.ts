export const statusMap: Record<string, { label: string; progress: number }> = {
  ACTIVE: { label: "In Progress", progress: 65 },
  PENDING: { label: "Pending", progress: 35 },
  COMPLETE: { label: "Completed", progress: 100 },
};

export const discountTiers: { minVisits: number; discount: number; label: string }[] = [
  { minVisits: 11, discount: 15, label: "Platinum" },
  { minVisits: 6,  discount: 10, label: "Gold" },
  { minVisits: 3,  discount: 5,  label: "Silver" },
  { minVisits: 1,  discount: 0,  label: "Member" },
];

export function getDiscountTier(visitCount: number) {
  return discountTiers.find((tier) => visitCount >= tier.minVisits) ?? null;
}

export function calculateProgress(
  timeline: { completed: boolean }[],
  taskStatus: string | null | undefined
): number {
  if (taskStatus === "COMPLETE") return 100;
  if (!timeline || timeline.length === 0) {
    return taskStatus === "PENDING" ? 0 : 10;
  }
  const completed = timeline.filter((s) => s.completed).length;
  const ratio = Math.round((completed / timeline.length) * 100);
  if (taskStatus === "PENDING") return Math.min(ratio, 99);
  return Math.max(1, Math.min(ratio, 99));
}

export function getStatusMeta(taskStatus: string | null | undefined): {
  label: string;
  badgeVariant: "default" | "secondary";
  barColor: string;
} {
  switch (taskStatus) {
    case "COMPLETE": return { label: "Completed",   badgeVariant: "default",   barColor: "bg-green-500" };
    case "PENDING":  return { label: "Pending",     badgeVariant: "secondary", barColor: "bg-amber-500" };
    default:         return { label: "In Progress", badgeVariant: "secondary", barColor: "bg-blue-500"  };
  }
}
