"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ExternalLink, FileText, Receipt } from "lucide-react";

import { getStatusMeta } from "@/app/[locale]/(routes)/mektek/_lib/constants";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { MektekPublicSnapshot } from "@/lib/mektek/public-status";

type CustomerServiceLiveCardProps = {
  initialSnapshot: MektekPublicSnapshot;
  streamHref: string | null;
  invoiceHref: string | null;
  receiptHref: string | null;
  publicHref: string | null;
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
    <Card className="overflow-hidden">
      <CardHeader className="gap-3 border-b bg-muted/20">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase text-muted-foreground">
              Service #{snapshot.id.slice(0, 8)}
            </p>
            <CardTitle className="mt-1 truncate text-xl">{snapshot.vehicle}</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Last update: {formatDateTime(snapshot.updatedAt)}
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
              {snapshot.latestTimeline?.description || "No service update yet."}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {formatDateTime(snapshot.latestTimeline?.createdAt ?? null)}
            </p>
          </div>
          <div className="rounded-md border bg-background p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Current state
            </p>
            <Badge
              variant={statusMeta.badgeVariant}
              className="mt-2 px-3 py-1.5 text-xs font-bold uppercase tracking-wide"
            >
              {statusMeta.label}
            </Badge>
          </div>
        </div>

        <div className="grid gap-3 rounded-md border bg-muted/20 p-3 sm:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground">Total tagihan</p>
            <p className="text-sm font-semibold">
              {formatCurrency(snapshot.invoice.grandTotal)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Sudah dibayar</p>
            <p className="text-sm font-semibold">
              {formatCurrency(snapshot.invoice.amountPaid)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Sisa bayar</p>
            <p className="text-sm font-semibold">
              {formatCurrency(snapshot.invoice.balanceDue)}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          {publicHref && (
            <Button asChild variant="outline" className="sm:flex-1">
              <Link href={publicHref}>
                <ExternalLink data-icon="inline-start" />
                Detail live
              </Link>
            </Button>
          )}
          {invoiceHref && (
            <Button asChild variant="outline" className="sm:flex-1">
              <a href={invoiceHref} target="_blank" rel="noreferrer">
                <FileText data-icon="inline-start" />
                Invoice
              </a>
            </Button>
          )}
          {receiptHref && (
            <Button asChild variant="outline" className="sm:flex-1">
              <a href={receiptHref} target="_blank" rel="noreferrer">
                <Receipt data-icon="inline-start" />
                Receipt
              </a>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
