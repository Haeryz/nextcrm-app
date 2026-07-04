"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CheckCircle2, Circle, Save } from "lucide-react";
import { updateMektekPayment } from "@/actions/mektek/service-orders";
import type { MektekPaymentDetail } from "@/lib/mektek/financials";

type PaymentMethod = "cash" | "transfer" | "qris";

type PaymentCardProps = {
  serviceOrderId: string;
  serviceSubtotal: number;
  sparepartSubtotal: number;
  initialDiscount: number;
  initialTax: number;
  initialPph: number;
  initialAmountPaid: number;
  initialProviderAmountPaid: number;
  initialMethod: PaymentMethod;
  providerPayments: MektekPaymentDetail[];
};

const formatCurrency = (amount: number) =>
  amount.toLocaleString("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  });

const toInputValue = (amount: number) => (amount > 0 ? String(Math.round(amount)) : "");
const parseMoney = (value: string) => Number(value.replace(/\D/g, "")) || 0;

export default function PaymentCard({
  serviceOrderId,
  serviceSubtotal,
  sparepartSubtotal,
  initialDiscount,
  initialTax,
  initialPph,
  initialAmountPaid,
  initialProviderAmountPaid,
  initialMethod,
  providerPayments,
}: PaymentCardProps) {
  const [method, setMethod] = useState<PaymentMethod>(initialMethod);
  const [discount, setDiscount] = useState(toInputValue(initialDiscount));
  const [tax, setTax] = useState(toInputValue(initialTax));
  const [amountPaid, setAmountPaid] = useState(toInputValue(initialAmountPaid));
  const [isPending, startTransition] = useTransition();

  const methods: { key: PaymentMethod; label: string }[] = [
    { key: "cash", label: "Cash" },
    { key: "transfer", label: "Transfer" },
    { key: "qris", label: "QRIS" },
  ];

  const totals = useMemo(() => {
    const discountAmount = parseMoney(discount);
    const taxAmount = parseMoney(tax);
    const paidAmount = parseMoney(amountPaid);
    const subtotal = serviceSubtotal + sparepartSubtotal;
    const taxBase = Math.max(0, subtotal - discountAmount);
    const pphAmount = initialPph > 0 ? Math.round(taxBase * 0.02) : 0;
    const total = Math.max(0, taxBase + taxAmount - pphAmount);
    const providerPaid = Math.min(initialProviderAmountPaid, total);
    const paid = Math.min(Math.max(paidAmount, providerPaid), total);
    const remaining = Math.max(0, total - paid);
    const status = total > 0 && remaining === 0 ? "paid" : paid > 0 ? "partial" : "unpaid";
    return {
      discountAmount,
      taxAmount,
      pphAmount,
      total,
      providerPaid,
      paid,
      remaining,
      status,
    };
  }, [
    amountPaid,
    discount,
    initialPph,
    initialProviderAmountPaid,
    serviceSubtotal,
    sparepartSubtotal,
    tax,
  ]);

  const latestProviderPayment =
    providerPayments.find((payment) => payment.isPaid) ?? providerPayments[0] ?? null;

  const updateNumber = (setter: (value: string) => void) => (value: string) => {
    setter(value.replace(/\D/g, ""));
  };

  const markPaid = () => {
    setAmountPaid(String(Math.round(totals.total)));
  };

  const savePayment = () => {
    startTransition(async () => {
      const result = await updateMektekPayment({
        serviceOrderId,
        method,
        discount,
        tax,
        amountPaid,
      });

      if (result?.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Pembayaran disimpan");
    });
  };

  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-sm font-bold tracking-widest uppercase text-muted-foreground">
            Pembayaran
          </CardTitle>
          <Badge variant={totals.status === "paid" ? "default" : "secondary"}>
            {totals.status === "paid"
              ? "Lunas"
              : totals.status === "partial"
              ? "Dibayar Sebagian"
              : "Belum Bayar"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="mb-2 text-xs text-muted-foreground">Metode Pembayaran</p>
          <div className="flex gap-2">
            {methods.map(({ key, label }) => (
              <Button
                key={key}
                type="button"
                variant={method === key ? "default" : "outline"}
                size="sm"
                onClick={() => setMethod(key)}
                className="flex-1"
                disabled={isPending}
              >
                {method === key ? (
                  <CheckCircle2 className="mr-1 h-3 w-3" />
                ) : (
                  <Circle className="mr-1 h-3 w-3" />
                )}
                {label}
              </Button>
            ))}
          </div>
        </div>

        <Separator />

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div>
            <p className="mb-2 text-xs text-muted-foreground">Diskon</p>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm text-muted-foreground">Rp</span>
              <Input
                value={discount}
                onChange={(event) => updateNumber(setDiscount)(event.target.value)}
                placeholder="0"
                className="font-mono"
                disabled={isPending}
              />
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs text-muted-foreground">Pajak / biaya lain</p>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm text-muted-foreground">Rp</span>
              <Input
                value={tax}
                onChange={(event) => updateNumber(setTax)(event.target.value)}
                placeholder="0"
                className="font-mono"
                disabled={isPending}
              />
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs text-muted-foreground">Sudah dibayar</p>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm text-muted-foreground">Rp</span>
              <Input
                value={amountPaid}
                onChange={(event) => updateNumber(setAmountPaid)(event.target.value)}
                placeholder="0"
                className="font-mono"
                disabled={isPending}
              />
            </div>
          </div>
        </div>

        {latestProviderPayment && (
          <div className="rounded-md border bg-muted/20 p-3">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Midtrans
              </p>
              <Badge variant={latestProviderPayment.isPaid ? "default" : "secondary"}>
                {latestProviderPayment.isPaid ? "Berhasil" : "Menunggu"}
              </Badge>
            </div>
            <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-3">
              <div>
                <p className="text-xs text-muted-foreground">Terdeteksi dibayar</p>
                <p className="font-semibold">{formatCurrency(totals.providerPaid)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Metode gateway</p>
                <p className="font-semibold uppercase">
                  {latestProviderPayment.paymentType || "-"}
                </p>
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Order ID</p>
                <p className="truncate font-mono text-xs font-semibold">
                  {latestProviderPayment.midtransOrderId}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="rounded-lg border bg-muted/20 p-3">
          <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
            <div className="min-w-0 rounded-md border bg-background/80 p-3">
              <p className="text-xs text-muted-foreground">Subtotal servis</p>
              <p className="break-words font-semibold leading-tight">
                {formatCurrency(serviceSubtotal)}
              </p>
            </div>
            <div className="min-w-0 rounded-md border bg-background/80 p-3">
              <p className="text-xs text-muted-foreground">Subtotal sparepart</p>
              <p className="break-words font-semibold leading-tight">
                {formatCurrency(sparepartSubtotal)}
              </p>
            </div>
            <div className="min-w-0 rounded-md border bg-background/80 p-3">
              <p className="text-xs text-muted-foreground">Total tagihan</p>
              <p className="break-words font-semibold leading-tight">
                {formatCurrency(totals.total)}
              </p>
            </div>
            <div className="min-w-0 rounded-md border bg-background/80 p-3">
              <p className="text-xs text-muted-foreground">PPH</p>
              <p className="break-words font-semibold leading-tight">
                {formatCurrency(totals.pphAmount)}
              </p>
            </div>
            <div className="min-w-0 rounded-md border bg-background/80 p-3">
              <p className="text-xs text-muted-foreground">Dibayar</p>
              <p className="break-words font-semibold leading-tight">
                {formatCurrency(totals.paid)}
              </p>
            </div>
            <div className="min-w-0 rounded-md border bg-background/80 p-3">
              <p className="text-xs text-muted-foreground">Sisa bayar</p>
              <p className="break-words font-semibold leading-tight">
                {formatCurrency(totals.remaining)}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="button" variant="outline" onClick={markPaid} disabled={isPending}>
            Tandai Lunas
          </Button>
          <Button type="button" onClick={savePayment} disabled={isPending} className="sm:ml-auto">
            <Save className="mr-2 h-4 w-4" />
            {isPending ? "Menyimpan..." : "Simpan Pembayaran"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
