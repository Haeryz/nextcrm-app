"use client";

import { useId, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { CheckCircle2, Circle, Info, Save } from "lucide-react";
import { updateMektekPayment } from "@/actions/mektek/service-orders";
import { RupiahInput } from "@/components/mektek/RupiahInput";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
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

const rupiahFormatter = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

const formatCurrency = (amount: number) => rupiahFormatter.format(amount);

const toInputValue = (amount: number) => (amount > 0 ? String(Math.round(amount)) : "");
const parseMoney = (value: string) => Number(value.replace(/\D/g, "")) || 0;

/** Compact label/value row that keeps the amount on one line at ~340px. */
function SummaryRow({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt
        className={cn(
          "min-w-0 text-xs",
          emphasis ? "font-medium text-foreground" : "text-muted-foreground",
        )}
      >
        {label}
      </dt>
      <dd
        className={cn(
          "shrink-0 tabular-nums",
          emphasis ? "text-sm font-semibold" : "text-xs font-medium text-muted-foreground",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

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
  const fieldId = useId();
  const discountId = `${fieldId}-discount`;
  const amountPaidId = `${fieldId}-amount-paid`;
  const [method, setMethod] = useState<PaymentMethod>(initialMethod);
  const [discount, setDiscount] = useState(toInputValue(initialDiscount));
  const [ppnEnabled, setPpnEnabled] = useState(
    customerType === "B2B" && initialPpnEnabled,
  );
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
    const ppnAmount =
      customerType === "B2B" && ppnEnabled
        ? Math.round(taxBase * MEKTEK_PPN_RATE)
        : 0;
    const pphAmount =
      customerType === "B2B" && pphEnabled
        ? Math.round(serviceSubtotal * MEKTEK_PPH_RATE)
        : 0;
    const totalBeforePph = Math.max(0, taxBase + ppnAmount);
    const grossInvoiceTotal = totalBeforePph;
    const total = Math.max(0, totalBeforePph - pphAmount);
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

  const hasOutstanding = totals.remaining > 0;

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
    <Card className="@container min-w-0 border shadow-sm">
      <CardHeader className="px-4 pb-3 pt-4 @min-[28rem]:px-6 @min-[28rem]:pt-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
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
      <CardContent className="space-y-4 px-4 pb-4 @min-[28rem]:px-6 @min-[28rem]:pb-6">
        {/* Angka paling penting: sisa yang masih harus ditagih. */}
        <div
          className={cn(
            "min-w-0 rounded-lg border p-3 @min-[26rem]:p-4",
            hasOutstanding
              ? "border-destructive/40 bg-destructive/5"
              : "border-primary/30 bg-primary/5",
          )}
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Sisa bayar
          </p>
          <p
            className={cn(
              "mt-1 break-words text-2xl font-bold leading-tight tabular-nums @min-[26rem]:text-3xl",
              hasOutstanding ? "text-destructive" : "text-foreground",
            )}
          >
            {formatCurrency(totals.remaining)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {hasOutstanding
              ? "Masih harus ditagih ke pelanggan."
              : "Tidak ada sisa tagihan."}
          </p>
          <Separator className="my-3" />
          <dl className="space-y-1.5">
            <SummaryRow
              label="Total tagihan"
              value={formatCurrency(totals.total)}
              emphasis
            />
            <SummaryRow label="Dibayar" value={formatCurrency(totals.paid)} emphasis />
          </dl>
        </div>

        <div className="grid gap-3 @min-[26rem]:grid-cols-2">
          <div className="min-w-0">
            <Label htmlFor={discountId} className="mb-2 block text-xs text-muted-foreground">
              Diskon
            </Label>
            <div className="relative min-w-0">
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 left-3 flex items-center font-mono text-sm text-muted-foreground"
              >
                Rp
              </span>
              <RupiahInput
                id={discountId}
                aria-label="Diskon dalam Rupiah"
                value={discount}
                onValueChange={setDiscount}
                placeholder="0"
                className="min-w-0 pl-9 font-mono tabular-nums"
                disabled={isPending}
              />
            </div>
          </div>
          <div className="min-w-0">
            <Label
              htmlFor={amountPaidId}
              className="mb-2 block text-xs text-muted-foreground"
            >
              Sudah dibayar
            </Label>
            <div className="relative min-w-0">
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 left-3 flex items-center font-mono text-sm text-muted-foreground"
              >
                Rp
              </span>
              <RupiahInput
                id={amountPaidId}
                aria-label="Jumlah yang sudah dibayar dalam Rupiah"
                value={amountPaid}
                onValueChange={setAmountPaid}
                placeholder="0"
                className="min-w-0 pl-9 font-mono tabular-nums"
                disabled={isPending}
              />
            </div>
          </div>
        </div>

        <div role="group" aria-label="Metode pembayaran">
          <p className="mb-2 text-xs text-muted-foreground">Metode Pembayaran</p>
          <div className="flex flex-col gap-2 min-[360px]:flex-row">
            {methods.map(({ key, label }) => (
              <Button
                key={key}
                type="button"
                variant={method === key ? "default" : "outline"}
                size="sm"
                aria-pressed={method === key}
                onClick={() => setMethod(key)}
                className="h-10 w-full min-w-0 px-2 text-xs min-[360px]:flex-1 @min-[26rem]:px-3 @min-[26rem]:text-sm"
                disabled={isPending}
              >
                {method === key ? (
                  <CheckCircle2 className="mr-1 size-3.5 shrink-0" aria-hidden="true" />
                ) : (
                  <Circle className="mr-1 size-3.5 shrink-0" aria-hidden="true" />
                )}
                <span className="truncate">{label}</span>
              </Button>
            ))}
          </div>
        </div>

        {customerType === "B2B" && (
        <div className="rounded-lg border bg-muted/20 p-3">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Pengaturan Pajak
          </p>
          <div className="grid gap-3 @min-[32rem]:grid-cols-2">
            <div className="min-w-0 rounded-md border bg-background/80 p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="min-w-0 text-sm font-medium">PPN 11%</p>
                <Switch
                  className="shrink-0"
                  aria-label="Aktifkan PPN 11%"
                  checked={ppnEnabled}
                  onCheckedChange={setPpnEnabled}
                  disabled={isPending || !canManageTaxSettings}
                />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Ditambahkan ke DPP dan disetor oleh MekTek
              </p>
            </div>
            <div className="min-w-0 rounded-md border bg-background/80 p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="min-w-0 text-sm font-medium">PPh 23 dipotong 2%</p>
                <Switch
                  className="shrink-0"
                  aria-label="Aktifkan pemotongan PPh 23 sebesar 2%"
                  checked={pphEnabled}
                  onCheckedChange={setPphEnabled}
                  disabled={isPending || !canManageTaxSettings}
                />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Dihitung 2% dari total jasa saja
              </p>
            </div>
          </div>
          {!canManageTaxSettings && (
            <p className="mt-2 text-xs text-muted-foreground">
              Hanya Admin utama yang dapat mengubah pengaturan pajak.
            </p>
          )}
          {pphEnabled && (
            <div className="mt-3 flex gap-2 rounded-md border border-dashed bg-background/70 p-3 text-xs text-muted-foreground">
              <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <p className="min-w-0">
                PPh 23 dipotong pelanggan sebesar 2% dari total jasa saja dan
                disetor oleh pelanggan. Nilai sparepart tidak termasuk dasar PPh.
              </p>
            </div>
          )}
        </div>
        )}

        <div className="min-w-0 rounded-lg border bg-muted/20 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Rincian Perhitungan
          </p>
          <dl className="space-y-1.5">
            <SummaryRow
              label="Subtotal servis"
              value={formatCurrency(serviceSubtotal)}
            />
            <SummaryRow
              label="Subtotal sparepart"
              value={formatCurrency(sparepartSubtotal)}
            />
            <SummaryRow
              label="Diskon (-)"
              value={formatCurrency(totals.discountAmount)}
            />
            <SummaryRow
              label="DPP setelah diskon"
              value={formatCurrency(totals.taxBase)}
            />
            <SummaryRow label="PPN" value={formatCurrency(totals.ppnAmount)} />
            {customerType === "B2B" && (
              <SummaryRow
                label="Total sebelum PPh"
                value={formatCurrency(totals.totalBeforePph)}
              />
            )}
            {customerType === "B2B" && (
              <SummaryRow
                label="PPh 23 dipotong (-)"
                value={`- ${formatCurrency(totals.pphAmount)}`}
              />
            )}
          </dl>
        </div>

        {latestProviderPayment && (
          <div className="min-w-0 rounded-md border bg-muted/20 p-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Midtrans
              </p>
              <Badge variant={latestProviderPayment.isPaid ? "default" : "secondary"}>
                {latestProviderPayment.isPaid ? "Berhasil" : "Menunggu"}
              </Badge>
            </div>
            <dl className="space-y-1.5">
              <SummaryRow
                label="Terdeteksi dibayar"
                value={formatCurrency(totals.providerPaid)}
                emphasis
              />
              <SummaryRow
                label="Metode gateway"
                value={(latestProviderPayment.paymentType || "-").toUpperCase()}
              />
              <div className="flex flex-col gap-0.5">
                <dt className="text-xs text-muted-foreground">ID Pesanan</dt>
                <dd className="min-w-0 break-all font-mono text-xs font-medium">
                  {latestProviderPayment.midtransOrderId}
                </dd>
              </div>
            </dl>
          </div>
        )}

        <div className="flex flex-col gap-2 @min-[26rem]:flex-row">
          <Button
            type="button"
            variant="outline"
            onClick={markPaid}
            disabled={isPending}
            className="h-10 w-full @min-[26rem]:w-auto"
          >
            Tandai Lunas
          </Button>
          <Button
            type="button"
            onClick={savePayment}
            disabled={isPending}
            className="h-10 w-full @min-[26rem]:ml-auto @min-[26rem]:w-auto"
          >
            <Save className="mr-2 size-4 shrink-0" aria-hidden="true" />
            {isPending ? "Menyimpan..." : "Simpan Pembayaran"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
