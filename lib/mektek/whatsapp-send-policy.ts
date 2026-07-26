import "server-only";

import { prismadb } from "@/lib/prisma";
import { integerSetting } from "@/lib/whatsapp/rate-bucket";
import type { WhatsAppSendCategory } from "@/lib/whatsapp/types";

// The single gate every outbound WhatsApp message passes before it is handed to a
// driver. It answers one question — "are we allowed to send this right now?" — and
// answers it as data, never as a throw, so `lib/whatsapp/index.ts` can write a
// `suppressed` audit row with the reason attached.
//
// Two rules, and the boundary between them is the important part:
//
//   1. Opt-out suppresses PROMOTIONAL messages only. A customer who no longer wants
//      offers has not asked to stop hearing that their car is ready or that their
//      OTP is 481203. Suppressing transactional traffic on an opt-out would silently
//      break orders, which is worse than the marketing it was meant to stop.
//   2. The daily cap applies to PROMOTIONAL messages only, for the same reason: a
//      busy service day must not exhaust the budget and then swallow an OTP.
//
// Volume is what got the owner's number suspended, and promotional volume is the
// part that is discretionary.

export type { WhatsAppSendCategory };

export type WhatsAppSuppressionReason =
  | "opted_out"
  | "daily_cap"
  | "policy_unavailable";

export type WhatsAppSendDecision =
  | { allowed: true }
  | {
      allowed: false;
      reason: WhatsAppSuppressionReason;
      /** Bahasa Indonesia — surfaced to staff in the UI. */
      message: string;
      /** Diagnostic detail for the audit log. English. */
      detail: string;
    };

export type WhatsAppSendPolicyInput = {
  /** Canonical E.164 value from `normalizePhoneNumber`. */
  phoneNormalized: string;
  purpose: string;
  category: WhatsAppSendCategory;
};

export const WHATSAPP_PROMO_DAILY_CAP_DEFAULT = 50;

/** Indonesia observes no DST, so a fixed UTC+7 offset defines "today" exactly. */
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

/**
 * Env-tunable ceiling on promotional messages per calendar day (WIB). Deliberately
 * conservative by default: the cost of a suppressed campaign message is a log line,
 * the cost of a suspended number is the whole channel.
 */
export function getWhatsAppPromoDailyCap(): number {
  return integerSetting(
    "WHATSAPP_PROMO_DAILY_CAP",
    WHATSAPP_PROMO_DAILY_CAP_DEFAULT,
    0,
    10_000,
  );
}

/** Start of the current day in Asia/Jakarta, expressed as a UTC instant. */
export function startOfWibDay(now: Date = new Date()): Date {
  const shifted = now.getTime() + WIB_OFFSET_MS;
  const midnight = Math.floor(shifted / 86_400_000) * 86_400_000;
  return new Date(midnight - WIB_OFFSET_MS);
}

/**
 * Decides whether one outbound message may go out.
 *
 * Transactional messages short-circuit before any query: there is no rule that can
 * suppress them, so they must not be able to fail on a database blip either.
 * Promotional messages do hit the database, and a failure there fails closed —
 * matching `lib/whatsapp/otp-send-guard.ts`, because an unverifiable opt-out state
 * is exactly when sending marketing is most dangerous.
 */
export async function assertWhatsAppSendAllowed(
  input: WhatsAppSendPolicyInput,
): Promise<WhatsAppSendDecision> {
  if (input.category !== "promotional") return { allowed: true };

  try {
    const customer = await prismadb.catalogCustomer.findUnique({
      where: { phoneNormalized: input.phoneNormalized },
      select: { whatsappOptedOutAt: true },
    });

    if (customer?.whatsappOptedOutAt) {
      return {
        allowed: false,
        reason: "opted_out",
        message:
          "Pelanggan sudah berhenti berlangganan pesan promosi WhatsApp. Pesan promosi tidak dikirim.",
        detail: `opted out at ${customer.whatsappOptedOutAt.toISOString()}`,
      };
    }

    const cap = getWhatsAppPromoDailyCap();
    const sentToday = await prismadb.whatsAppMessageLog.count({
      where: {
        category: "promotional",
        status: "sent",
        sentAt: { gte: startOfWibDay() },
      },
    });

    if (sentToday >= cap) {
      return {
        allowed: false,
        reason: "daily_cap",
        message:
          "Batas harian pesan promosi WhatsApp sudah tercapai. Coba lagi besok.",
        detail: `promotional daily cap reached (${sentToday}/${cap})`,
      };
    }

    return { allowed: true };
  } catch (error) {
    console.error("[WHATSAPP_SEND_POLICY]", error);
    // Fail closed: without the opt-out list we cannot prove this send is consented.
    return {
      allowed: false,
      reason: "policy_unavailable",
      message:
        "Pemeriksaan kebijakan WhatsApp tidak tersedia. Pesan promosi ditunda demi keamanan nomor.",
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}
