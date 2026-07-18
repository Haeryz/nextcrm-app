"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { ExternalLink, Loader2, MessageCircle, RefreshCw, Send } from "lucide-react";
import { toast } from "sonner";

import { sendMektekServiceOrderWhatsAppNotification } from "@/actions/mektek/service-orders";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

interface WhatsAppComposerProps {
  serviceOrderId: string;
  phone: string;
  customerName: string;
  trackingLink: string;
}

type ConnectionStatus = "checking" | "connected" | "disconnected";

function buildDefaultMessage(customerName: string, trackingLink: string) {
  return [
    `Halo ${customerName || "Pelanggan"},`,
    "",
    "Berikut update terkini servis kendaraan Anda di Mektek.",
    "",
    "Status, estimasi, rincian layanan, sparepart, dan tagihan dapat dicek melalui link berikut:",
    trackingLink || "[link tracking belum tersedia]",
    "",
    "Silakan balas pesan ini jika ada pertanyaan.",
    "",
    "Terima kasih telah mempercayai Mektek.",
  ].join("\n");
}

export default function WhatsAppComposer({
  serviceOrderId,
  phone,
  customerName,
  trackingLink,
}: WhatsAppComposerProps) {
  const [message, setMessage] = useState(() =>
    buildDefaultMessage(customerName, trackingLink),
  );
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("checking");
  const [isSending, startSending] = useTransition();

  const refreshConnection = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch("/api/whatsapp/status", {
        cache: "no-store",
        signal,
      });
      if (!response.ok) throw new Error("Status request failed");
      const payload = (await response.json()) as { status?: string };
      setConnectionStatus(payload.status === "ready" ? "connected" : "disconnected");
    } catch {
      if (signal?.aborted) return;
      setConnectionStatus("disconnected");
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const initialCheckId = window.setTimeout(() => {
      void refreshConnection(controller.signal);
    }, 0);
    const intervalId = window.setInterval(() => {
      void refreshConnection(controller.signal);
    }, 15_000);
    return () => {
      controller.abort();
      window.clearTimeout(initialCheckId);
      window.clearInterval(intervalId);
    };
  }, [refreshConnection]);

  const cleanPhone = phone.replace(/\D/g, "").replace(/^0/, "62");

  const openWhatsApp = () => {
    const encoded = encodeURIComponent(message);
    const url = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encoded}`
      : `https://wa.me/?text=${encoded}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const sendDirectly = () => {
    startSending(async () => {
      const result = await sendMektekServiceOrderWhatsAppNotification({
        serviceOrderId,
        message,
      });
      if (!result || "error" in result) {
        toast.error(result?.error || "Gagal mengirim pesan WhatsApp");
        void refreshConnection();
        return;
      }
      toast.success("Pesan WhatsApp terkirim");
    });
  };

  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-muted-foreground">
            <MessageCircle className="size-4" />
            WhatsApp
          </CardTitle>
          <div className="flex items-center gap-1.5">
            <Badge
              variant={connectionStatus === "connected" ? "default" : "secondary"}
            >
              {connectionStatus === "checking"
                ? "Memeriksa..."
                : connectionStatus === "connected"
                  ? "Terhubung"
                  : "Tidak terhubung"}
            </Badge>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={() => void refreshConnection()}
              aria-label="Periksa ulang koneksi WhatsApp"
            >
              <RefreshCw className="size-3.5" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {phone ? (
          <p className="text-xs text-muted-foreground">
            Kirim ke: <span className="font-mono font-semibold text-foreground">{phone}</span>
          </p>
        ) : (
          <p className="text-xs italic text-muted-foreground">
            Nomor telepon belum diisi pada data pelanggan.
          </p>
        )}

        <Textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          className="min-h-32 text-sm font-mono"
          maxLength={4_000}
          placeholder="Ketik pesan WhatsApp..."
        />

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={sendDirectly}
            className="flex-1"
            disabled={
              isSending ||
              connectionStatus !== "connected" ||
              !phone ||
              !message.trim()
            }
          >
            {isSending ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Send className="mr-2 size-4" />
            )}
            Kirim langsung
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={openWhatsApp}
            disabled={!message.trim()}
          >
            <MessageCircle className="mr-2 size-4" />
            Buka WhatsApp
          </Button>
          {trackingLink && (
            <Button
              type="button"
              variant="outline"
              onClick={() => window.open(trackingLink, "_blank", "noopener,noreferrer")}
            >
              <ExternalLink className="mr-2 size-4" />
              Preview Link
            </Button>
          )}
        </div>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-full text-xs text-muted-foreground"
          onClick={() => setMessage(buildDefaultMessage(customerName, trackingLink))}
        >
          Reset pesan ke default
        </Button>
      </CardContent>
    </Card>
  );
}
