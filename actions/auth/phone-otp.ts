"use server";

import { headers } from "next/headers";
import { isValidPhoneNumber, normalizePhoneNumber } from "@/lib/phone";
import { getClientIp } from "@/lib/rate-limit";
import { areExternalApisDisabled } from "@/lib/external-apis";
import { getWhatsAppState } from "@/lib/whatsapp";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { issueOtpCode } from "@/lib/otp";
import { consumeAuthRateLimit } from "@/lib/auth-rate-limit";
import { hasTrustedMutationOrigin } from "@/lib/trusted-origin";
import { reserveWhatsAppOtpSend } from "@/lib/whatsapp/otp-send-guard";

// Phone (WhatsApp) OTP. Signup verification moved to EMAIL (see
// actions/auth/email-otp.ts) because the WhatsApp channel proved unreliable.
// This code path is still REQUIRED and must not be removed: proving control of a
// phone number is what gates claimMektekCustomerByPhone, which links an existing
// walk-in customer record — and its whole service history — to an account.
// Without it, anyone could type a stranger's number and claim their history.
//
// OTP requests write a DB row + trigger a WhatsApp send. Throttle hard by both IP
// and phone so it can't be used to spam a victim's number or flood the table.
const OTP_IP_LIMIT = 5;
const OTP_PHONE_LIMIT = 3;
const OTP_WINDOW_MS = 15 * 60 * 1000;

type OtpActionResult = { success?: true; error?: string };

// Generic success message — never reveal whether a phone already has an account.
const GENERIC_OK: OtpActionResult = { success: true };

export async function requestCustomerPhoneOtp(
  rawPhone: string
): Promise<OtpActionResult> {
  if (!(await hasTrustedMutationOrigin())) {
    return { error: "Request tidak dapat diverifikasi" };
  }

  const phone = String(rawPhone ?? "").trim();
  if (!phone || !isValidPhoneNumber(phone)) {
    return { error: "Nomor telepon tidak valid" };
  }
  const phoneNormalized = normalizePhoneNumber(phone);
  if (!phoneNormalized) {
    return { error: "Nomor telepon tidak valid" };
  }

  const ip = getClientIp(await headers());
  const ipLimit = await consumeAuthRateLimit(
    `otp:ip:${ip}`,
    OTP_IP_LIMIT,
    OTP_WINDOW_MS,
  );
  const phoneLimit = await consumeAuthRateLimit(
    `otp:phone:${phoneNormalized}`,
    OTP_PHONE_LIMIT,
    OTP_WINDOW_MS
  );
  if (!ipLimit.ok || !phoneLimit.ok) {
    return { error: "Terlalu banyak permintaan. Coba lagi nanti." };
  }

  // IP/phone limits stop individual abuse. This sender-wide reservation also
  // protects the linked WhatsApp account from distributed bursts across many
  // IPs and phone numbers. It is shared and atomic across serverless instances.
  const senderCapacity = await reserveWhatsAppOtpSend();
  if (!senderCapacity.ok) {
    return { error: "Pengiriman WhatsApp sedang padat. Coba lagi sebentar." };
  }

  const code = await issueOtpCode(phoneNormalized);
  const message =
    `Kode verifikasi Mektek Anda: ${code}. ` +
    `Berlaku 5 menit. Jangan bagikan kode ini kepada siapa pun.`;

  // WhatsApp availability gate. If the session can't send, we FAIL CLOSED in
  // production (never skip verification). In dev/prototype we log the code so the
  // local flow stays testable without a paired WhatsApp session.
  const whatsappAvailable =
    !areExternalApisDisabled() && (await getWhatsAppState()).status === "ready";

  if (!whatsappAvailable) {
    if (process.env.NODE_ENV !== "production") {
      console.log(
        `[phone-otp] WhatsApp unavailable; dev OTP for ${phoneNormalized}: ${code}`
      );
      return GENERIC_OK;
    }
    return { error: "Verifikasi WhatsApp sedang tidak tersedia" };
  }

  const sent = await sendWhatsAppMessage({ to: phoneNormalized, message });
  if (!sent.ok) {
    if (process.env.NODE_ENV !== "production") {
      console.log(
        `[phone-otp] WhatsApp send failed (${sent.error}); dev OTP for ${phoneNormalized}: ${code}`
      );
      return GENERIC_OK;
    }
    return { error: "Gagal mengirim kode verifikasi. Coba lagi nanti." };
  }

  return GENERIC_OK;
}
