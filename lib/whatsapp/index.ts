import "server-only";
import { areExternalApisDisabled } from "@/lib/external-apis";
import type {
  WhatsAppMedia,
  WhatsAppSendParams,
  WhatsAppSendResult,
  WhatsAppState,
} from "@/lib/whatsapp/types";

export type { WhatsAppMedia, WhatsAppSendResult, WhatsAppState };

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
    return { status: "disconnected", lastError: "External APIs are disabled" };
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

export async function sendWhatsAppMessage(
  params: WhatsAppSendParams
): Promise<WhatsAppSendResult> {
  if (areExternalApisDisabled()) {
    return { ok: false, error: "External APIs are disabled" };
  }

  try {
    const driver = await getDriver();
    return await driver.send(params);
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/** Unlinks the device and clears stored credentials. */
export async function logoutWhatsApp(): Promise<void> {
  const driver = await getDriver();
  await driver.logout();
}
