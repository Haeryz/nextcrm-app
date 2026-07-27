import type { Session } from "next-auth";
import type { NextRequest } from "next/server";

import { authOptions } from "@/lib/auth";
import {
  canAccessMektekStaffArea,
  canUseMektekCustomerTools,
} from "@/lib/mektek/permissions";
import { getRequestSessionUser } from "@/lib/request-session";
import { getServerSession } from "@/lib/session";

type ApiGateResult =
  | { session: Session; response?: never }
  | { session?: never; response: Response };

const jsonError = (error: string, status: number) =>
  Response.json({ error }, { status });

export async function requireMektekStaffApiSession(
  request?: NextRequest
): Promise<ApiGateResult> {
  const ambientSession = await getServerSession(authOptions);
  const user = ambientSession?.user?.id
    ? ambientSession.user
    : request
      ? await getRequestSessionUser(request)
      : null;
  if (!user?.id) {
    return { response: jsonError("Unauthenticated", 401) };
  }
  if (!canAccessMektekStaffArea(user)) {
    return { response: jsonError("Forbidden", 403) };
  }
  const session = ambientSession ?? ({ user, expires: new Date(0).toISOString() } as Session);
  return { session };
}

export async function requireMektekCustomerToolApiSession(
  request?: NextRequest,
): Promise<ApiGateResult> {
  const ambientSession = await getServerSession(authOptions);
  const user = ambientSession?.user?.id
    ? ambientSession.user
    : request
      ? await getRequestSessionUser(request)
      : null;
  if (!user?.id) {
    return { response: jsonError("Unauthenticated", 401) };
  }
  if (!canUseMektekCustomerTools(user)) {
    return { response: jsonError("Forbidden", 403) };
  }
  const session = ambientSession ?? ({ user, expires: new Date(0).toISOString() } as Session);
  return { session };
}
