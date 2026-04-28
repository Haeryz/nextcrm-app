"use client";

import { useEffect, useState } from "react";
import Container from "@/app/[locale]/(routes)/components/ui/Container";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import MektekSubNav from "../_components/MektekSubNav";
import { QrCode, Smartphone, MessageSquare, CheckCircle2, AlertCircle } from "lucide-react";

const DEFAULT_TEMPLATES = [
  {
    id: "new_order",
    name: "Order Baru",
    body: "Halo {customerName}, pesanan servis AC kendaraan {vehicle} Anda telah kami terima. Pantau progres di: {trackingLink}",
  },
  {
    id: "status_update",
    name: "Update Status",
    body: "Halo {customerName}, ada update terbaru untuk servis kendaraan Anda: {updateMessage}. Cek di: {trackingLink}",
  },
  {
    id: "completed",
    name: "Servis Selesai",
    body: "Halo {customerName}, servis AC kendaraan {vehicle} Anda telah selesai! Silakan ambil kendaraan Anda. Terima kasih telah mempercayai Mektek! 🔧",
  },
];

export default function MektekWhatsAppPage() {
  const [businessPhone, setBusinessPhone] = useState("");
  const [templates, setTemplates] = useState(DEFAULT_TEMPLATES);
  const [sessionStatus, setSessionStatus] = useState<
    "disconnected" | "connecting" | "connected" | "qr" | "auth_failure"
  >("disconnected");
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  const updateTemplate = (id: string, body: string) => {
    setTemplates((prev) =>
      prev.map((t) => (t.id === id ? { ...t, body } : t))
    );
  };

  useEffect(() => {
    let isMounted = true;

    const fetchStatus = async () => {
      try {
        const response = await fetch("/api/whatsapp/status", { cache: "no-store" });
        if (!response.ok) return;
        const data = await response.json();
        if (!isMounted) return;

        if (data.status === "ready") {
          setSessionStatus("connected");
        } else if (data.status === "qr") {
          setSessionStatus("qr");
        } else if (data.status === "auth_failure") {
          setSessionStatus("auth_failure");
        } else if (data.status === "connecting") {
          setSessionStatus("connecting");
        } else {
          setSessionStatus("disconnected");
        }

        setQrDataUrl(typeof data.qrDataUrl === "string" ? data.qrDataUrl : null);
        setLastError(typeof data.lastError === "string" ? data.lastError : null);
      } catch {
        if (isMounted) {
          setSessionStatus("disconnected");
        }
      }
    };

    fetchStatus();
    const interval = window.setInterval(fetchStatus, 5000);

    return () => {
      isMounted = false;
      window.clearInterval(interval);
    };
  }, []);

  return (
    <Container
      title="MEKTEK — WhatsApp"
      description="Konfigurasi integrasi WhatsApp untuk notifikasi pelanggan"
    >
      <div className="space-y-6">
        <MektekSubNav activeTab="whatsapp" />

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
            {/* QR Code placeholder */}
            <div className="flex flex-col items-center gap-3">
              <div className="w-48 h-48 bg-muted rounded-xl flex flex-col items-center justify-center border-2 border-dashed border-border overflow-hidden">
                {qrDataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={qrDataUrl} alt="WhatsApp QR" className="h-48 w-48 object-contain" />
                ) : (
                  <>
                    <QrCode className="w-12 h-12 text-muted-foreground mb-2" />
                    <p className="text-xs text-muted-foreground text-center px-4">
                      QR code akan muncul di sini saat sesi siap dipasangkan
                    </p>
                  </>
                )}
              </div>
              <p className="text-xs text-muted-foreground max-w-xs text-center">
                Scan QR code ini dengan WhatsApp di ponsel Anda untuk menghubungkan sesi.
              </p>
              {lastError && (
                <p className="text-xs text-destructive max-w-xs text-center">
                  {lastError}
                </p>
              )}
            </div>

            <Separator />

            <div>
              <p className="text-xs text-muted-foreground mb-2">Nomor WhatsApp Bisnis</p>
              <Input
                placeholder="+62 812 xxxx xxxx"
                value={businessPhone}
                onChange={(e) => setBusinessPhone(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Nomor yang digunakan untuk mengirim pesan ke pelanggan.
              </p>
            </div>

            <Button variant="outline" className="w-full" onClick={() => window.location.reload()}>
              Refresh Status
            </Button>
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

        <Card className="border shadow-sm border-dashed">
          <CardContent className="p-6 text-center">
            <p className="text-sm text-muted-foreground font-medium">
              Integrasi WhatsApp-web.js
            </p>
            <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
              Koneksi sesi, pengiriman pesan otomatis, dan log percakapan akan tersedia
              setelah backend WhatsApp-web.js diimplementasikan.
            </p>
          </CardContent>
        </Card>
      </div>
    </Container>
  );
}
