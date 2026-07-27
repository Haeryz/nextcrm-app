import type { StaffCapability } from "@/lib/auth/staff-capabilities";

type LoginDestinationUser = {
  isAdmin?: boolean | null;
  mektekRole?: "CS" | "TECHNICIAN" | null;
  staffDivision?: string | null;
  staffCapabilities?: StaffCapability[] | null;
  userStatus?: string | null;
};

// Capability → post-login landing page. The first matching capability wins so the
// user lands on their most privileged workspace instead of a generic dashboard.
const CAPABILITY_DESTINATIONS: Array<{
  capability: StaffCapability;
  path: string;
}> = [
  { capability: "MEKTEK_DASHBOARD", path: "mektek/dashboard" },
  { capability: "MEKTEK_MONITORING_PO", path: "mektek/logistics" },
  { capability: "MEKTEK_RECEIVING", path: "mektek/receiving" },
  { capability: "MEKTEK_CATALOG", path: "mektek/items" },
  { capability: "MEKTEK_FINANCE", path: "mektek/finance" },
  { capability: "MEKTEK_CUSTOMERS", path: "mektek/customers" },
  { capability: "MEKTEK_SERVICE_ORDERS", path: "mektek" },
  { capability: "MEKTEK_VOUCHERS", path: "mektek/vouchers" },
  { capability: "MEKTEK_CUSTOMER_TOOLS", path: "mektek/whatsapp" },
  { capability: "MEKTEK_CREATE_ORDERS", path: "mektek" },
  { capability: "MEKTEK_UPDATE_PROGRESS", path: "mektek" },
  { capability: "MEKTEK_MANAGE_PAYMENTS", path: "mektek" },
  { capability: "MEKTEK_MANAGE_SCHEDULE", path: "mektek" },
];

export function shouldRedirectFromStaffLogin(
  user?: LoginDestinationUser | null,
) {
  return (
    user?.userStatus === "PENDING" ||
    user?.userStatus === "INACTIVE" ||
    (user?.userStatus === "ACTIVE" &&
      (!!user?.isAdmin ||
        user?.mektekRole === "CS" ||
        user?.mektekRole === "TECHNICIAN" ||
        !!user?.staffDivision ||
        (!!user?.staffCapabilities && user.staffCapabilities.length > 0)))
  );
}

export function getPostLoginDestination(
  locale: string,
  user?: LoginDestinationUser | null,
) {
  const prefix = `/${locale}`;

  if (user?.userStatus === "PENDING") return `${prefix}/pending`;
  if (user?.userStatus === "INACTIVE") return `${prefix}/inactive`;
  if (user?.isAdmin) return `${prefix}/mektek/dashboard`;

  const capabilities = user?.staffCapabilities ?? [];
  if (capabilities.length > 0) {
    const match = CAPABILITY_DESTINATIONS.find((entry) =>
      capabilities.includes(entry.capability),
    );
    if (match) return `${prefix}/${match.path}`;
  }

  // Legacy staffDivision fallback for accounts created before the capability
  // migration that have not yet been re-saved with capabilities.
  if (user?.staffDivision === "LOGISTICS") return `${prefix}/mektek/items`;
  if (user?.staffDivision) return `${prefix}/mektek/dashboard`;
  if (user?.mektekRole === "CS" || user?.mektekRole === "TECHNICIAN") {
    return `${prefix}/mektek`;
  }

  return `${prefix}/customer/profile`;
}
