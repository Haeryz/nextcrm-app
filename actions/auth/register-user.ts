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
import { hashPassword } from "@/lib/password";
import { consumeAuthRateLimit } from "@/lib/auth-rate-limit";
import { hasTrustedMutationOrigin } from "@/lib/trusted-origin";

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
  password: string;
  confirmPassword: string;
  otpCode: string;
}) => {
  if (!(await hasTrustedMutationOrigin())) {
    return { error: "Request tidak dapat diverifikasi" };
  }

  const name = boundedText(data?.name, MAX_NAME_LEN);
  const phone = String(data?.phone ?? "").trim();
  const password = String(data?.password ?? "");
  const confirmPassword = String(data?.confirmPassword ?? "");
  const otpCode = String(data?.otpCode ?? "").trim();
  const phoneNormalized = normalizePhoneNumber(phone);

  if (!name || !phone || !password || !confirmPassword || !otpCode) {
    const missingFields = [];
    if (!name) missingFields.push("name");
    if (!phone) missingFields.push("phone");
    if (!password) missingFields.push("password");
    if (!confirmPassword) missingFields.push("confirmPassword");
    if (!otpCode) missingFields.push("otpCode");
    return { error: `Field wajib belum diisi: ${missingFields.join(", ")}` };
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
  if (!ipLimit.ok || !phoneLimit.ok) {
    return { error: "Terlalu banyak Request. Silakan coba lagi nanti." };
  }

  const email = buildPhoneAccountEmail(phoneNormalized);

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
      return { error: "Nomor telepon ini sudah memiliki Account" };
    }

    // Prove ownership of the phone before binding it to an account. Without this,
    // anyone could register with a victim's number and (via the profile flow) claim
    // the victim's existing walk-in customer record, tokens, and PII.
    const otpValid = await verifyOtpCode(phoneNormalized, otpCode);
    if (!otpValid) {
      return { error: "Kode verifikasi salah atau kedaluwarsa" };
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
