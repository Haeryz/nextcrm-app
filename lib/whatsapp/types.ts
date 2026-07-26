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

/**
 * Transactional = the recipient asked for this specific message (OTP, order status,
 * receipt, invoice). Promotional = we chose to contact them (offers, campaigns,
 * reminders they never requested).
 *
 * The split is load-bearing, not cosmetic: opting out of marketing suppresses only
 * `promotional`, so an opted-out customer still gets the notification that their car
 * is ready. Daily volume caps likewise apply to `promotional` only.
 */
export type WhatsAppSendCategory = "transactional" | "promotional";

export type WhatsAppSendParams = {
  to: string;
  message: string;
  media?: WhatsAppMedia[];
  /**
   * Short slug identifying the message kind, e.g. `otp`, `order-complete`,
   * `contract-reminder`. Recorded on every WhatsAppMessageLog row so volume can be
   * attributed to a feature. Defaults to `unspecified`.
   */
  purpose?: string;
  /** Defaults to `transactional` — the conservative choice for existing callers. */
  category?: WhatsAppSendCategory;
  /** Staff member who triggered the send; omit for cron/system sends. */
  sentById?: string | null;
};

/** What a transport must provide. Both drivers satisfy this identically so callers
 *  (and the API routes) never branch on which one is active. */
export type WhatsAppDriver = {
  name: "baileys" | "wwebjs";
  getState: () => Promise<WhatsAppState>;
  send: (params: WhatsAppSendParams) => Promise<WhatsAppSendResult>;
  logout: () => Promise<void>;
};
