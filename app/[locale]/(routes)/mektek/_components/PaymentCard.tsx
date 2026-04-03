"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CheckCircle2, Circle } from "lucide-react";

type PaymentMethod = "cash" | "transfer" | "qris";

export default function PaymentCard() {
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [amountDue, setAmountDue] = useState("");
  const [isPaid, setIsPaid] = useState(false);

  const methods: { key: PaymentMethod; label: string }[] = [
    { key: "cash", label: "Cash" },
    { key: "transfer", label: "Transfer" },
    { key: "qris", label: "QRIS" },
  ];

  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-bold tracking-widest uppercase text-muted-foreground">
            Pembayaran
          </CardTitle>
          <Badge
            variant={isPaid ? "default" : "secondary"}
            className="cursor-pointer select-none"
            onClick={() => setIsPaid((prev) => !prev)}
          >
            {isPaid ? "Lunas" : "Belum Bayar"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Payment method selector */}
        <div>
          <p className="text-xs text-muted-foreground mb-2">Metode Pembayaran</p>
          <div className="flex gap-2">
            {methods.map(({ key, label }) => (
              <Button
                key={key}
                type="button"
                variant={method === key ? "default" : "outline"}
                size="sm"
                onClick={() => setMethod(key)}
                className="flex-1"
              >
                {method === key ? (
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                ) : (
                  <Circle className="w-3 h-3 mr-1" />
                )}
                {label}
              </Button>
            ))}
          </div>
        </div>

        <Separator />

        {/* Amount due */}
        <div>
          <p className="text-xs text-muted-foreground mb-2">Jumlah Tagihan</p>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground font-mono">Rp</span>
            <Input
              placeholder="0"
              value={amountDue}
              onChange={(e) => setAmountDue(e.target.value.replace(/\D/g, ""))}
              className="font-mono"
            />
          </div>
          {amountDue && (
            <p className="text-xs text-muted-foreground mt-1">
              {parseInt(amountDue).toLocaleString("id-ID", {
                style: "currency",
                currency: "IDR",
                minimumFractionDigits: 0,
              })}
            </p>
          )}
        </div>

        <p className="text-[11px] text-muted-foreground italic">
          Pembayaran akan disimpan saat integrasi backend aktif.
        </p>
      </CardContent>
    </Card>
  );
}
