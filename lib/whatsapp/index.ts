import "server-only";
import { areExternalApisDisabled } from "@/lib/external-apis";
import { normalizePhoneNumber } from "@/lib/phone";
import { assertWhatsAppSendAllowed } from "@/lib/mektek/whatsapp-send-policy";
import {
  normalizeWhatsAppPurpose,
  recordWhatsAppSend,
  type WhatsAppLogStatus,
} from "@/lib/whatsapp/send-log";
import { reserveWhatsAppSendSlot } from "@/lib/whatsapp/send-throttle";
import type {
  WhatsAppMedia,
  WhatsAppSendCategory,
  WhatsAppSendParams,
  WhatsAppSendResult,
  WhatsAppState,
} from "@/lib/whatsapp/types";

export type {
  WhatsAppMedia,
  WhatsAppSendCategory,
  WhatsAppSendParams,
  WhatsAppSendResult,
  WhatsAppState,
};

// Public surface of the WhatsApp integration. Callers never learn which transport
// is active — they get the same two functions regardless.

export type WhatsAppDriverName = "baileys" | "wwebjs";

/**
 * Baileys is the default everywhere, including local dev, so what you test is what
 * production runs. whatsapp-web.js remains available for local debugging but is
 * refused on Vercel, where its Chromium cannot work — better a clear error at the
 * call site than a mystifying crash inside Puppeteer.
 */
export function getWhatsAppDriverName(): WhatsAppDriverName {
  const requested = process.env.WHATSAPP_DRIVER?.trim().toLowerCase();
  if (requested === "wwebjs") {
    if (process.env.VERCEL) {
      throw new Error(
        "WHATSAPP_DRIVER=wwebjs cannot run on Vercel (it needs a persistent Chromium). " +
          "Unset it to use the default `baileys` driver."
      );
    }
    return "wwebjs";
  }
  return "baileys";
}

async function getDriver() {
  return getWhatsAppDriverName() === "wwebjs"
    ? import("@/lib/whatsapp/drivers/wwebjs")
    : import("@/lib/whatsapp/drivers/baileys");
}

/**
 * Current session state.
 *
 * Async because the Baileys driver reads it from Postgres — under serverless there
 * is no in-process session to inspect, and the database is the only thing that
 * outlives a request.
 */
export async function getWhatsAppState(): Promise<WhatsAppState> {
  if (areExternalApisDisabled()) {
    return { status: "disconnected", lastError: "External API dinonaktifkan" };
  }

  try {
    const driver = await getDriver();
    return await driver.getState();
  } catch (error) {
    return {
      status: "auth_failure",
      lastError: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * The one chokepoint every outbound message passes through — consent, throttle and
 * audit all live here rather than at the call sites.
 *
 * Placing them here rather than in the drivers is deliberate: the drivers are two
 * interchangeable transports, and a rule enforced in only one of them would quietly
 * disappear the moment `WHATSAPP_DRIVER` changed. Placing them here rather than in
 * the callers is equally deliberate — there are already seven call sites across
 * actions and cron routes, and the eighth would be the one that forgot.
 *
 * Every invocation writes exactly one `WhatsAppMessageLog` row, on all four exits:
 * suppressed by policy, suppressed by throttle, failed, or sent.
 */
export async function sendWhatsAppMessage(
  params: WhatsAppSendParams
): Promise<WhatsAppSendResult> {
  const purpose = normalizeWhatsAppPurpose(params.purpose);
  const category: WhatsAppSendCategory = params.category ?? "transactional";
  const phoneNormalized = normalizePhoneNumber(params.to);
  const sentById = params.sentById ?? null;

  const finish = async (
    status: WhatsAppLogStatus,
    result: WhatsAppSendResult,
    detail?: string
  ): Promise<WhatsAppSendResult> => {
    await recordWhatsAppSend({
      phoneNormalized,
      purpose,
      category,
      status,
      sentById,
      error: detail ?? (result.ok ? null : result.error),
    });
    return result;
  };

  if (!phoneNormalized) {
    return finish("failed", {
      ok: false,
      error: "Nomor WhatsApp tujuan tidak valid",
    });
  }

  if (areExternalApisDisabled()) {
    return finish(
      "suppressed",
      { ok: false, error: "External API dinonaktifkan" },
      "external APIs disabled"
    );
  }

  // Consent and volume first: a message we are not allowed to send must not even
  // consume a throttle slot.
  const decision = await assertWhatsAppSendAllowed({
    phoneNormalized,
    purpose,
    category,
  });
  if (!decision.allowed) {
    return finish(
      "suppressed",
      { ok: false, error: decision.message },
      `${decision.reason}: ${decision.detail}`
    );
  }

  // Spacing + jitter, taken before the driver so the wait happens outside the
  // connection lease and cannot starve pairing or logout.
  const slot = await reserveWhatsAppSendSlot();
  if (!slot.ok) {
    return finish(
      "suppressed",
      {
        ok: false,
        error:
          "Pengiriman WhatsApp sedang dibatasi untuk menjaga keamanan nomor. Coba lagi sebentar lagi.",
      },
      `throttled: retry after ${slot.retryAfterMs}ms`
    );
  }

  try {
    const driver = await getDriver();
    // Send the canonical number so the audited hash always matches what went out.
    const result = await driver.send({ ...params, to: phoneNormalized });
    return finish(result.ok ? "sent" : "failed", result);
  } catch (error) {
    return finish("failed", {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/** Unlinks the device and clears stored credentials. */
export async function logoutWhatsApp(): Promise<void> {
  const driver = await getDriver();
  await driver.logout();
}
