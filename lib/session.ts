import { authOptions as defaultAuthOptions } from "@/lib/auth";
import { prismadb } from "@/lib/prisma";
import { getServerSession as getNextAuthServerSession } from "next-auth";
import type { NextAuthOptions, Session } from "next-auth";

const NO_AUTH_ENABLED = process.env.NEXTCRM_DISABLE_AUTH !== "false";
const GUEST_USER_ID =
  process.env.NEXTCRM_GUEST_USER_ID || "00000000-0000-0000-0000-000000000001";
const GUEST_USER_EMAIL =
  process.env.NEXTCRM_GUEST_USER_EMAIL || "guest@nextcrm.local";
const GUEST_USER_NAME =
  process.env.NEXTCRM_GUEST_USER_NAME || "NextCRM Guest";
const RAW_GUEST_LANGUAGE = process.env.NEXTCRM_GUEST_USER_LANGUAGE || "en";
const FALLBACK_EXPIRY = new Date(
  Date.now() + 1000 * 60 * 60 * 24 * 365
).toISOString();
const VALID_LANGUAGES = new Set(["en", "cz", "de", "uk"]);
const GUEST_USER_LANGUAGE = VALID_LANGUAGES.has(
  RAW_GUEST_LANGUAGE.toLowerCase()
)
  ? RAW_GUEST_LANGUAGE.toLowerCase()
  : "en";

type SessionUserLike = {
  id: string;
  email: string;
  name: string | null;
  avatar: string | null;
  userLanguage: string;
  userStatus: string;
  is_admin: boolean;
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
      // No-auth mode intentionally bypasses role/status checks.
      isAdmin: true,
      userLanguage: user.userLanguage || "en",
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
      isAdmin: true,
      userLanguage: user.userLanguage || GUEST_USER_LANGUAGE,
      userStatus: "ACTIVE",
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
      userLanguage: true,
      userStatus: true,
      is_admin: true,
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
      userLanguage: true,
      userStatus: true,
      is_admin: true,
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
      userLanguage: GUEST_USER_LANGUAGE,
      userStatus: "ACTIVE",
      is_admin: true,
    });
  }
}