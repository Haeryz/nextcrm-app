import "server-only";

import crypto from "crypto";
import { cookies, headers } from "next/headers";
import type { Session } from "next-auth";

import { prismadb } from "@/lib/prisma";
import { getClientIp } from "@/lib/rate-limit";
import {
  buildCustomerSessionPolicy,
  buildCustomerSessionCookie,
  CUSTOMER_SESSION_DEVELOPMENT_COOKIE_NAME,
  CUSTOMER_SESSION_PRODUCTION_COOKIE_NAME,
  CUSTOMER_SESSION_TOUCH_INTERVAL_MS,
  getRefreshedIdleExpiry,
  hashCustomerSessionToken,
  isCustomerSessionExpired,
} from "@/lib/customer-session-policy";

export function getCustomerSessionCookieName(): string {
  return buildCustomerSessionCookie(
    false,
    process.env.NODE_ENV === "production",
  ).name;
}

function candidateCookieNames(): string[] {
  return [
    CUSTOMER_SESSION_PRODUCTION_COOKIE_NAME,
    CUSTOMER_SESSION_DEVELOPMENT_COOKIE_NAME,
  ];
}

async function getRawCustomerSessionToken(): Promise<string | null> {
  const cookieStore = await cookies();
  for (const name of candidateCookieNames()) {
    const token = cookieStore.get(name)?.value;
    if (token) return token;
  }
  return null;
}

async function revokeRawToken(token: string, now = new Date()): Promise<void> {
  if (!token || token.length > 512) return;
  await prismadb.customerSession.updateMany({
    where: {
      tokenHash: hashCustomerSessionToken(token),
      revokedAt: null,
    },
    data: { revokedAt: now },
  });
}

async function clearCustomerSessionCookies(): Promise<void> {
  const cookieStore = await cookies();
  for (const name of candidateCookieNames()) {
    cookieStore.set(name, "", {
      httpOnly: true,
      secure: name.startsWith("__Host-") || process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: new Date(0),
      maxAge: 0,
    });
  }
}

export async function createCustomerSession(
  userId: string,
  options: { rememberDevice?: boolean } = {},
): Promise<void> {
  const rememberDevice = options.rememberDevice === true;
  const now = new Date();
  const policy = buildCustomerSessionPolicy(rememberDevice, now);
  const cookie = buildCustomerSessionCookie(
    rememberDevice,
    process.env.NODE_ENV === "production",
    now,
  );
  const rawToken = crypto.randomBytes(32).toString("base64url");
  const tokenHash = hashCustomerSessionToken(rawToken);
  const requestHeaders = await headers();
  const userAgent = requestHeaders.get("user-agent")?.slice(0, 512) || null;
  const ipAddress = getClientIp(requestHeaders).slice(0, 64);

  // A fresh random token on every login prevents session fixation. Revoke only the
  // current browser's previous token so remembered sessions on other devices remain.
  const previousToken = await getRawCustomerSessionToken();
  if (previousToken) await revokeRawToken(previousToken, now);

  await prismadb.$transaction([
    prismadb.customerSession.deleteMany({
      where: {
        userId,
        OR: [
          { expiresAt: { lte: now } },
          { idleExpiresAt: { lte: now } },
          { revokedAt: { not: null } },
        ],
      },
    }),
    prismadb.customerSession.create({
      data: {
        tokenHash,
        userId,
        rememberDevice,
        userAgent,
        ipAddress,
        lastUsedAt: now,
        idleExpiresAt: policy.idleExpiresAt,
        expiresAt: policy.absoluteExpiresAt,
      },
    }),
  ]);

  const cookieStore = await cookies();
  cookieStore.set(cookie.name, rawToken, cookie.options);
}

export async function getCustomerServerSession(): Promise<Session | null> {
  const rawToken = await getRawCustomerSessionToken();
  if (!rawToken || rawToken.length > 512) return null;

  const record = await prismadb.customerSession.findUnique({
    where: { tokenHash: hashCustomerSessionToken(rawToken) },
    include: {
      user: {
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
          customerProfile: { select: { id: true } },
        },
      },
    },
  });

  const now = new Date();
  if (!record || isCustomerSessionExpired(record, now)) return null;

  if (
    record.user.userStatus !== "ACTIVE" ||
    record.user.is_admin ||
    record.user.mektekRole !== null ||
    !!record.user.staffDivision ||
    !record.user.customerProfile
  ) {
    await prismadb.customerSession.updateMany({
      where: { id: record.id, revokedAt: null },
      data: { revokedAt: now },
    });
    return null;
  }

  if (
    now.getTime() - record.lastUsedAt.getTime() >=
    CUSTOMER_SESSION_TOUCH_INTERVAL_MS
  ) {
    await prismadb.customerSession.updateMany({
      where: { id: record.id, revokedAt: null },
      data: {
        lastUsedAt: now,
        idleExpiresAt: getRefreshedIdleExpiry(
          record.rememberDevice,
          record.expiresAt,
          now,
        ),
      },
    });
  }

  return {
    expires: record.expiresAt.toISOString(),
    user: {
      id: record.user.id,
      _id: record.user.id,
      email: record.user.email,
      name: record.user.name,
      image: record.user.avatar ?? undefined,
      avatar: record.user.avatar,
      phone: record.user.phone,
      phoneNormalized: record.user.phoneNormalized,
      isAdmin: false,
      mektekRole: null,
      staffDivision: null,
      userLanguage: String(record.user.userLanguage),
      userStatus: String(record.user.userStatus),
    },
  };
}

export async function revokeCurrentCustomerSession(): Promise<void> {
  const rawToken = await getRawCustomerSessionToken();
  if (rawToken) await revokeRawToken(rawToken);
  await clearCustomerSessionCookies();
}

export async function revokeAllCustomerSessions(userId: string): Promise<void> {
  await prismadb.customerSession.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
