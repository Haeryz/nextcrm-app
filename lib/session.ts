import { cache } from "react";
import { authOptions as defaultAuthOptions } from "@/lib/auth";
import { prismadb } from "@/lib/prisma";
import { getServerSession as getNextAuthServerSession } from "next-auth";
import type { NextAuthOptions, Session } from "next-auth";
import type { StaffDivision } from "@/lib/auth/staff-divisions";
import type { LogisticsStaffArea } from "@/lib/auth/logistics-staff-areas";
import type { StaffCapability } from "@/lib/auth/staff-capabilities";

// No-auth mode is opt-in for local development only. In production it would
// resolve every unauthenticated request to an admin guest user, opening the
// entire admin surface without login. Hard-disable it in production regardless
// of the env var, so a misconfigured deployment (e.g. NEXTCRM_DISABLE_AUTH=true
// left in the Vercel dashboard) can never bypass authentication. The escape
// hatch NEXTCRM_ALLOW_NOAUTH_IN_PROD is intentionally ignored in production.
const NO_AUTH_ENABLED =
  process.env.NEXTCRM_DISABLE_AUTH === "true" &&
  process.env.NODE_ENV !== "production";

const GUEST_USER_ID =
  process.env.NEXTCRM_GUEST_USER_ID || "00000000-0000-0000-0000-000000000001";
const GUEST_USER_EMAIL =
  process.env.NEXTCRM_GUEST_USER_EMAIL || "guest@nextcrm.local";
const GUEST_USER_NAME =
  process.env.NEXTCRM_GUEST_USER_NAME || "MektekCRM Guest";
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
  staffDivision: StaffDivision | null;
  logisticsStaffArea: LogisticsStaffArea | null;
  staffCapabilities: StaffCapability[];
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
      staffDivision: user.staffDivision,
      logisticsStaffArea: user.logisticsStaffArea,
      staffCapabilities: user.staffCapabilities ?? [],
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
      staffDivision: user.staffDivision ?? null,
      logisticsStaffArea: user.logisticsStaffArea ?? null,
      staffCapabilities: user.staffCapabilities ?? [],
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
      staffDivision: true,
      logisticsStaffArea: true,
      staffCapabilities: true,
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
      staffDivision: null,
      logisticsStaffArea: null,
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
      staffDivision: null,
      logisticsStaffArea: null,
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
      staffDivision: true,
      logisticsStaffArea: true,
      staffCapabilities: true,
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

// Memoized per request. Resolving a session runs the NextAuth `session` callback,
// which does a `users.findUnique` (and periodically a `lastLoginAt` update) on every
// call — and a single authenticated navigation resolves the session 3-4 times across
// the layout, the page and each server action it invokes.
//
// React `cache()` is scoped to one request, so nothing is ever shared between users.
// Do NOT substitute `unstable_cache`/`revalidate` here: this is per-user auth state.
const getCachedServerSession = cache(
  async (options: NextAuthOptions): Promise<Session | null> => {
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
        staffDivision: null,
        logisticsStaffArea: null,
        staffCapabilities: [],
      });
    }
  }
);

// Thin wrapper so that both `getServerSession()` and `getServerSession(authOptions)`
// resolve to the same `cache()` key — `cache` keys on the arguments it receives, and
// `authOptions` is the very object re-exported here as `defaultAuthOptions`.
export async function getServerSession(
  options: NextAuthOptions = defaultAuthOptions
): Promise<Session | null> {
  return getCachedServerSession(options);
}
