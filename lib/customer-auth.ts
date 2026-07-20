import "server-only";

import { getServerSession as getNextAuthServerSession } from "next-auth";
import type { Session } from "next-auth";

import { authOptions } from "@/lib/auth";
import { getCustomerServerSession } from "@/lib/customer-session";

function isLegacyCustomerSession(session: Session | null): session is Session {
  const user = session?.user;
  return Boolean(
    user?.id &&
      !user.isAdmin &&
      !user.mektekRole &&
      !user.staffDivision &&
      user.userStatus === "ACTIVE" &&
      (user.phoneNormalized || user.phone),
  );
}

/**
 * Dedicated customer authentication. New logins use revocable database sessions;
 * the NextAuth fallback keeps already-signed-in customers working during rollout.
 * Staff/admin sessions are deliberately never accepted by the customer storefront.
 */
export async function getCustomerAuthSession(): Promise<Session | null> {
  const customerSession = await getCustomerServerSession();
  if (customerSession) return customerSession;

  const legacySession = (await getNextAuthServerSession(
    authOptions,
  )) as Session | null;
  return isLegacyCustomerSession(legacySession) ? legacySession : null;
}

export async function getCustomerSessionUser() {
  const session = await getCustomerAuthSession();
  return session?.user ?? null;
}
