"use server";

import { headers } from "next/headers";

import { consumeAuthRateLimit } from "@/lib/auth-rate-limit";
import {
  createCustomerSession,
  revokeCurrentCustomerSession,
} from "@/lib/customer-session";
import { getSafeCustomerReturnPath } from "@/lib/customer-return-path";
import { hashPassword, verifyPassword } from "@/lib/password";
import { normalizePhoneNumber } from "@/lib/phone";
import { prismadb } from "@/lib/prisma";
import { getClientIp } from "@/lib/rate-limit";
import { hasTrustedMutationOrigin } from "@/lib/trusted-origin";

const LOGIN_LIMIT = 10;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const IP_LOGIN_LIMIT = 30;
const GENERIC_LOGIN_ERROR = "Nomor telepon atau Password tidak valid.";
const DUMMY_PASSWORD_HASH =
  "$2b$12$yN9.V3124cVB69Brg/uOMeXaQn3Lpi1C9CdVHxnprIsbiEc9l5pXO";

export type CustomerLoginInput = {
  phone?: string;
  password?: string;
  rememberDevice?: boolean;
  returnTo?: string;
  locale?: string;
};

export async function loginCustomer(input: CustomerLoginInput) {
  if (!(await hasTrustedMutationOrigin())) {
    return { error: "Request tidak dapat diverifikasi." };
  }

  const phone = String(input?.phone ?? "").trim().slice(0, 64);
  const password = String(input?.password ?? "");
  const phoneNormalized = normalizePhoneNumber(phone);
  const requestHeaders = await headers();
  const clientIp = getClientIp(requestHeaders);
  const rateLimitKey = phoneNormalized || phone.toLowerCase() || "missing";
  const [accountLimit, ipLimit] = await Promise.all([
    consumeAuthRateLimit(
      `customer-login:account:${rateLimitKey}`,
      LOGIN_LIMIT,
      LOGIN_WINDOW_MS,
    ),
    consumeAuthRateLimit(
      `customer-login:ip:${clientIp}`,
      IP_LOGIN_LIMIT,
      LOGIN_WINDOW_MS,
    ),
  ]);

  if (!accountLimit.ok || !ipLimit.ok) {
    return { error: "Terlalu banyak percobaan Login. Silakan coba lagi nanti." };
  }

  const user = phone
    ? await prismadb.users.findFirst({
        where: {
          OR: [{ phoneNormalized }, { phone }],
        },
        select: {
          id: true,
          password: true,
          is_admin: true,
          mektekRole: true,
          userStatus: true,
          customerProfile: { select: { id: true } },
        },
      })
    : null;

  // Always perform a slow password verification, even for an unknown account, so
  // response timing does not become a useful phone-number enumeration signal.
  const verification = await verifyPassword(
    password.slice(0, 200),
    user?.password || DUMMY_PASSWORD_HASH,
  );
  const eligible = Boolean(
    user &&
      user.password &&
      verification.valid &&
      user.userStatus === "ACTIVE" &&
      !user.is_admin &&
      user.mektekRole === null &&
      user.customerProfile,
  );

  if (!eligible || !user) return { error: GENERIC_LOGIN_ERROR };

  await prismadb.users.update({
    where: { id: user.id },
    data: {
      lastLoginAt: new Date(),
      ...(verification.needsRehash
        ? { password: await hashPassword(password.slice(0, 200)) }
        : {}),
    },
  });

  await createCustomerSession(user.id, {
    rememberDevice: input.rememberDevice === true,
  });

  const locale = String(input.locale || "id");
  return {
    success: true as const,
    redirectTo: getSafeCustomerReturnPath(input.returnTo, locale),
  };
}

export async function logoutCustomer() {
  if (!(await hasTrustedMutationOrigin())) {
    return { error: "Request tidak dapat diverifikasi." };
  }
  await revokeCurrentCustomerSession();
  return { success: true as const };
}
