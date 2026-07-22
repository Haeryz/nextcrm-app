import "server-only";
import type { Session } from "next-auth";
import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";

import { getSessionUser } from "@/lib/auth-guards";
import { prismadb } from "@/lib/prisma";

type SessionUser = NonNullable<Session["user"]>;

/**
 * Resolves the signed-in user in a Route Handler.
 *
 * NextAuth's ambient `getServerSession()` lookup is reliable in Server Components,
 * but can return null in Route Handlers on the current Next 16 deployment. Fall
 * back to decoding the same signed JWT from the explicit request, then refresh all
 * authorization fields from Postgres before granting access.
 */
export async function getRequestSessionUser(
  request: NextRequest
): Promise<SessionUser | null> {
  const ambientUser = await getSessionUser();
  if (ambientUser?.id) return ambientUser;

  const secret = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) return null;

  const token = await getToken({ req: request, secret });
  const userId = typeof token?.id === "string" ? token.id : token?.sub;
  if (!userId) return null;
  const tokenAuthVersion = Number(token?.authVersion ?? 0);

  const user = await prismadb.users.findUnique({ where: { id: userId } });
  if (!user || tokenAuthVersion !== user.authVersion) return null;

  return {
    id: user.id,
    _id: user.id,
    email: user.email,
    name: user.name,
    image: user.avatar ?? undefined,
    avatar: user.avatar ?? undefined,
    phone: user.phone,
    phoneNormalized: user.phoneNormalized,
    isAdmin: user.is_admin,
    mektekRole: user.mektekRole,
    staffDivision: user.staffDivision,
    logisticsStaffArea: user.logisticsStaffArea,
    userLanguage: user.userLanguage,
    userStatus: user.userStatus,
    lastLoginAt: user.lastLoginAt,
  } as SessionUser;
}
