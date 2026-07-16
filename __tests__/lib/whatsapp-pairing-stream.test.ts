import {
  openWhatsAppPairingStream,
  type PairingEventSource,
} from "@/lib/whatsapp/pairing-stream";

class FakeEventSource implements PairingEventSource {
  readonly withCredentials = true;
  onerror: ((event: Event) => void) | null = null;
  close = jest.fn();

  private listeners = new Map<string, (event: MessageEvent) => void>();

  addEventListener(type: string, listener: (event: MessageEvent) => void) {
    this.listeners.set(type, listener);
  }

  emit(type: string, data: unknown) {
    this.listeners.get(type)?.({ data: JSON.stringify(data) } as MessageEvent);
  }
}

describe("openWhatsAppPairingStream", () => {
  it("includes credentials and closes a failed stream without reconnecting", () => {
    const source = new FakeEventSource();
    const nativeClose = source.close;
    const createSource = jest.fn((_url: string, options: EventSourceInit) => {
      expect(options.withCredentials).toBe(true);
      return source;
    });
    const onError = jest.fn();

    openWhatsAppPairingStream({
      url: "/en/mektek/whatsapp/pair",
      createSource,
      onQr: jest.fn(),
      onLinked: jest.fn(),
      onError,
    });

    source.onerror?.(new Event("error"));
    source.onerror?.(new Event("error"));

    expect(nativeClose).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(
      "Koneksi pairing terputus. Coba hubungkan lagi."
    );
    expect(createSource).toHaveBeenCalledWith("/en/mektek/whatsapp/pair", {
      withCredentials: true,
    });
  });

  it("forwards QR and linked payloads", () => {
    const source = new FakeEventSource();
    const onQr = jest.fn();
    const onLinked = jest.fn();

    openWhatsAppPairingStream({
      url: "/en/mektek/whatsapp/pair",
      createSource: () => source,
      onQr,
      onLinked,
      onError: jest.fn(),
    });

    source.emit("qr", { qrDataUrl: "data:image/png;base64,qr" });
    source.emit("linked", { sessionPhone: "628123" });

    expect(onQr).toHaveBeenCalledWith("data:image/png;base64,qr");
    expect(onLinked).toHaveBeenCalledWith("628123");
  });
});
