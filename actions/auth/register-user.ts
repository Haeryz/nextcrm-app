"use server";
import { headers } from "next/headers";
import { prismadb } from "@/lib/prisma";
import { newUserNotify } from "@/lib/new-user-notify";
import { Language } from "@prisma/client";
import { isValidPhoneNumber, normalizePhoneNumber } from "@/lib/phone";
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
import { setEmailPreferenceInternal } from "@/actions/email/preferences";

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
  email: string;
  emailOtpCode: string;
  password: string;
  confirmPassword: string;
  // OPTIONAL WhatsApp OTP. Signup itself is verified by EMAIL; this code is only
  // ever used to link a pre-existing walk-in CatalogCustomer record (and the
  // service history hanging off it) to the new account. Without a valid phone
  // OTP that record is left completely untouched and must be claimed later
  // through claimMektekCustomerByPhone, which is OTP-gated. See the transaction
  // below — that is the account-takeover boundary.
  otpCode?: string;
  marketingConsent?: boolean;
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
  const phoneOtpCode = String(data?.otpCode ?? "").trim();
  // Opt-in only. Anything other than a literal true (an unticked box, a missing
  // field, a truthy string from a hand-rolled client) counts as "no consent".
  const marketingConsent = data?.marketingConsent === true;
  const phoneNormalized = normalizePhoneNumber(phone);

  // EMAIL is the verification channel for signup. WhatsApp OTP proved unreliable
  // in production (unofficial Baileys client, 3-8s sends, the business number was
  // suspended), so the address must be present, valid, non-disposable, and own a
  // verified OTP code before an account is created. Mass-account-creation via
  // throwaway inboxes is blunted by the per-email signup throttle below.
  const emailNormalized = normalizeEmail(rawEmail);

  if (
    !name ||
    !phone ||
    !rawEmail ||
    !emailOtpCode ||
    !password ||
    !confirmPassword
  ) {
    const missingFields = [];
    if (!name) missingFields.push("name");
    if (!phone) missingFields.push("phone");
    if (!rawEmail) missingFields.push("email");
    if (!emailOtpCode) missingFields.push("emailOtpCode");
    if (!password) missingFields.push("password");
    if (!confirmPassword) missingFields.push("confirmPassword");
    return { error: `Field wajib belum diisi: ${missingFields.join(", ")}` };
  }

  if (!emailNormalized || !isValidEmail(rawEmail)) {
    return { error: "Email tidak valid" };
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
  try {
    await assertNotDisposable(emailNormalized);
  } catch (error) {
    if (error instanceof DisposableEmailError) {
      return { error: "Email dari domain ini tidak diizinkan" };
    }
    throw error;
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
  const emailSignupLimit = await consumeAuthRateLimit(
    `email-signup:email:${emailRecipientHash(emailNormalized)}`,
    3,
    24 * 60 * 60 * 1000
  );
  if (!ipLimit.ok || !phoneLimit.ok || !emailSignupLimit.ok) {
    return { error: "Terlalu banyak Request. Silakan coba lagi nanti." };
  }

  // The verified address is the account email. The @phone.nextcrm.local
  // placeholder (buildPhoneAccountEmail) is deliberately NOT used here any more:
  // signup now always carries a real, OTP-verified inbox. Staff-created walk-in
  // accounts still use it (actions/mektek/customers.ts) and existing rows keep it.
  const email = emailNormalized;

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

    // Prove ownership of the inbox before binding it to an account. This is the
    // signup verification gate: no valid email code, no account.
    const emailOtpValid = await verifyEmailOtpCode(
      emailNormalized,
      emailOtpCode
    );
    if (!emailOtpValid) {
      return {
        error:
          "Kode verifikasi email salah atau kedaluwarsa. Minta kode baru, lalu periksa kotak masuk dan folder spam/promosi.",
      };
    }

    // OPTIONAL second channel. A valid WhatsApp code proves the person also
    // controls the phone number, which is the ONLY thing that allows an existing
    // walk-in customer record to be linked below. A wrong code is a hard error
    // rather than a silent downgrade, so a mistyped code never quietly skips the
    // link the customer was expecting.
    let phoneVerified = false;
    if (phoneOtpCode) {
      phoneVerified = await verifyOtpCode(phoneNormalized, phoneOtpCode);
      if (!phoneVerified) {
        return { error: "Kode verifikasi WhatsApp salah atau kedaluwarsa" };
      }
    }

    // Hash before opening the transaction. The KDF is 100-500ms of pure CPU and
    // depends on nothing inside it, so running it there pinned a pooled connection
    // and held the transaction open for the whole duration.
    const passwordHash = await hashPassword(password);

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
          password: passwordHash,
        },
      });

      // ACCOUNT-TAKEOVER BOUNDARY. Signup is verified by email, which proves
      // nothing about the phone number typed into the form. An existing
      // CatalogCustomer row for that phone is a walk-in customer's record with
      // real service history attached, so it is NEVER linked to (or overwritten
      // by) an account that has not proved phone ownership. Without a phone OTP
      // the row is left exactly as it was and the customer links it later from
      // their profile via claimMektekCustomerByPhone, which requires the OTP.
      const existingCustomer = await tx.catalogCustomer.findUnique({
        where: { phoneNormalized },
        select: { id: true, userId: true },
      });

      if (!existingCustomer) {
        await tx.catalogCustomer.create({
          data: {
            username: name,
            phone,
            phoneNormalized,
            customerType: "STANDARD",
            userId: createdUser.id,
          },
        });
      } else if (phoneVerified && existingCustomer.userId === null) {
        // Phone ownership proven and the record is unclaimed — same conditions
        // claimMektekCustomerByPhone enforces, so linking here is equivalent.
        // customerType is left alone: it is a staff-assigned tier.
        await tx.catalogCustomer.update({
          where: { id: existingCustomer.id },
          data: { username: name, phone, userId: createdUser.id },
        });
      }

      return createdUser;
    });

    // Marketing consent is recorded ONLY when the customer explicitly ticked the
    // box. The address is always real and OTP-verified at this point. Absence of
    // a UserEmailPreference row already means "not opted in", so declining
    // simply writes nothing.
    if (marketingConsent) {
      const consent = await setEmailPreferenceInternal(user.id, {
        marketing: true,
        offers: true,
      });
      if (consent.error) {
        // Never fail the registration over the preference row — the account
        // exists and the customer can opt in later from the preferences page.
        console.error("[REGISTER_CUSTOMER_USER_CONSENT]", consent.error);
      }
    }

    // Never return the full users row — it carries the bcrypt password hash and
    // internal flags, and server-action return values are serialized to the browser.
    return { data: { id: user.id, email: user.email, name: user.name } };
  } catch (error) {
    console.error("[REGISTER_CUSTOMER_USER]", error);
    const errorMessage = error instanceof Error ? error.message : "Error tidak diketahui";
    return { error: `Registrasi Customer gagal: ${errorMessage}` };
  }
};
