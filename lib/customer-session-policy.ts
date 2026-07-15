import crypto from "crypto";

export const CUSTOMER_SESSION_DEFAULT_ABSOLUTE_MS = 12 * 60 * 60 * 1000;
export const CUSTOMER_SESSION_DEFAULT_IDLE_MS = 2 * 60 * 60 * 1000;
export const CUSTOMER_SESSION_REMEMBERED_ABSOLUTE_MS =
  14 * 24 * 60 * 60 * 1000;
export const CUSTOMER_SESSION_REMEMBERED_IDLE_MS = 7 * 24 * 60 * 60 * 1000;
export const CUSTOMER_SESSION_TOUCH_INTERVAL_MS = 5 * 60 * 1000;
export const CUSTOMER_SESSION_PRODUCTION_COOKIE_NAME =
  "__Host-mektek_customer_session";
export const CUSTOMER_SESSION_DEVELOPMENT_COOKIE_NAME =
  "mektek_customer_session";

export type CustomerSessionPolicy = {
  absoluteExpiresAt: Date;
  idleExpiresAt: Date;
  cookieMaxAge?: number;
};

export function buildCustomerSessionPolicy(
  rememberDevice: boolean,
  now = new Date(),
): CustomerSessionPolicy {
  const absoluteMs = rememberDevice
    ? CUSTOMER_SESSION_REMEMBERED_ABSOLUTE_MS
    : CUSTOMER_SESSION_DEFAULT_ABSOLUTE_MS;
  const idleMs = rememberDevice
    ? CUSTOMER_SESSION_REMEMBERED_IDLE_MS
    : CUSTOMER_SESSION_DEFAULT_IDLE_MS;

  return {
    absoluteExpiresAt: new Date(now.getTime() + absoluteMs),
    idleExpiresAt: new Date(now.getTime() + idleMs),
    ...(rememberDevice ? { cookieMaxAge: Math.floor(absoluteMs / 1000) } : {}),
  };
}

export function buildCustomerSessionCookie(
  rememberDevice: boolean,
  production: boolean,
  now = new Date(),
) {
  const policy = buildCustomerSessionPolicy(rememberDevice, now);
  return {
    name: production
      ? CUSTOMER_SESSION_PRODUCTION_COOKIE_NAME
      : CUSTOMER_SESSION_DEVELOPMENT_COOKIE_NAME,
    options: {
      httpOnly: true,
      secure: production,
      sameSite: "lax" as const,
      path: "/",
      ...(policy.cookieMaxAge === undefined
        ? {}
        : {
            maxAge: policy.cookieMaxAge,
            expires: policy.absoluteExpiresAt,
          }),
    },
  };
}

export function getRefreshedIdleExpiry(
  rememberDevice: boolean,
  absoluteExpiresAt: Date,
  now = new Date(),
): Date {
  const idleMs = rememberDevice
    ? CUSTOMER_SESSION_REMEMBERED_IDLE_MS
    : CUSTOMER_SESSION_DEFAULT_IDLE_MS;

  return new Date(
    Math.min(now.getTime() + idleMs, absoluteExpiresAt.getTime()),
  );
}

export function hashCustomerSessionToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function isCustomerSessionExpired(
  session: {
    idleExpiresAt: Date;
    expiresAt: Date;
    revokedAt: Date | null;
  },
  now = new Date(),
): boolean {
  return (
    session.revokedAt !== null ||
    session.idleExpiresAt.getTime() <= now.getTime() ||
    session.expiresAt.getTime() <= now.getTime()
  );
}
