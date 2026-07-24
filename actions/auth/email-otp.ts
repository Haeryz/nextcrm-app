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
  const subject = `Kode Verifikasi dari ${process.env.NEXT_PUBLIC_APP_NAME}`;

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
    return { error: "Verifikasi email sedang tidak tersedia" };
  }

  const result = await sendTransactionalEmail({
    to: emailNormalized,
    subject,
    react: EmailOtp({
      code,
      email: emailNormalized,
      userLanguage: "id",
    }),
    purpose: "otp",
    text: `Kode verifikasi ${process.env.NEXT_PUBLIC_APP_NAME} Anda: ${code}. Berlaku 5 menit. Jangan bagikan kode ini kepada siapa pun.`,
  });

  if (!result.ok) {
    if (process.env.NODE_ENV !== "production") {
      console.log(
        `[email-otp] Send failed (${result.error}); dev OTP for ${emailNormalized}: ${code}`
      );
      return GENERIC_OK;
    }
    return { error: "Gagal mengirim kode verifikasi. Coba lagi nanti." };
  }

  return GENERIC_OK;
}
