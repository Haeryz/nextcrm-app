import type { Session } from "next-auth";

import { authOptions } from "@/lib/auth";
import { canManageMektekLogistics } from "@/lib/mektek/permissions";
import { getServerSession } from "@/lib/session";

type LogisticsApiGateResult =
  | { session: Session; response?: never }
  | { session?: never; response: Response };

export async function requireMektekLogisticsApiSession(): Promise<LogisticsApiGateResult> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { response: Response.json({ error: "Unauthenticated" }, { status: 401 }) };
  }
  if (!canManageMektekLogistics(session.user)) {
    return { response: Response.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { session };
}
