"use client";

import { Copy, TicketPercent } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { MektekVoucher } from "@/lib/mektek/vouchers";

type CustomerVoucherListProps = {
  vouchers: MektekVoucher[];
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
    ? `${voucher.discount.percent}% up to ${formatCurrency(voucher.discount.maxDiscount)}`
    : `${voucher.discount.percent}%`;
}

export function CustomerVoucherList({ vouchers }: CustomerVoucherListProps) {
  const availableVouchers = vouchers.filter((voucher) => voucher.available);

  const copyCode = async (code: string) => {
    await navigator.clipboard.writeText(code);
    toast.success("Voucher code copied");
  };

  return (
    <Card>
      <CardHeader className="gap-2">
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <TicketPercent className="size-5" />
              Available vouchers
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Use these codes when creating a service order or checking out spareparts.
            </p>
          </div>
          <Badge variant="secondary">{availableVouchers.length} active</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {availableVouchers.map((voucher) => (
            <div
              key={voucher.id}
              className="flex min-h-44 flex-col justify-between rounded-lg border bg-muted/20 p-4"
            >
              <div className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">{voucher.title}</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      {voucher.description}
                    </p>
                  </div>
                  <Badge>Ready</Badge>
                </div>

                <div className="rounded-md border bg-background px-3 py-2">
                  <p className="text-xs text-muted-foreground">Code</p>
                  <p className="mt-1 break-all font-mono text-sm font-semibold">
                    {voucher.code}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className="text-muted-foreground">Discount</p>
                    <p className="font-semibold">{formatDiscount(voucher)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Minimum</p>
                    <p className="font-semibold">
                      {voucher.minSubtotal > 0 ? formatCurrency(voucher.minSubtotal) : "None"}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">{voucher.requirement}</p>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => copyCode(voucher.code)}
              >
                <Copy data-icon="inline-start" />
                Copy code
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
