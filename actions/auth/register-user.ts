"use server";
import { headers } from "next/headers";
import { prismadb } from "@/lib/prisma";
import { newUserNotify } from "@/lib/new-user-notify";
import { Language } from "@prisma/client";
import {
  buildPhoneAccountEmail,
  isValidPhoneNumber,
  normalizePhoneNumber,
} from "@/lib/phone";
import { boundedText, MAX_NAME_LEN } from "@/lib/mektek/sanitize";
import { getClientIp } from "@/lib/rate-limit";
import { verifyOtpCode } from "@/lib/otp";
import { verifyEmailOtpCode } from "@/lib/email-otp";
import { hashPassword } from "@/lib/password";
import { consumeAuthRateLimit } from "@/lib/auth-rate-limit";
import { hasTrustedMutationOrigin } from "@/lib/trusted-origin";
import {
  isValidEmail,
  normalizeEmail,
  emailRecipientHash,
} from "@/lib/email/validation";
import {
  assertNotDisposable,
  DisposableEmailError,
} from "@/lib/email/disposable-domains";

// Public registration writes a users row (+ bcrypt hash) per call. Throttle by IP
// to blunt scripted account-creation floods.
const REGISTER_LIMIT = 5;
const REGISTER_WINDOW_MS = 15 * 60 * 1000;

export const registerUser = async (data: {
  name: string;
  username: string;
  email: string;
  language: string;
  password: string;
  confirmPassword: string;
}) => {
  if (!(await hasTrustedMutationOrigin())) {
    return { error: "Request tidak dapat diverifikasi" };
  }

  const { name, username, email, language, password, confirmPassword } = data;

  if (!name || !email || !language || !password || !confirmPassword) {
    const missingFields = [];
    if (!name) missingFields.push("name");
    if (!email) missingFields.push("email");
    if (!language) missingFields.push("language");
    if (!password) missingFields.push("password");
    if (!confirmPassword) missingFields.push("confirmPassword");
    return { error: `Field wajib belum diisi: ${missingFields.join(", ")}` };
  }

  if (password.length < 8) {
    return { error: "Password minimal 8 karakter" };
  }
  if (password.length > 100) {
    return { error: "Password terlalu panjang" };
  }

  if (password !== confirmPassword) {
    return { error: "Password tidak sama" };
  }

  const ip = getClientIp(await headers());
  if (
    !(
      await consumeAuthRateLimit(
        `register-user:${ip}`,
        REGISTER_LIMIT,
        REGISTER_WINDOW_MS,
      )
    ).ok
  ) {
    return { error: "Terlalu banyak Request. Silakan coba lagi nanti." };
  }

  const checkexisting = await prismadb.users.findFirst({
    where: { email },
  });

  if (checkexisting) {
    return { error: "User sudah tersedia" };
  }

  try {
    const user = await prismadb.users.create({
      data: {
        name,
        username,
        avatar: "",
        account_name: "",
        is_account_admin: false,
        is_admin: false,
        email,
        userLanguage: language as Language,
        userStatus:
          process.env.NEXT_PUBLIC_APP_URL === "https://demo.nextcrm.io"
            ? "ACTIVE"
            : "PENDING",
        password: await hashPassword(password),
      },
    });

    // Notify admins about the new pending user. Admins are bootstrapped
    // through the backend script, never through public registration.
    newUserNotify(user);

    // Never return the full users row — it carries the bcrypt password hash and
    // internal flags, and server-action return values are serialized to the browser.
    return { data: { id: user.id, email: user.email, name: user.name } };
  } catch (error) {
    console.error("[REGISTER_USER]", error);
    const errorMessage = error instanceof Error ? error.message : "Error tidak diketahui";
    return { error: `Registrasi gagal: ${errorMessage}` };
  }
};

