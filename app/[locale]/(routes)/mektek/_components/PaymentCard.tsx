"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CheckCircle2, Circle, Info, Save } from "lucide-react";
import { updateMektekPayment } from "@/actions/mektek/service-orders";
import { RupiahInput } from "@/components/mektek/RupiahInput";
import { Switch } from "@/components/ui/switch";
import {
  MEKTEK_PPH_RATE,
  MEKTEK_PPN_RATE,
  type MektekPaymentDetail,
} from "@/lib/mektek/financials";

type PaymentMethod = "cash" | "transfer" | "qris";

type PaymentCardProps = {
  serviceOrderId: string;
  serviceSubtotal: number;
  sparepartSubtotal: number;
  initialDiscount: number;
  customerType: "STANDARD" | "B2B";
  initialPpnEnabled: boolean;
  initialPphEnabled: boolean;
  canManageTaxSettings: boolean;
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
  customerType,
  initialPpnEnabled,
  initialPphEnabled,
  canManageTaxSettings,
  initialAmountPaid,
  initialProviderAmountPaid,
  initialMethod,
  providerPayments,
}: PaymentCardProps) {
  const router = useRouter();
  const [method, setMethod] = useState<PaymentMethod>(initialMethod);
  const [discount, setDiscount] = useState(toInputValue(initialDiscount));
  const [ppnEnabled, setPpnEnabled] = useState(initialPpnEnabled);
  const [pphEnabled, setPphEnabled] = useState(
    customerType === "B2B" && initialPphEnabled,
  );
  const [amountPaid, setAmountPaid] = useState(toInputValue(initialAmountPaid));
  const [isPending, startTransition] = useTransition();

  const methods: { key: PaymentMethod; label: string }[] = [
    { key: "cash", label: "Tunai" },
    { key: "transfer", label: "Transfer" },
    { key: "qris", label: "QRIS" },
  ];

  const totals = useMemo(() => {
    const discountAmount = parseMoney(discount);
    const paidAmount = parseMoney(amountPaid);
    const subtotal = serviceSubtotal + sparepartSubtotal;
    const taxBase = Math.max(0, subtotal - discountAmount);
    const ppnAmount = ppnEnabled ? Math.round(taxBase * MEKTEK_PPN_RATE) : 0;
    const pphAmount =
      customerType === "B2B" && pphEnabled
        ? Math.round(taxBase * MEKTEK_PPH_RATE)
        : 0;
    const totalBeforePph = Math.max(0, taxBase + ppnAmount);
    const grossInvoiceTotal = Math.max(0, totalBeforePph + pphAmount);
    const total = grossInvoiceTotal;
    const providerPaid = Math.min(initialProviderAmountPaid, total);
    const paid = Math.min(Math.max(paidAmount, providerPaid), total);
    const remaining = Math.max(0, total - paid);
    const status = total > 0 && remaining === 0 ? "paid" : paid > 0 ? "partial" : "unpaid";
    return {
      discountAmount,
      taxBase,
      ppnAmount,
      pphAmount,
      totalBeforePph,
      grossInvoiceTotal,
      total,
      providerPaid,
      paid,
      remaining,
      status,
    };
  }, [
    amountPaid,
    customerType,
    discount,
    initialProviderAmountPaid,
    pphEnabled,
    ppnEnabled,
    serviceSubtotal,
    sparepartSubtotal,
  ]);

  const latestProviderPayment =
    providerPayments.find((payment) => payment.isPaid) ?? providerPayments[0] ?? null;

  const markPaid = () => {
    setAmountPaid(String(Math.round(totals.total)));
  };

  const savePayment = () => {
    startTransition(async () => {
      const result = await updateMektekPayment({
        serviceOrderId,
        method,
        discount,
        ppnEnabled: canManageTaxSettings ? ppnEnabled : undefined,
        pphEnabled: canManageTaxSettings ? pphEnabled : undefined,
        amountPaid,
      });

      if (result?.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Pembayaran disimpan");
      router.refresh();
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

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <p className="mb-2 text-xs text-muted-foreground">Diskon</p>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm text-muted-foreground">Rp</span>
              <RupiahInput
                aria-label="Diskon dalam Rupiah"
                value={discount}
                onValueChange={setDiscount}
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
              <RupiahInput
                aria-label="Jumlah yang sudah dibayar dalam Rupiah"
                value={amountPaid}
                onValueChange={setAmountPaid}
                placeholder="0"
                className="font-mono"
                disabled={isPending}
              />
            </div>
          </div>
        </div>

        <div className="rounded-lg border bg-muted/20 p-3">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Pengaturan Pajak
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex items-center justify-between gap-3 rounded-md border bg-background/80 p-3">
              <div>
                <p className="text-sm font-medium">PPN 11%</p>
                <p className="text-xs text-muted-foreground">Berlaku untuk pribadi dan perusahaan</p>
              </div>
              <Switch
                aria-label="Aktifkan PPN 11%"
                checked={ppnEnabled}
                onCheckedChange={setPpnEnabled}
                disabled={isPending || !canManageTaxSettings}
              />
            </div>
            {customerType === "B2B" && (
              <div className="flex items-center justify-between gap-3 rounded-md border bg-background/80 p-3">
                <div>
                  <p className="text-sm font-medium">PPh 23 ditambahkan 2%</p>
                  <p className="text-xs text-muted-foreground">
                    Ditambahkan ke total pelanggan perusahaan
                  </p>
                </div>
                <Switch
                  aria-label="Aktifkan penambahan PPh 23 sebesar 2%"
                  checked={pphEnabled}
                  onCheckedChange={setPphEnabled}
                  disabled={isPending || !canManageTaxSettings}
                />
              </div>
            )}
          </div>
          {!canManageTaxSettings && (
            <p className="mt-2 text-xs text-muted-foreground">
              Hanya Admin utama yang dapat mengubah pengaturan pajak.
            </p>
          )}
          {customerType === "B2B" && pphEnabled && (
            <div className="mt-3 flex gap-2 rounded-md border border-dashed bg-background/70 p-3 text-xs text-muted-foreground">
              <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <p>
                PPh 23 mengurangi uang yang dibayar pelanggan kepada MekTek. Nilai
                jasa tidak berkurang; bukti potongnya menjadi kredit pajak MekTek.
              </p>
            </div>
          )}
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
                <p className="text-xs text-muted-foreground">ID Pesanan</p>
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
              <p className="text-xs text-muted-foreground">Diskon (-)</p>
              <p className="break-words font-semibold leading-tight">
                {formatCurrency(totals.discountAmount)}
              </p>
            </div>
            <div className="min-w-0 rounded-md border bg-background/80 p-3">
              <p className="text-xs text-muted-foreground">DPP setelah diskon</p>
              <p className="break-words font-semibold leading-tight">
                {formatCurrency(totals.taxBase)}
              </p>
            </div>
            <div className="min-w-0 rounded-md border bg-background/80 p-3">
              <p className="text-xs text-muted-foreground">PPN</p>
              <p className="break-words font-semibold leading-tight">
                {formatCurrency(totals.ppnAmount)}
              </p>
            </div>
            {customerType === "B2B" && (
              <div className="min-w-0 rounded-md border bg-background/80 p-3">
                <p className="text-xs text-muted-foreground">Total sebelum PPh</p>
                <p className="break-words font-semibold leading-tight">
                  {formatCurrency(totals.totalBeforePph)}
                </p>
              </div>
            )}
            {customerType === "B2B" && (
              <div className="min-w-0 rounded-md border bg-background/80 p-3">
                <p className="text-xs text-muted-foreground">PPh 23 ditambahkan (+)</p>
                <p className="break-words font-semibold leading-tight">
                  + {formatCurrency(totals.pphAmount)}
                </p>
              </div>
            )}
            <div className="min-w-0 rounded-md border border-primary/30 bg-primary/5 p-3">
              <p className="text-xs text-muted-foreground">
                Total tagihan
              </p>
              <p className="break-words font-semibold leading-tight">
                {formatCurrency(totals.total)}
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
