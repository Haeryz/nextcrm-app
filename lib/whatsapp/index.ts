import { areExternalApisDisabled } from "@/lib/external-apis";
import { getWhatsAppClient, getWhatsAppState } from "@/lib/whatsapp/client";
import { toWhatsAppChatId } from "@/lib/phone";

export type WhatsAppMedia = {
  mimeType: string;
  filename: string;
  data: Buffer;
  caption?: string;
};

export type WhatsAppSendResult =
  | { ok: true }
  | { ok: false; error: string };

// Chat id is derived from the same canonical E.164 normalizer the rest of the
// app uses, so WhatsApp always messages the exact number we stored.
const buildChatId = toWhatsAppChatId;

export async function sendWhatsAppMessage(params: {
  to: string;
  message: string;
  media?: WhatsAppMedia[];
}): Promise<WhatsAppSendResult> {
  if (areExternalApisDisabled()) {
    return { ok: false, error: "External APIs are disabled" };
  }

  const client = await getWhatsAppClient();
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
      const { MessageMedia } = await import("whatsapp-web.js");
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
