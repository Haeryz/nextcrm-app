import { MessageMedia } from "whatsapp-web.js";
import { areExternalApisDisabled } from "@/lib/external-apis";
import { getWhatsAppClient, getWhatsAppState } from "@/lib/whatsapp/client";

export type WhatsAppMedia = {
  mimeType: string;
  filename: string;
  data: Buffer;
  caption?: string;
};

export type WhatsAppSendResult =
  | { ok: true }
  | { ok: false; error: string };

function normalizePhone(phone: string): string {
  return String(phone ?? "")
    .replace(/\s+/g, "")
    .replace(/[^\d+]/g, "")
    .replace(/^00/, "+");
}

function buildChatId(phone: string): string | null {
  const normalized = normalizePhone(phone);
  if (!normalized) return null;

  let digits = normalized.replace(/\D/g, "");
  if (!digits) return null;

  if (digits.startsWith("0")) {
    digits = `62${digits.slice(1)}`;
  }

  return `${digits}@c.us`;
}

export async function sendWhatsAppMessage(params: {
  to: string;
  message: string;
  media?: WhatsAppMedia[];
}): Promise<WhatsAppSendResult> {
  if (areExternalApisDisabled()) {
    return { ok: false, error: "External APIs are disabled" };
  }

  const client = getWhatsAppClient();
  const state = getWhatsAppState();
  if (state.status !== "ready") {
    return { ok: false, error: "WhatsApp session is not ready" };
  }

  const chatId = buildChatId(params.to);
  if (!chatId) {
    return { ok: false, error: "Invalid WhatsApp destination" };
  }

  try {
    await client.sendMessage(chatId, params.message);

    if (params.media?.length) {
      for (const item of params.media) {
        const media = new MessageMedia(
          item.mimeType,
          item.data.toString("base64"),
          item.filename
        );
        await client.sendMessage(chatId, media, {
          caption: item.caption,
          sendMediaAsDocument: true,
        });
      }
    }

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
