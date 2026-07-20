"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ExternalLink, FileText, Receipt } from "lucide-react";

import { getStatusMeta } from "@/app/[locale]/(routes)/mektek/_lib/constants";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PayNowButton } from "@/components/mektek/PayNowButton";
import type { MektekPublicSnapshot } from "@/lib/mektek/public-status";

type CustomerServiceLiveCardProps = {
  initialSnapshot: MektekPublicSnapshot;
  streamHref: string | null;
  invoiceHref: string | null;
  receiptHref: string | null;
  publicHref: string | null;
  payToken?: string | null;
};

const formatDateTime = (value: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
};

const formatCurrency = (amount: number) =>
  amount.toLocaleString("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  });

export function CustomerServiceLiveCard({
  initialSnapshot,
  streamHref,
  invoiceHref,
  receiptHref,
  publicHref,
  payToken,
}: CustomerServiceLiveCardProps) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);

  useEffect(() => {
    if (!streamHref) return;

    const source = new EventSource(streamHref);
    source.addEventListener("snapshot", (event) => {
      try {
        setSnapshot(JSON.parse((event as MessageEvent<string>).data));
      } catch {
        // Keep the last valid service state if a stream event is malformed.
      }
    });

    return () => {
      source.close();
    };
  }, [streamHref]);

  const statusMeta = getStatusMeta(snapshot.taskStatus);

  return (
    <Card className="overflow-hidden border-[#151a63]/10 bg-white">
      <CardHeader className="gap-3 border-b border-[#151a63]/10 bg-[#eef1ff]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase text-[#4b5577]">
              Servis #{snapshot.serviceNumber}
            </p>
            <CardTitle className="mt-1 truncate text-xl">{snapshot.vehicle}</CardTitle>
            <p className="mt-1 text-sm text-[#4b5577]">
              Pembaruan terakhir: {formatDateTime(snapshot.updatedAt)}
            </p>
          </div>
          <Badge
            variant={statusMeta.badgeVariant}
            className="h-fit w-fit px-3 py-1.5 text-xs font-bold uppercase tracking-wide"
          >
            {statusMeta.label}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="grid gap-5 p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-[1fr_160px] sm:items-center">
          <div>
            <p className="text-sm font-semibold">
              {snapshot.latestTimeline?.description || "Belum ada pembaruan servis."}
            </p>
            <p className="mt-1 text-xs text-[#4b5577]">
              {formatDateTime(snapshot.latestTimeline?.createdAt ?? null)}
            </p>
          </div>
          <div className="rounded-md border border-[#151a63]/10 bg-[#fafbff] p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-[#4b5577]">
              Status saat ini
            </p>
            <Badge
              variant={statusMeta.badgeVariant}
              className="mt-2 px-3 py-1.5 text-xs font-bold uppercase tracking-wide"
            >
              {statusMeta.label}
            </Badge>
          </div>
        </div>

        <div className="grid gap-3 rounded-md border border-[#151a63]/10 bg-[#fafbff] p-3 sm:grid-cols-3">
          <div>
            <p className="text-xs text-[#4b5577]">Total tagihan</p>
            <p className="text-sm font-semibold">
              {formatCurrency(snapshot.invoice.grandTotal)}
            </p>
          </div>
          <div>
            <p className="text-xs text-[#4b5577]">Sudah dibayar</p>
            <p className="text-sm font-semibold">
              {formatCurrency(snapshot.invoice.amountPaid)}
            </p>
          </div>
          <div>
            <p className="text-xs text-[#4b5577]">Sisa bayar</p>
            <p className="text-sm font-semibold">
              {formatCurrency(snapshot.invoice.balanceDue)}
            </p>
          </div>
        </div>

        {payToken && snapshot.paymentAvailable && (
          <PayNowButton
            serviceOrderId={snapshot.id}
            token={payToken}
            balanceDue={snapshot.invoice.balanceDue}
            className="w-full"
          />
        )}

        <div className="flex flex-col gap-2 sm:flex-row">
          {publicHref && (
            <Button
              asChild
              variant="outline"
              className="border-[#151a63]/20 bg-white/80 text-[#10164f] hover:bg-[#eef1ff] sm:flex-1"
            >
              <Link href={publicHref}>
                <ExternalLink data-icon="inline-start" />
                Detail langsung
              </Link>
            </Button>
          )}
          {invoiceHref && snapshot.invoiceAvailable && (
            <Button
              asChild
              variant="outline"
              className="border-[#151a63]/20 bg-white/80 text-[#10164f] hover:bg-[#eef1ff] sm:flex-1"
            >
              <a href={invoiceHref} target="_blank" rel="noreferrer">
                <FileText data-icon="inline-start" />
                Invoice
              </a>
            </Button>
          )}
          {receiptHref && snapshot.receiptAvailable && (
            <Button
              asChild
              variant="outline"
              className="border-[#151a63]/20 bg-white/80 text-[#10164f] hover:bg-[#eef1ff] sm:flex-1"
            >
              <a href={receiptHref} target="_blank" rel="noreferrer">
                <Receipt data-icon="inline-start" />
                Struk
              </a>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
