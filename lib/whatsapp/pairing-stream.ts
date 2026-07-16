export type PairingEventSource = {
  close: () => void;
  onerror: ((event: Event) => void) | null;
  addEventListener: (
    type: string,
    listener: (event: MessageEvent) => void
  ) => void;
};

type PairingStreamOptions = {
  url: string;
  createSource?: (
    url: string,
    options: { withCredentials: boolean }
  ) => PairingEventSource;
  onQr: (qrDataUrl: string) => void;
  onLinked: (sessionPhone?: string) => void;
  onError: (message: string) => void;
};

const CONNECTION_ERROR = "Koneksi pairing terputus. Coba hubungkan lagi.";

function messageFromErrorEvent(event: Event): string {
  const raw = (event as MessageEvent).data;
  if (typeof raw !== "string" || !raw) return CONNECTION_ERROR;

  try {
    const payload = JSON.parse(raw) as { message?: unknown };
    return typeof payload.message === "string" && payload.message
      ? payload.message
      : "Pairing gagal.";
  } catch {
    return "Pairing gagal.";
  }
}

/**
 * Opens one credentialed SSE pairing request.
 *
 * EventSource reconnects automatically after HTTP/auth/network failures. Pairing
 * must never do that: every retry creates another server-side WhatsApp socket.
 * Closing on the first error makes one button click equal exactly one request.
 */
export function openWhatsAppPairingStream({
  url,
  createSource = (url, options) =>
    new EventSource(url, options) as unknown as PairingEventSource,
  onQr,
  onLinked,
  onError,
}: PairingStreamOptions): PairingEventSource {
  const source = createSource(url, { withCredentials: true });
  const nativeClose = source.close.bind(source);
  let closed = false;

  const close = () => {
    if (closed) return;
    closed = true;
    nativeClose();
  };

  source.addEventListener("qr", (event) => {
    if (closed) return;
    const payload = JSON.parse(event.data) as { qrDataUrl: string };
    onQr(payload.qrDataUrl);
  });

  source.addEventListener("linked", (event) => {
    if (closed) return;
    const payload = JSON.parse(event.data) as { sessionPhone?: string };
    onLinked(payload.sessionPhone);
  });

  source.onerror = (event) => {
    if (closed) return;
    const message = messageFromErrorEvent(event);
    close();
    onError(message);
  };

  source.close = close;
  return source;
}
