"use server";

import { headers } from "next/headers";
import { getClientIp } from "@/lib/rate-limit";
import { areExternalApisDisabled } from "@/lib/external-apis";
import { issueEmailOtpCode } from "@/lib/email-otp";
import { consumeAuthRateLimit } from "@/lib/auth-rate-limit";
import { hasTrustedMutationOrigin } from "@/lib/trusted-origin";
import { reserveEmailOtpSend } from "@/lib/email/otp-send-guard";
import {
  normalizeEmail,
  isValidEmail,
  emailRecipientHash,
} from "@/lib/email/validation";
import { assertNotDisposable, DisposableEmailError } from "@/lib/email/disposable-domains";
import { sendTransactionalEmail } from "@/lib/email";
import { EmailOtp } from "@/emails/EmailOtp";
import { APP_NAME } from "@/lib/brand";

// OTP requests write a DB row + trigger an email send. Throttle hard by both IP
// and email so it can't be used to spam a victim's inbox or flood the table.
const OTP_IP_LIMIT = 5;
const OTP_EMAIL_LIMIT = 3;
const OTP_WINDOW_MS = 15 * 60 * 1000;

type OtpActionResult = { success?: true; error?: string };

// Generic success message — never reveal whether an email already has an account.
const GENERIC_OK: OtpActionResult = { success: true };

export async function requestCustomerEmailOtp(
  rawEmail: string
): Promise<OtpActionResult> {
  if (!(await hasTrustedMutationOrigin())) {
    return { error: "Request tidak dapat diverifikasi" };
  }

  const email = String(rawEmail ?? "").trim();
  if (!email || !isValidEmail(email)) {
    return { error: "Email tidak valid" };
  }
  const emailNormalized = normalizeEmail(email);
  if (!emailNormalized) {
    return { error: "Email tidak valid" };
  }

  // Block disposable/temp domains. Generic error — never reveal which domains
  // are blocked, otherwise attackers just rotate to unblocked providers.
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
    `email-otp:ip:${ip}`,
    OTP_IP_LIMIT,
    OTP_WINDOW_MS
  );
  const emailLimit = await consumeAuthRateLimit(
    `email-otp:email:${emailRecipientHash(emailNormalized)}`,
    OTP_EMAIL_LIMIT,
    OTP_WINDOW_MS
  );
  if (!ipLimit.ok || !emailLimit.ok) {
    return { error: "Terlalu banyak permintaan. Coba lagi nanti." };
  }

  // IP/email limits stop individual abuse. This sender-wide reservation also
  // protects the Resend account from distributed bursts across many IPs and
  // email addresses. It is shared and atomic across serverless instances.
  const senderCapacity = await reserveEmailOtpSend();
  if (!senderCapacity.ok) {
    return { error: "Pengiriman email sedang padat. Coba lagi sebentar." };
  }

  const code = await issueEmailOtpCode(emailNormalized);
  const subject = `Kode Verifikasi dari ${APP_NAME}`;

  // External API gate. If Resend can't send, we FAIL CLOSED in production
  // (never skip verification). In dev/prototype we log the code so the local
  // flow stays testable without a configured Resend key.
  const externalDisabled = areExternalApisDisabled();

  if (externalDisabled) {
    if (process.env.NODE_ENV !== "production") {
      console.log(
        `[email-otp] External APIs disabled; dev OTP for ${emailNormalized}: ${code}`
      );
      return GENERIC_OK;
    }
    return {
      error:
        "Verifikasi email sedang tidak tersedia. Silakan coba lagi nanti atau hubungi kami.",
    };
  }

  // A misconfigured sender (e.g. RESEND_FROM_EMAIL unset) makes
  // sendTransactionalEmail throw rather than return, so the call is wrapped:
  // an unhandled rejection would surface as an opaque client error instead of
  // an actionable Bahasa message, and must still fail closed in production.
  let result: { ok: boolean; error?: string };
  try {
    result = await sendTransactionalEmail({
      to: emailNormalized,
      subject,
      react: EmailOtp({
        code,
        email: emailNormalized,
        userLanguage: "id",
      }),
      purpose: "otp",
      // APP_NAME, not the bare env var: NEXT_PUBLIC_APP_NAME has no default, so an
      // unset var rendered this as "Kode verifikasi undefined Anda".
      text: `Kode verifikasi ${APP_NAME} Anda: ${code}. Berlaku 5 menit. Jangan bagikan kode ini kepada siapa pun.`,
    });
  } catch (error) {
    console.error("[EMAIL_OTP_SEND]", error);
    result = {
      ok: false,
      error: error instanceof Error ? error.message : "Send failed",
    };
  }

  if (!result.ok) {
    if (process.env.NODE_ENV !== "production") {
      console.log(
        `[email-otp] Send failed (${result.error}); dev OTP for ${emailNormalized}: ${code}`
      );
      return GENERIC_OK;
    }
    return {
      error:
        "Gagal mengirim kode verifikasi. Coba lagi beberapa saat lagi, dan pastikan alamat email Anda benar.",
    };
  }

  return GENERIC_OK;
}
