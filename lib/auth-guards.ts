import "server-only";
import { redirect } from "next/navigation";
import type { Session } from "next-auth";

import { authOptions } from "@/lib/auth";
import { canAccessMektekStaffArea } from "@/lib/mektek/permissions";
import { hasMektekCapability } from "@/lib/mektek/permissions";
import { canManageMektekLogisticsPics } from "@/lib/mektek/permissions";
import { getServerSession } from "@/lib/session";

type SessionUser = NonNullable<Session["user"]>;

/**
 * Central, reusable access guards for server components / layouts / server actions.
 *
 * Page and action code should call these instead of re-deriving session + role
 * checks by hand, so gating stays consistent everywhere. All `require*` helpers
 * redirect (they never return null) — the returned user is always authorized.
 */

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await getServerSession(authOptions);
  return session?.user ?? null;
}

/** Any authenticated (and non-suspended) user. Redirects to sign-in otherwise. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user?.id) redirect("/sign-in");
  if (user.userStatus === "PENDING") redirect("/pending");
  if (user.userStatus === "INACTIVE") redirect("/sign-in?reason=account_inactive");
  return user;
}

/** Admins only. Redirects non-admins away from the admin surface. */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (!user.isAdmin) redirect("/");
  return user;
}

/** Any Mektek staff (admin, CS, or technician). */
export async function requireMektekStaff(): Promise<SessionUser> {
  const user = await requireUser();
  if (!canAccessMektekStaffArea(user)) redirect("/");
  return user;
}

/** Admin or Customer Service staff (for Technician directory management). */
export async function requireMektekCustomerServiceStaff(): Promise<SessionUser> {
  const user = await requireUser();
  if (
    !user.isAdmin &&
    !hasMektekCapability(user, "MEKTEK_CUSTOMER_SERVICE")
  ) {
    redirect("/");
  }
  return user;
}

/** Admin or Logistics staff (either area) for the shared PIC directory. */
export async function requireMektekLogisticsPicsStaff(): Promise<SessionUser> {
  const user = await requireUser();
  if (!canManageMektekLogisticsPics(user)) redirect("/");
  return user;
}