export const registerCustomerUser = async (data: {
  name: string;
  phone: string;
  email?: string;
  emailOtpCode?: string;
  password: string;
  confirmPassword: string;
  otpCode: string;
}) => {
  if (!(await hasTrustedMutationOrigin())) {
    return { error: "Request tidak dapat diverifikasi" };
  }

  const name = boundedText(data?.name, MAX_NAME_LEN);
  const phone = String(data?.phone ?? "").trim();
  const rawEmail = String(data?.email ?? "").trim();
  const emailOtpCode = String(data?.emailOtpCode ?? "").trim();
  const password = String(data?.password ?? "");
  const confirmPassword = String(data?.confirmPassword ?? "");
  const otpCode = String(data?.otpCode ?? "").trim();
  const phoneNormalized = normalizePhoneNumber(phone);

  // Whichever channel is provided must be verified. Phone is still required
  // in v1 (the storefront signup form collects it); email is optional. When
  // email is provided, it must be valid, non-disposable, and own a verified
  // OTP code. Mass-account-creation via throwaway emails is blunted by the
  // per-email signup throttle below.
  const emailProvided = rawEmail.length > 0;
  const emailNormalized = emailProvided ? normalizeEmail(rawEmail) : null;

  if (!name || !phone || !password || !confirmPassword || !otpCode) {
    const missingFields = [];
    if (!name) missingFields.push("name");
    if (!phone) missingFields.push("phone");
    if (!password) missingFields.push("password");
    if (!confirmPassword) missingFields.push("confirmPassword");
    if (!otpCode) missingFields.push("otpCode");
    return { error: `Field wajib belum diisi: ${missingFields.join(", ")}` };
  }

  if (emailProvided && (!emailNormalized || !isValidEmail(rawEmail))) {
    return { error: "Email tidak valid" };
  }

  if (emailProvided && !emailOtpCode) {
    return { error: "Field wajib belum diisi: emailOtpCode" };
  }

  if (!isValidPhoneNumber(phone)) {
    return { error: "Nomor telepon tidak valid" };
  }

  if (password.length < 8) {
    return { error: "Password minimal 8 karakter" };
  }
  if (password.length > 100) {
    return { error: "Password terlalu panjang" };
  }

  if (password !== confirmPassword) {
    return { error: "Password tidak sama" };
  }

  // Block disposable/temp domains on signup. Generic error — never reveal
  // which domains are blocked.
  if (emailProvided && emailNormalized) {
    try {
      await assertNotDisposable(emailNormalized);
    } catch (error) {
      if (error instanceof DisposableEmailError) {
        return { error: "Email dari domain ini tidak diizinkan" };
      }
      throw error;
    }
  }

  const ip = getClientIp(await headers());
  const ipLimit = await consumeAuthRateLimit(
    `register-customer:ip:${ip}`,
    REGISTER_LIMIT,
    REGISTER_WINDOW_MS
  );
  const phoneLimit = await consumeAuthRateLimit(
    `register-customer:phone:${phoneNormalized}`,
    REGISTER_LIMIT,
    REGISTER_WINDOW_MS
  );
  // 3 signups per email per 24h — a mass-account-creation throttle layered on
  // top of the existing per-IP 5/15min cap. Defeats scripted registration
  // farms that rotate IPs but reuse a single burner email.
  const emailSignupLimit =
    emailProvided && emailNormalized
      ? await consumeAuthRateLimit(
          `email-signup:email:${emailRecipientHash(emailNormalized)}`,
          3,
          24 * 60 * 60 * 1000
        )
      : { ok: true };
  if (!ipLimit.ok || !phoneLimit.ok || !emailSignupLimit.ok) {
    return { error: "Terlalu banyak Request. Silakan coba lagi nanti." };
  }

  // If the user only gave a phone, synthesize an internal email so the unique
  // constraint on Users.email is satisfied and the account is reachable for
  // transactional system notifications only (never marketing/offers — those
  // are gated by UserEmailPreference, which defaults to opted-out).
  const email = emailNormalized ?? buildPhoneAccountEmail(phoneNormalized);

  try {
    const existingUser = await prismadb.users.findFirst({
      where: {
        OR: [{ phoneNormalized }, { email }],
      },
      select: {
        id: true,
      },
    });

    if (existingUser) {
      return { error: "Nomor telepon atau email ini sudah memiliki Account" };
    }

    // Prove ownership of the phone before binding it to an account. Without this,
    // anyone could register with a victim's number and (via the profile flow) claim
    // the victim's existing walk-in customer record, tokens, and PII.
    const phoneOtpValid = await verifyOtpCode(phoneNormalized, otpCode);
    if (!phoneOtpValid) {
      return { error: "Kode verifikasi salah atau kedaluwarsa" };
    }

    // Per the "whichever channel is provided" decision: if the user supplied
    // an email, prove ownership of that inbox too before binding it.
    if (emailProvided && emailNormalized) {
      const emailOtpValid = await verifyEmailOtpCode(
        emailNormalized,
        emailOtpCode
      );
      if (!emailOtpValid) {
        return { error: "Kode verifikasi email salah atau kedaluwarsa" };
      }
    }

    const user = await prismadb.$transaction(async (tx) => {
      const createdUser = await tx.users.create({
        data: {
          name,
          username: name,
          avatar: "",
          account_name: "Mektek Customer",
          is_account_admin: false,
          is_admin: false,
          email,
          phone,
          phoneNormalized,
          userLanguage: "id",
          userStatus: "ACTIVE",
          password: await hashPassword(password),
        },
      });

      await tx.catalogCustomer.upsert({
        where: {
          phoneNormalized,
        },
        update: {
          username: name,
          phone,
          customerType: "STANDARD",
          userId: createdUser.id,
        },
        create: {
          username: name,
          phone,
          phoneNormalized,
          customerType: "STANDARD",
          userId: createdUser.id,
        },
      });

      return createdUser;
    });

    // Never return the full users row — it carries the bcrypt password hash and
    // internal flags, and server-action return values are serialized to the browser.
    return { data: { id: user.id, email: user.email, name: user.name } };
  } catch (error) {
    console.error("[REGISTER_CUSTOMER_USER]", error);
    const errorMessage = error instanceof Error ? error.message : "Error tidak diketahui";
    return { error: `Registrasi Customer gagal: ${errorMessage}` };
  }
};
