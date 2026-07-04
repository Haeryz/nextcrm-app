import type { Session } from "next-auth";

import { authOptions } from "@/lib/auth";
import {
  canAccessMektekStaffArea,
  canUseMektekCustomerTools,
} from "@/lib/mektek/permissions";
import { getServerSession } from "@/lib/session";

type ApiGateResult =
  | { session: Session; response?: never }
  | { session?: never; response: Response };

const jsonError = (error: string, status: number) =>
  Response.json({ error }, { status });

export async function requireMektekStaffApiSession(): Promise<ApiGateResult> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { response: jsonError("Unauthenticated", 401) };
  }
  if (!canAccessMektekStaffArea(session.user)) {
    return { response: jsonError("Forbidden", 403) };
  }
  return { session };
}

export async function requireMektekCustomerToolApiSession(): Promise<ApiGateResult> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { response: jsonError("Unauthenticated", 401) };
  }
  if (!canUseMektekCustomerTools(session.user)) {
    return { response: jsonError("Forbidden", 403) };
  }
  return { session };
}
