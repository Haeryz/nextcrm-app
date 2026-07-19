import { authOptions as defaultAuthOptions } from "@/lib/auth";
import { prismadb } from "@/lib/prisma";
import { getServerSession as getNextAuthServerSession } from "next-auth";
import type { NextAuthOptions, Session } from "next-auth";

// No-auth mode is opt-in: it is enabled only when explicitly set to "true".
const NO_AUTH_ENABLED = process.env.NEXTCRM_DISABLE_AUTH === "true";

// Fail fast rather than silently shipping an open admin surface: in production,
// no-auth mode resolves every request to a guest with isAdmin:true. Refuse to
// boot unless an operator has explicitly acknowledged the risk.
//
// Skip during `next build` (NEXT_PHASE === "phase-production-build"): the build
// sets NODE_ENV=production and imports this module to collect page data, but env
// like NEXTCRM_DISABLE_AUTH is a *runtime* concern. We only want to block a
// real running server, not the build.
if (
  NO_AUTH_ENABLED &&
  process.env.NODE_ENV === "production" &&
  process.env.NEXT_PHASE !== "phase-production-build" &&
  process.env.NEXTCRM_ALLOW_NOAUTH_IN_PROD !== "true"
) {
  throw new Error(
    "[session] Refusing to boot: NEXTCRM_DISABLE_AUTH is enabled in production, " +
      "so authentication is disabled and every request resolves to an admin guest user. " +
      "Unset NEXTCRM_DISABLE_AUTH (or set it to \"false\"), or set NEXTCRM_ALLOW_NOAUTH_IN_PROD=true to override intentionally."
  );
}
const GUEST_USER_ID =
  process.env.NEXTCRM_GUEST_USER_ID || "00000000-0000-0000-0000-000000000001";
const GUEST_USER_EMAIL =
  process.env.NEXTCRM_GUEST_USER_EMAIL || "guest@nextcrm.local";
const GUEST_USER_NAME =
  process.env.NEXTCRM_GUEST_USER_NAME || "NextCRM Guest";
const RAW_GUEST_LANGUAGE = process.env.NEXTCRM_GUEST_USER_LANGUAGE || "id";
const FALLBACK_EXPIRY = new Date(
  Date.now() + 1000 * 60 * 60 * 24 * 365
).toISOString();
const VALID_LANGUAGES = new Set(["id", "en", "cz", "de", "uk"]);
const GUEST_USER_LANGUAGE = VALID_LANGUAGES.has(
  RAW_GUEST_LANGUAGE.toLowerCase()
)
  ? RAW_GUEST_LANGUAGE.toLowerCase()
  : "id";

type SessionUserLike = {
  id: string;
  email: string;
  name: string | null;
  avatar: string | null;
  phone: string | null;
  phoneNormalized: string | null;
  userLanguage: string;
  userStatus: string;
  is_admin: boolean;
  mektekRole: "CS" | "TECHNICIAN" | null;
};

function toSession(user: SessionUserLike): Session {
  return {
    expires: FALLBACK_EXPIRY,
    user: {
      id: user.id,
      _id: user.id,
      email: user.email,
      name: user.name ?? GUEST_USER_NAME,
      image: user.avatar ?? undefined,
      avatar: user.avatar ?? undefined,
      phone: user.phone,
      phoneNormalized: user.phoneNormalized,
      // No-auth fallback intentionally bypasses role/status checks only when
      // there is no real signed-in session.
      isAdmin: true,
      mektekRole: user.mektekRole,
      userLanguage: user.userLanguage || "id",
      userStatus: "ACTIVE",
    },
  } as Session;
}

function normalizeSession(session: Session): Session {
  const user = session.user || ({} as Session["user"]);

  return {
    ...session,
    expires: session.expires || FALLBACK_EXPIRY,
    user: {
      ...user,
      id: user.id || GUEST_USER_ID,
      _id: user._id || user.id || GUEST_USER_ID,
      email: user.email || GUEST_USER_EMAIL,
      name: user.name || GUEST_USER_NAME,
      image: user.image,
      avatar: user.avatar || user.image,
      phone: user.phone ?? null,
      phoneNormalized: user.phoneNormalized ?? null,
      isAdmin: !!user.isAdmin,
      mektekRole: user.mektekRole ?? null,
      userLanguage: user.userLanguage || GUEST_USER_LANGUAGE,
      userStatus: user.userStatus || "ACTIVE",
    },
  };
}

async function getFallbackUser(): Promise<SessionUserLike> {
  const activeUser = await prismadb.users.findFirst({
    where: {
      userStatus: "ACTIVE",
    },
    orderBy: [{ is_admin: "desc" }, { created_on: "asc" }],
    select: {
      id: true,
      email: true,
      name: true,
      avatar: true,
      phone: true,
      phoneNormalized: true,
      userLanguage: true,
      userStatus: true,
      is_admin: true,
      mektekRole: true,
    },
  });

  if (activeUser) {
    return {
      ...activeUser,
      userLanguage: String(activeUser.userLanguage),
      userStatus: String(activeUser.userStatus),
    };
  }

  const guestUser = await prismadb.users.upsert({
    where: {
      id: GUEST_USER_ID,
    },
    update: {
      name: GUEST_USER_NAME,
      is_admin: true,
      mektekRole: null,
      is_account_admin: true,
      userStatus: "ACTIVE",
      userLanguage: GUEST_USER_LANGUAGE as any,
      lastLoginAt: new Date(),
    },
    create: {
      id: GUEST_USER_ID,
      email: GUEST_USER_EMAIL,
      name: GUEST_USER_NAME,
      is_admin: true,
      mektekRole: null,
      is_account_admin: true,
      userStatus: "ACTIVE",
      userLanguage: GUEST_USER_LANGUAGE as any,
      lastLoginAt: new Date(),
    },
    select: {
      id: true,
      email: true,
      name: true,
      avatar: true,
      phone: true,
      phoneNormalized: true,
      userLanguage: true,
      userStatus: true,
      is_admin: true,
      mektekRole: true,
    },
  });

  return {
    ...guestUser,
    userLanguage: String(guestUser.userLanguage),
    userStatus: String(guestUser.userStatus),
  };
}

export function isAuthDisabled(): boolean {
  return NO_AUTH_ENABLED;
}

export async function getServerSession(
  options: NextAuthOptions = defaultAuthOptions
): Promise<Session | null> {
  const session = (await getNextAuthServerSession(options)) as Session | null;

  if (!NO_AUTH_ENABLED) {
    return session;
  }

  if (session?.user?.id) {
    return normalizeSession(session);
  }

  try {
    const fallbackUser = await getFallbackUser();
    return toSession(fallbackUser);
  } catch {
    return toSession({
      id: GUEST_USER_ID,
      email: GUEST_USER_EMAIL,
      name: GUEST_USER_NAME,
      avatar: null,
      phone: null,
      phoneNormalized: null,
      userLanguage: GUEST_USER_LANGUAGE,
      userStatus: "ACTIVE",
      is_admin: true,
      mektekRole: null,
    });
  }
}
