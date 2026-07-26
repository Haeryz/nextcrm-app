import "server-only";

import {
  integerSetting,
  RATE_BUCKET_DB_FAILURE_RETRY_MS,
  reserveRateBucket,
  type RateBucketResult,
} from "@/lib/whatsapp/rate-bucket";

type GuardResult = RateBucketResult;

const DEFAULT_MIN_INTERVAL_MS = 12_000;
const DEFAULT_HOURLY_LIMIT = 30;
const HOUR_MS = 60 * 60 * 1000;

/**
 * Reserves sender-wide WhatsApp OTP capacity before an OTP is generated or sent.
 * The short bucket spaces messages out; the hourly bucket limits sustained volume.
 */
export async function reserveWhatsAppOtpSend(): Promise<GuardResult> {
  const minIntervalMs = integerSetting(
    "WHATSAPP_OTP_MIN_INTERVAL_MS",
    DEFAULT_MIN_INTERVAL_MS,
    1_000,
    5 * 60_000,
  );
  const hourlyLimit = integerSetting(
    "WHATSAPP_OTP_HOURLY_LIMIT",
    DEFAULT_HOURLY_LIMIT,
    1,
    500,
  );

  try {
    const spacing = await reserveRateBucket(
      "whatsapp-otp:sender:spacing",
      1,
      minIntervalMs,
    );
    if (!spacing.ok) return spacing;

    return await reserveRateBucket(
      "whatsapp-otp:sender:hourly",
      hourlyLimit,
      HOUR_MS,
    );
  } catch (error) {
    console.error("[WHATSAPP_OTP_SEND_GUARD]", error);
    // This guard protects the WhatsApp account itself, so DB outages fail closed.
    return { ok: false, retryAfterMs: RATE_BUCKET_DB_FAILURE_RETRY_MS };
  }
}
