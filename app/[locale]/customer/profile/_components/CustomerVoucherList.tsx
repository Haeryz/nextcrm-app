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
    <Card className="border-[#151a63]/10 bg-white dark:border-white/10 dark:bg-white/[0.06]">
      <CardHeader className="gap-2">
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <TicketPercent className="size-5 text-[#151a63] dark:text-[#fff200]" />
              Available vouchers
            </CardTitle>
            <p className="mt-1 text-sm text-[#4b5577] dark:text-blue-50/70">
              Use these codes when creating a service order or checking out spareparts.
            </p>
          </div>
          <Badge className="bg-[#fff200] text-[#10164f] hover:bg-[#fff200]">
            {availableVouchers.length} active
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {availableVouchers.map((voucher) => (
            <div
              key={voucher.id}
              className="flex min-h-44 flex-col justify-between rounded-md border border-[#151a63]/10 bg-[#fafbff] p-4 dark:border-white/10 dark:bg-[#070a18]"
            >
              <div className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">{voucher.title}</p>
                    <p className="mt-1 text-xs leading-5 text-[#4b5577] dark:text-blue-50/70">
                      {voucher.description}
                    </p>
                  </div>
                  <Badge className="bg-[#151a63] text-[#fff200] hover:bg-[#151a63] dark:bg-[#fff200] dark:text-[#10164f] dark:hover:bg-[#fff200]">
                    Ready
                  </Badge>
                </div>

                <div className="rounded-md border border-[#151a63]/10 bg-white px-3 py-2 dark:border-white/10 dark:bg-white/[0.06]">
                  <p className="text-xs text-[#4b5577] dark:text-blue-50/60">Code</p>
                  <p className="mt-1 break-all font-mono text-sm font-semibold">
                    {voucher.code}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className="text-[#4b5577] dark:text-blue-50/60">Discount</p>
                    <p className="font-semibold">{formatDiscount(voucher)}</p>
                  </div>
                  <div>
                    <p className="text-[#4b5577] dark:text-blue-50/60">Minimum</p>
                    <p className="font-semibold">
                      {voucher.minSubtotal > 0 ? formatCurrency(voucher.minSubtotal) : "None"}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-[#4b5577] dark:text-blue-50/60">
                  {voucher.requirement}
                </p>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-4 border-[#151a63]/20 bg-white text-[#10164f] hover:bg-[#eef1ff] dark:border-white/15 dark:bg-white/10 dark:text-white dark:hover:bg-white/15"
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
