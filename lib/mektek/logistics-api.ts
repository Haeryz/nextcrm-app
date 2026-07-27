import type { Session } from "next-auth";
import type { NextRequest } from "next/server";

import { authOptions } from "@/lib/auth";
import type { LogisticsStaffArea } from "@/lib/auth/logistics-staff-areas";
import { canManageMektekLogistics } from "@/lib/mektek/permissions";
import { getServerSession } from "@/lib/session";
import { getRequestSessionUser } from "@/lib/request-session";

type LogisticsApiGateResult =
  | { session: Session; response?: never }
  | { session?: never; response: Response };

/**
 * Authorize a Logistics API request. On Vercel, NextAuth's ambient
 * `getServerSession()` can return null in Route Handlers (Next 16), so we fall
 * back to `getRequestSessionUser(request)` which decodes the JWT directly from
 * the request cookies and refreshes authorization fields from Postgres.
 */
export async function requireMektekLogisticsApiSession(
  area?: LogisticsStaffArea,
  request?: Request,
): Promise<LogisticsApiGateResult> {
  let session = await getServerSession(authOptions);

  if (!session?.user?.id && request) {
    const user = await getRequestSessionUser(request);
    if (user?.id) {
      session = {
        user,
        expires: new Date(Date.now() + 1000 * 60 * 60).toISOString(),
      } as Session;
    }
  }

  if (!session?.user?.id) {
    return { response: Response.json({ error: "Unauthenticated" }, { status: 401 }) };
  }
  if (!canManageMektekLogistics(session.user, area)) {
    return { response: Response.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { session };
}
