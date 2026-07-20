import type { StaffDivision } from "@/lib/auth/staff-divisions";

type LoginDestinationUser = {
  isAdmin?: boolean | null;
  mektekRole?: "CS" | "TECHNICIAN" | null;
  staffDivision?: StaffDivision | null;
  userStatus?: string | null;
};

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
        !!user?.staffDivision))
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
  if (user?.staffDivision) return `${prefix}/mektek/dashboard`;
  if (user?.mektekRole === "CS" || user?.mektekRole === "TECHNICIAN") {
    return `${prefix}/mektek`;
  }

  return `${prefix}/customer/profile`;
}
