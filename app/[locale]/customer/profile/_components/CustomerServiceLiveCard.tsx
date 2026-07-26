"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  Receipt,
  Wallet,
  Wrench,
  XCircle,
  type LucideIcon,
} from "lucide-react";

import { getStatusMeta } from "@/app/[locale]/(routes)/mektek/_lib/constants";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PayNowButton } from "@/components/mektek/PayNowButton";
import { cn } from "@/lib/utils";
import type { MektekPublicSnapshot } from "@/lib/mektek/public-status";
import { formatCustomerDateTime } from "@/lib/mektek/customer-display";

type CustomerServiceLiveCardProps = {
  initialSnapshot: MektekPublicSnapshot;
  streamHref: string | null;
  invoiceHref: string | null;
  receiptHref: string | null;
  publicHref: string | null;
  payToken?: string | null;
  cardClassName?: string;
};

// Use the shared helper, not a local one. Bare `toLocaleDateString()` follows the
// VISITOR's browser locale, so this card rendered "7/26/2026" for an en-US customer
// while the tracking page it links to showed "26/7/2026" for the same order — and
// 7/26 vs 26/7 is ambiguous, not merely different. The helper also pins the
// timezone to Asia/Makassar so the calendar day cannot shift.
const formatDateTime = formatCustomerDateTime;

const formatCurrency = (amount: number) =>
  amount.toLocaleString("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  });

// Status must never be carried by colour alone: every state pairs the Bahasa
// Indonesia label from `getStatusMeta` with a distinct icon and a plain-language
// sentence, so it still reads correctly in greyscale or for a colour-blind user.
const STATUS_PRESENTATION: Record<
  string,
  { icon: LucideIcon; hint: string }
> = {
  ACTIVE: {
    icon: Wrench,
    hint: "Teknisi sedang menangani kendaraan Anda.",
  },
  PENDING: {
    icon: Clock,
    hint: "Servis sudah terdaftar dan menunggu giliran dikerjakan.",
  },
  AWAITING_PAYMENT: {
    icon: Wallet,
    hint: "Pekerjaan sudah selesai. Lunasi tagihan untuk menutup servis.",
  },
  COMPLETE: {
    icon: CheckCircle2,
    hint: "Servis selesai dan sudah ditutup.",
  },
  CANCELLED: {
    icon: XCircle,
    hint: "Servis ini dibatalkan. Hubungi Admin bila ini keliru.",
  },
};

export function CustomerServiceLiveCard({
  initialSnapshot,
  streamHref,
  invoiceHref,
  receiptHref,
  publicHref,
  payToken,
  cardClassName,
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
  const statusPresentation =
    STATUS_PRESENTATION[snapshot.taskStatus ?? "ACTIVE"] ??
    STATUS_PRESENTATION.ACTIVE;
  const StatusIcon = statusPresentation.icon;

  return (
    <Card className={cn("overflow-hidden", cardClassName)}>
      <CardHeader className="gap-1 border-b border-primary/10 bg-secondary p-4 sm:p-5">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Servis #{snapshot.serviceNumber}
        </p>
        <h3 className="text-lg font-semibold leading-snug tracking-tight [overflow-wrap:anywhere]">
          {snapshot.vehicle}
        </h3>
        <p className="text-sm text-muted-foreground">
          Pembaruan terakhir: {formatDateTime(snapshot.updatedAt)}
        </p>
      </CardHeader>

      <CardContent className="flex flex-col gap-5 p-4 sm:p-5">
        {/* Rendered as text rather than a pill: the longest label,
            "Servis Selesai · Menunggu Pembayaran", wraps to two or three lines on
            a 360px phone, which a rounded-full badge cannot absorb without either
            clipping or turning into a lozenge. */}
        <div className="flex items-start gap-3 rounded-lg border border-primary/10 bg-[hsl(var(--brand-surface))] p-4">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-card">
            <StatusIcon aria-hidden="true" className="size-5 text-primary" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Status saat ini
            </p>
            <p className="mt-1 text-base font-semibold leading-snug text-secondary-foreground [overflow-wrap:anywhere]">
              {statusMeta.label}
            </p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {statusPresentation.hint}
            </p>
          </div>
        </div>

        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Pembaruan terakhir dari bengkel
          </p>
          <p className="mt-1 text-sm font-semibold leading-6">
            {snapshot.latestTimeline?.description ||
              "Belum ada catatan progres. Bengkel akan menambahkannya begitu pengerjaan dimulai."}
          </p>
          {snapshot.latestTimeline?.createdAt && (
            <p className="mt-1 text-xs text-muted-foreground">
              {formatDateTime(snapshot.latestTimeline.createdAt)}
            </p>
          )}
        </div>

        <div className="grid gap-3 rounded-lg border border-primary/10 bg-[hsl(var(--brand-surface))] p-4 sm:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground">Total tagihan</p>
            <p className="mt-0.5 text-sm font-semibold">
              {formatCurrency(snapshot.invoice.grandTotal)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Sudah dibayar</p>
            <p className="mt-0.5 text-sm font-semibold">
              {formatCurrency(snapshot.invoice.amountPaid)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Sisa bayar</p>
            <p className="mt-0.5 text-sm font-semibold">
              {formatCurrency(snapshot.invoice.balanceDue)}
            </p>
          </div>
        </div>

        {payToken && snapshot.paymentAvailable && (
          <PayNowButton
            serviceOrderId={snapshot.id}
            token={payToken}
            balanceDue={snapshot.invoice.balanceDue}
            className="h-11 w-full"
          />
        )}

        <div className="flex flex-col gap-2 sm:flex-row">
          {publicHref && (
            <Button asChild variant="outline" className="h-11 sm:flex-1">
              <Link href={publicHref}>
                <ExternalLink data-icon="inline-start" aria-hidden="true" />
                Detail langsung
              </Link>
            </Button>
          )}
          {invoiceHref && snapshot.invoiceAvailable && (
            <Button asChild variant="outline" className="h-11 sm:flex-1">
              <a href={invoiceHref} target="_blank" rel="noreferrer">
                <FileText data-icon="inline-start" aria-hidden="true" />
                Invoice
              </a>
            </Button>
          )}
          {receiptHref && snapshot.receiptAvailable && (
            <Button asChild variant="outline" className="h-11 sm:flex-1">
              <a href={receiptHref} target="_blank" rel="noreferrer">
                <Receipt data-icon="inline-start" aria-hidden="true" />
                Struk
              </a>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
