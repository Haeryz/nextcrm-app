"use client";

import Link from "next/link";
import { Copy, TicketPercent } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { MektekVoucher } from "@/lib/mektek/vouchers";

type CustomerVoucherListProps = {
  vouchers: MektekVoucher[];
  catalogHref?: string;
  cardClassName?: string;
};

function formatCurrency(amount: number) {
  return amount.toLocaleString("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  });
}

function formatDiscount(voucher: MektekVoucher) {
  if (voucher.discount.type === "fixed") {
    return formatCurrency(voucher.discount.amount);
  }

  return voucher.discount.maxDiscount
    ? `${voucher.discount.percent}% hingga ${formatCurrency(voucher.discount.maxDiscount)}`
    : `${voucher.discount.percent}%`;
}

export function CustomerVoucherList({
  vouchers,
  catalogHref,
  cardClassName,
}: CustomerVoucherListProps) {
  const availableVouchers = vouchers.filter((voucher) => voucher.available);

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      toast.success("Kode voucher disalin.");
    } catch {
      toast.error("Kode voucher gagal disalin. Salin manual dari kartu ini.");
    }
  };

  return (
    <section aria-labelledby="profile-vouchers-heading">
      <Card className={cn(cardClassName)}>
        <CardHeader className="gap-2 p-6 pb-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2
                id="profile-vouchers-heading"
                className="flex items-center gap-2 text-lg font-semibold tracking-tight"
              >
                <TicketPercent aria-hidden="true" className="size-5 shrink-0 text-primary" />
                Voucher Anda
              </h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Gunakan kode ini saat membuat pesanan servis atau checkout sparepart.
              </p>
            </div>
            <Badge className="bg-[hsl(var(--brand-yellow))] text-secondary-foreground hover:bg-[hsl(var(--brand-yellow))]">
              {availableVouchers.length} aktif
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-6 pt-0">
          {availableVouchers.length === 0 ? (
            <div className="flex flex-col items-center gap-4 rounded-lg border border-primary/10 bg-[hsl(var(--brand-surface))] px-4 py-8 text-center">
              <span className="flex size-12 items-center justify-center rounded-full bg-card">
                <TicketPercent aria-hidden="true" className="size-6 text-primary" />
              </span>
              <div>
                <h3 className="text-base font-semibold">Belum ada voucher aktif</h3>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                  Belum ada voucher yang bisa dipakai akun ini. Selesaikan servis
                  atau belanja sparepart di Mektek untuk membuka voucher
                  berikutnya.
                </p>
              </div>
              {catalogHref && (
                <Button asChild variant="outline" className="h-11">
                  <Link href={catalogHref}>Belanja sparepart</Link>
                </Button>
              )}
            </div>
          ) : (
            <ul className="grid list-none gap-3 p-0 md:grid-cols-2 xl:grid-cols-3">
              {availableVouchers.map((voucher) => (
                <li
                  key={voucher.id}
                  className="flex min-h-44 flex-col justify-between rounded-lg border border-primary/10 bg-[hsl(var(--brand-surface))] p-4"
                >
                  <div className="flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold leading-snug">
                          {voucher.title}
                        </p>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                          {voucher.description}
                        </p>
                      </div>
                      <Badge className="shrink-0">Siap digunakan</Badge>
                    </div>

                    <div className="rounded-md border border-primary/10 bg-card px-3 py-2">
                      <p className="text-xs text-muted-foreground">Kode</p>
                      <p className="mt-1 break-all font-mono text-sm font-semibold">
                        {voucher.code}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <p className="text-muted-foreground">Diskon</p>
                        <p className="mt-0.5 font-semibold">{formatDiscount(voucher)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Minimum</p>
                        <p className="mt-0.5 font-semibold">
                          {voucher.minSubtotal > 0
                            ? formatCurrency(voucher.minSubtotal)
                            : "Tidak ada"}
                        </p>
                      </div>
                    </div>
                    <p className="text-xs leading-5 text-muted-foreground">
                      {voucher.requirement}
                    </p>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    className="mt-4 h-11 bg-card"
                    onClick={() => copyCode(voucher.code)}
                    aria-label={`Salin kode voucher ${voucher.code}`}
                  >
                    <Copy data-icon="inline-start" aria-hidden="true" />
                    Salin kode
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
