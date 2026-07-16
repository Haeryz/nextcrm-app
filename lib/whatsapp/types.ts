// Shared shapes for the WhatsApp integration. Split out from index.ts so the
// drivers and the API routes can import types without pulling a transport (and its
// WASM / Chromium) into their module graph.

export type WhatsAppSessionStatus =
  | "disconnected"
  | "connecting"
  | "qr"
  | "ready"
  | "auth_failure";

export type WhatsAppState = {
  status: WhatsAppSessionStatus;
  qrDataUrl?: string;
  sessionPhone?: string;
  lastQrAt?: string;
  lastError?: string;
};

export type WhatsAppMedia = {
  mimeType: string;
  filename: string;
  data: Buffer;
  caption?: string;
};

export type WhatsAppSendResult = { ok: true } | { ok: false; error: string };

export type WhatsAppSendParams = {
  to: string;
  message: string;
  media?: WhatsAppMedia[];
};

/** What a transport must provide. Both drivers satisfy this identically so callers
 *  (and the API routes) never branch on which one is active. */
export type WhatsAppDriver = {
  name: "baileys" | "wwebjs";
  getState: () => Promise<WhatsAppState>;
  send: (params: WhatsAppSendParams) => Promise<WhatsAppSendResult>;
  logout: () => Promise<void>;
};
