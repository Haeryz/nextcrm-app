"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MessageCircle, ExternalLink } from "lucide-react";

interface WhatsAppComposerProps {
  phone: string;
  customerName: string;
  trackingLink: string;
}

function buildDefaultMessage(customerName: string, trackingLink: string) {
  return [
    `Halo ${customerName || "Pelanggan"},`,
    "",
    "Berikut update terkini servis kendaraan Anda di Mektek.",
    "",
    "Status, estimasi, dan catatan pengerjaan dapat dicek melalui link berikut:",
    trackingLink || "[link tracking belum tersedia]",
    "",
    "Silakan balas pesan ini jika ada pertanyaan.",
    "",
    "Terima kasih telah mempercayai Mektek.",
  ].join("\n");
}

export default function WhatsAppComposer({
  phone,
  customerName,
  trackingLink,
}: WhatsAppComposerProps) {
  const [message, setMessage] = useState(() =>
    buildDefaultMessage(customerName, trackingLink)
  );

  const cleanPhone = phone.replace(/\D/g, "").replace(/^0/, "62");

  const openWhatsApp = () => {
    const encoded = encodeURIComponent(message);
    const url = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encoded}`
      : `https://wa.me/?text=${encoded}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const openTrackingLink = () => {
    if (trackingLink) window.open(trackingLink, "_blank", "noopener,noreferrer");
  };

  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-bold tracking-widest uppercase text-muted-foreground flex items-center gap-2">
          <MessageCircle className="w-4 h-4" />
          WhatsApp
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {phone ? (
          <p className="text-xs text-muted-foreground">
            Kirim ke: <span className="font-mono font-semibold text-foreground">{phone}</span>
          </p>
        ) : (
          <p className="text-xs text-muted-foreground italic">
            Nomor telepon belum diisi pada data pelanggan.
          </p>
        )}

        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="min-h-32 text-sm font-mono"
          placeholder="Ketik pesan WhatsApp..."
        />

        <div className="flex gap-2 flex-wrap">
          <Button
            type="button"
            onClick={openWhatsApp}
            className="flex-1"
            disabled={!message.trim()}
          >
            <MessageCircle className="w-4 h-4 mr-2" />
            Buka WhatsApp
          </Button>
          {trackingLink && (
            <Button
              type="button"
              variant="outline"
              onClick={openTrackingLink}
            >
              <ExternalLink className="w-4 h-4 mr-2" />
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

        <p className="text-[11px] text-muted-foreground italic">
          Notifikasi otomatis aktif setelah integrasi WhatsApp-web.js terhubung.
        </p>
      </CardContent>
    </Card>
  );
}
