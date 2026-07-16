"use client";

import { useCallback, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { QrCode, Smartphone, MessageSquare, CheckCircle2, AlertCircle } from "lucide-react";

const DEFAULT_TEMPLATES = [
  {
    id: "new_order",
    name: "Order Baru",
    body: [
      "Halo {customerName},",
      "",
      "Terima kasih, pesanan servis kendaraan {vehicle} sudah kami terima di Mektek.",
      "",
      "Tim kami akan melakukan pengecekan awal dan memperbarui progres servis secara berkala.",
      "",
      "Cek status servis Anda di:",
      "{trackingLink}",
      "",
      "Simpan link ini untuk melihat status, estimasi, dan catatan pengerjaan terbaru.",
      "",
      "Terima kasih telah mempercayai Mektek.",
    ].join("\n"),
  },
  {
    id: "status_update",
    name: "Update Status",
    body: [
      "Halo {customerName},",
      "",
      "Ada update terbaru untuk servis kendaraan Anda:",
      "{updateMessage}",
      "",
      "Cek detail status servis di:",
      "{trackingLink}",
      "",
      "Silakan balas pesan ini jika ada pertanyaan.",
      "",
      "Terima kasih.",
    ].join("\n"),
  },
  {
    id: "completed",
    name: "Servis Selesai",
    body: [
      "Halo {customerName},",
      "",
      "Servis kendaraan {vehicle} Anda sudah selesai.",
      "",
      "Invoice dan struk kami lampirkan pada pesan ini. Ringkasan status servis tetap bisa dicek melalui link berikut:",
      "{trackingLink}",
      "",
      "Silakan hubungi kami jika ada pertanyaan sebelum pengambilan kendaraan.",
      "",
      "Terima kasih telah mempercayai Mektek.",
    ].join("\n"),
  },
];

function formatWhatsAppPhone(phone?: string | null) {
  if (!phone) return null;
  return phone.startsWith("+") ? phone : `+${phone}`;
}

type SessionStatus = "disconnected" | "connecting" | "connected" | "qr" | "auth_failure";

export type WhatsAppPairingPanelProps = {
  initialStatus: SessionStatus;
  initialPhone: string | null;
  initialError: string | null;
};

export default function WhatsAppPairingPanel({
  initialStatus,
  initialPhone,
  initialError,
}: WhatsAppPairingPanelProps) {
  const [connectedPhone, setConnectedPhone] = useState<string | null>(
    formatWhatsAppPhone(initialPhone)
  );
  const [templates, setTemplates] = useState(DEFAULT_TEMPLATES);
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>(initialStatus);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(initialError);
  const [isPairing, setIsPairing] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Held so the stream can be torn down explicitly: the server keeps a live
  // WhatsApp socket open for as long as this connection lasts, so an abandoned
  // stream would keep the send lease held.
  const pairingStreamRef = useRef<EventSource | null>(null);

  const updateTemplate = (id: string, body: string) => {
    setTemplates((prev) => prev.map((t) => (t.id === id ? { ...t, body } : t)));
  };

  const refreshStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/whatsapp/status", { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json();

      setSessionStatus(data.status === "ready" ? "connected" : "disconnected");
      setConnectedPhone(formatWhatsAppPhone(data.sessionPhone));
      setLastError(typeof data.lastError === "string" ? data.lastError : null);
    } catch {
      setSessionStatus("disconnected");
      setConnectedPhone(null);
    }
  }, []);

  const stopPairing = useCallback(() => {
    pairingStreamRef.current?.close();
    pairingStreamRef.current = null;
    setIsPairing(false);
    setQrDataUrl(null);
  }, []);

  // Pairing is a live stream, not a poll. The QR is only valid while the server's
  // WhatsApp socket is open, and that socket lives exactly as long as this request
  // — so closing this connection ends the pairing attempt, and holding it open is
  // what makes pairing possible on serverless at all.
  const startPairing = useCallback(() => {
    if (pairingStreamRef.current) return;

    setIsPairing(true);
    setLastError(null);
    setQrDataUrl(null);
    setSessionStatus("connecting");

    const source = new EventSource("/api/whatsapp/pair");
    pairingStreamRef.current = source;

    source.addEventListener("qr", (event) => {
      const { qrDataUrl: dataUrl } = JSON.parse((event as MessageEvent).data);
      setQrDataUrl(dataUrl);
      setSessionStatus("qr");
    });

    source.addEventListener("linked", (event) => {
      const { sessionPhone } = JSON.parse((event as MessageEvent).data);
      setConnectedPhone(formatWhatsAppPhone(sessionPhone));
      setSessionStatus("connected");
      setQrDataUrl(null);
      setLastError(null);
      stopPairing();
    });

    source.addEventListener("error", (event) => {
      const raw = (event as MessageEvent).data;
      if (raw) {
        try {
          setLastError(JSON.parse(raw).message ?? "Pairing gagal.");
        } catch {
          setLastError("Pairing gagal.");
        }
      } else {
        // No payload means the connection itself dropped (network, or the 5-minute
        // cap) rather than the server reporting a problem.
        setLastError("Koneksi pairing terputus. Coba hubungkan lagi.");
      }
      setSessionStatus("auth_failure");
      stopPairing();
    });

    source.onerror = () => {
      // Never let EventSource auto-reconnect: a retry would silently open a whole
      // new WhatsApp socket behind the user's back.
      if (source.readyState === EventSource.CLOSED) {
        setLastError((prev) => prev ?? "Koneksi pairing terputus. Coba hubungkan lagi.");
        setSessionStatus((prev) => (prev === "connected" ? prev : "disconnected"));
        stopPairing();
      }
    };
  }, [stopPairing]);

  const handleLogout = useCallback(async () => {
    setIsLoggingOut(true);
    setLastError(null);
    try {
      const response = await fetch("/api/whatsapp/logout", { method: "POST" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setLastError(data.error ?? "Logout gagal.");
        return;
      }
      setSessionStatus("disconnected");
      setConnectedPhone(null);
      setQrDataUrl(null);
    } catch (error) {
      setLastError(error instanceof Error ? error.message : "Logout gagal.");
    } finally {
      setIsLoggingOut(false);
    }
  }, []);

  return (
    <div className="space-y-6">
      {/* Session status */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-bold tracking-widest uppercase text-muted-foreground flex items-center gap-2">
              <Smartphone className="w-4 h-4" />
              Status Sesi
            </CardTitle>
            <Badge
              variant={sessionStatus === "connected" ? "default" : "secondary"}
              className="flex items-center gap-1"
            >
              {sessionStatus === "connected" ? (
                <CheckCircle2 className="w-3 h-3" />
              ) : (
                <AlertCircle className="w-3 h-3" />
              )}
              {sessionStatus === "disconnected"
                ? "Belum terhubung"
                : sessionStatus === "connecting"
                ? "Menghubungkan..."
                : sessionStatus === "qr"
                ? "Scan QR"
                : sessionStatus === "auth_failure"
                ? "Auth gagal"
                : "Terhubung"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col items-center gap-3">
            <div className="w-48 h-48 bg-muted rounded-xl flex flex-col items-center justify-center border-2 border-dashed border-border overflow-hidden">
              {qrDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qrDataUrl} alt="WhatsApp QR" className="h-48 w-48 object-contain" />
              ) : (
                <>
                  <QrCode className="w-12 h-12 text-muted-foreground mb-2" />
                  <p className="text-xs text-muted-foreground text-center px-4">
                    {sessionStatus === "connected"
                      ? "Sesi sudah tertaut"
                      : "QR code akan muncul di sini setelah Anda klik Hubungkan"}
                  </p>
                </>
              )}
            </div>
            <p className="text-xs text-muted-foreground max-w-xs text-center">
              {sessionStatus === "connected"
                ? "Sesi WhatsApp aktif. Notifikasi pelanggan dikirim dari nomor di bawah."
                : isPairing
                ? "Buka WhatsApp di ponsel → Perangkat Tertaut → Tautkan Perangkat, lalu scan QR di atas. Biarkan halaman ini terbuka selama proses pairing."
                : "Klik Hubungkan WhatsApp untuk menampilkan QR code."}
            </p>
            {lastError && (
              <p className="text-xs text-destructive max-w-xs text-center">{lastError}</p>
            )}
          </div>

          <Separator />

          <div>
            <p className="text-xs text-muted-foreground mb-2">Akun WhatsApp Pengirim</p>
            <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
              {connectedPhone ?? "Akan otomatis terdeteksi setelah QR berhasil discan"}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Nomor pengirim diambil dari sesi WhatsApp yang tertaut, jadi tidak perlu diisi manual.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            {sessionStatus === "connected" ? (
              <Button
                variant="outline"
                className="w-full"
                onClick={handleLogout}
                disabled={isLoggingOut}
              >
                {isLoggingOut ? "Memutuskan..." : "Putuskan Sesi (Logout)"}
              </Button>
            ) : isPairing ? (
              <Button variant="outline" className="w-full" onClick={stopPairing}>
                Batalkan Pairing
              </Button>
            ) : (
              <Button className="w-full" onClick={startPairing}>
                Hubungkan WhatsApp
              </Button>
            )}
            <Button
              variant="ghost"
              className="w-full"
              onClick={refreshStatus}
              disabled={isPairing || isLoggingOut}
            >
              Refresh Status
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Message templates */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-bold tracking-widest uppercase text-muted-foreground flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            Template Pesan
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <p className="text-xs text-muted-foreground">
            Variabel yang tersedia:{" "}
            <code className="bg-muted px-1 py-0.5 rounded text-[11px]">{"{customerName}"}</code>{" "}
            <code className="bg-muted px-1 py-0.5 rounded text-[11px]">{"{vehicle}"}</code>{" "}
            <code className="bg-muted px-1 py-0.5 rounded text-[11px]">{"{trackingLink}"}</code>{" "}
            <code className="bg-muted px-1 py-0.5 rounded text-[11px]">{"{updateMessage}"}</code>
          </p>

          {templates.map((template) => (
            <div key={template.id} className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">{template.name}</p>
                <Badge variant="outline" className="text-[10px]">
                  {template.id}
                </Badge>
              </div>
              <Textarea
                value={template.body}
                onChange={(e) => updateTemplate(template.id, e.target.value)}
                className="min-h-20 text-sm"
              />
            </div>
          ))}

          <Button variant="outline" disabled className="w-full">
            Simpan Template (Backend Pending)
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
