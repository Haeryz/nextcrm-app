import { canAccessMektekStaffArea } from "@/lib/mektek/permissions";

type StaffAuthUser = {
  is_admin?: boolean | null;
  mektekRole?: "CS" | "TECHNICIAN" | null;
  userStatus?: string | null;
};

export function canAuthenticateOnStaffPortal(
  user?: StaffAuthUser | null,
) {
  return canAccessMektekStaffArea({
    isAdmin: user?.is_admin,
    mektekRole: user?.mektekRole,
    userStatus: user?.userStatus,
  });
}
