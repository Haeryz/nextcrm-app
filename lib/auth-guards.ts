import "server-only";
import { redirect } from "next/navigation";
import type { Session } from "next-auth";

import { authOptions } from "@/lib/auth";
import { getServerSession } from "@/lib/session";
import { canAccessMektekStaffArea } from "@/lib/mektek/permissions";

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
  if (user.userStatus === "INACTIVE") redirect("/inactive");
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
