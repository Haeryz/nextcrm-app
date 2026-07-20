import { canAccessMektekStaffArea } from "@/lib/mektek/permissions";
import type { StaffDivision } from "@/lib/auth/staff-divisions";

type StaffAuthUser = {
  is_admin?: boolean | null;
  mektekRole?: "CS" | "TECHNICIAN" | null;
  staffDivision?: StaffDivision | null;
  userStatus?: string | null;
};

export function canAuthenticateOnStaffPortal(
  user?: StaffAuthUser | null,
) {
  return canAccessMektekStaffArea({
    isAdmin: user?.is_admin,
    mektekRole: user?.mektekRole,
    staffDivision: user?.staffDivision,
    userStatus: user?.userStatus,
  });
}
