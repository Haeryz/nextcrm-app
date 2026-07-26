"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Circle, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { updateMektekServiceOrderStatus } from "@/actions/mektek/service-orders";
import { Button } from "@/components/ui/button";
import { statusMap } from "../../_lib/constants";

type OrderStatus =
  | "ACTIVE"
  | "PENDING"
  | "AWAITING_PAYMENT"
  | "COMPLETE"
  | "CANCELLED";

interface ServiceOrderStatusControlProps {
  locale: string;
  serviceOrderId: string;
  currentStatus: string;
  balanceDue: number;
  showCloseAction: boolean;
  canChangeStatus: boolean;
  canCancel: boolean;
}

// Labels come from the shared statusMap rather than being duplicated here, so the
// buttons can never disagree with the status badge rendered elsewhere on the page.
const STATUSES: { key: OrderStatus; label: string }[] = [
  { key: "PENDING", label: statusMap.PENDING.label },
  { key: "ACTIVE", label: statusMap.ACTIVE.label },
  { key: "AWAITING_PAYMENT", label: statusMap.AWAITING_PAYMENT.label },
  { key: "COMPLETE", label: statusMap.COMPLETE.label },
  { key: "CANCELLED", label: statusMap.CANCELLED.label },
];

const statusLabel = (status: OrderStatus) =>
  STATUSES.find((item) => item.key === status)?.label ?? status;

export default function ServiceOrderStatusControl({
  locale,
  serviceOrderId,
  currentStatus,
  balanceDue,
  showCloseAction,
  canChangeStatus,
  canCancel,
}: ServiceOrderStatusControlProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirmation, setConfirmation] = useState<
    "AWAITING_PAYMENT" | "COMPLETE" | "CANCELLED" | null
  >(null);
  // Tracks which button is actually being submitted. `confirmation` cannot do
  // this: it is null for the one-step PENDING/ACTIVE transitions, so keying the
  // spinner off it left those buttons with no loading state at all.
  const [submittingStatus, setSubmittingStatus] = useState<OrderStatus | null>(
    null,
  );

  const handleStatusChange = (newStatus: OrderStatus) => {
    if (
      (newStatus === "AWAITING_PAYMENT" ||
        newStatus === "COMPLETE" ||
        newStatus === "CANCELLED") &&
      confirmation !== newStatus
    ) {
      setConfirmation(newStatus);
      return;
    }

    setSubmittingStatus(newStatus);
    startTransition(async () => {
      const result = await updateMektekServiceOrderStatus({
        locale,
        serviceOrderId,
        newStatus,
      });
      if (!result || "error" in result) {
        toast.error(result?.error || "Gagal memperbarui status pesanan");
        setConfirmation(null);
        setSubmittingStatus(null);
        return;
      }

      // The WhatsApp notification for these two transitions now runs in the
      // background (after the response is flushed), so the toast must not imply
      // the customer has already been contacted — staff used to infer that from
      // the spinner finishing.
      const notifiesCustomer =
        newStatus === "AWAITING_PAYMENT" || newStatus === "COMPLETE";
      toast.success(`Status diperbarui menjadi ${statusLabel(newStatus)}`, {
        description: notifiesCustomer
          ? "Notifikasi WhatsApp ke pelanggan sedang diproses di latar belakang."
          : undefined,
      });
      setConfirmation(null);
      setSubmittingStatus(null);
      router.refresh();
    });
  };

  const visibleStatuses = STATUSES.filter((status) => {
    if (status.key === "CANCELLED") return canCancel;
    if (!canChangeStatus) return false;
    if (status.key === "COMPLETE") return showCloseAction;
    return true;
  });
  const formattedBalance = balanceDue.toLocaleString("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  });
  const isFinal =
    currentStatus === "COMPLETE" || currentStatus === "CANCELLED";

  return (
    <div className="min-w-0 space-y-2">
      {/* One column on purpose: this control lives in the pinned aside, where a
          viewport-based two-column grid would squeeze long labels such as
          "Service Done · Awaiting Payment" into roughly 150px. */}
      <div className="grid min-w-0 gap-1.5">
        {visibleStatuses.map(({ key, label }) => {
          const closeBlocked = key === "COMPLETE" && balanceDue > 0;
          return (
            <Button
              key={key}
              type="button"
              variant={
                key === "CANCELLED" && currentStatus !== key
                  ? "destructive"
                  : currentStatus === key
                    ? "default"
                    : "outline"
              }
              size="sm"
              className="h-auto min-h-10 w-full justify-start gap-2 whitespace-normal break-words px-3 py-2 text-left"
              disabled={
                isPending ||
                isFinal ||
                currentStatus === key ||
                closeBlocked ||
                (key === "CANCELLED" &&
                  currentStatus !== "ACTIVE" &&
                  currentStatus !== "PENDING")
              }
              onClick={() => handleStatusChange(key)}
            >
              {isPending && submittingStatus === key ? (
                <Loader2 className="size-3.5 shrink-0 animate-spin" />
              ) : currentStatus === key ? (
                <CheckCircle2 className="size-3.5 shrink-0" />
              ) : (
                <Circle className="size-3.5 shrink-0" />
              )}
              <span className="min-w-0">{label}</span>
            </Button>
          );
        })}
      </div>

      {isFinal && (
        <p className="break-words rounded-md border border-dashed px-3 py-2 text-xs leading-5 text-muted-foreground">
          {currentStatus === "CANCELLED"
            ? "Pesanan dibatalkan permanen dan seluruh alokasi stok sudah dikembalikan."
            : "Pesanan ini sudah lunas dan ditutup permanen."}
        </p>
      )}

      {showCloseAction && currentStatus === "AWAITING_PAYMENT" && (
        <p className="break-words rounded-md border border-dashed px-3 py-2 text-xs leading-5 text-muted-foreground">
          {balanceDue > 0
            ? `"${statusMap.COMPLETE.label}" tersedia setelah sisa ${formattedBalance} dibayar.`
            : "Pembayaran lunas. Pesanan sekarang dapat ditutup permanen."}
        </p>
      )}

      {confirmation && !isPending && (
        <div className="min-w-0 space-y-2 rounded-md border border-amber-300 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/40">
          <p className="break-words text-xs font-semibold text-amber-900 dark:text-amber-200">
            {confirmation === "AWAITING_PAYMENT"
              ? "Selesaikan servis dan buka pembayaran?"
              : confirmation === "CANCELLED"
                ? "Batalkan order dan kembalikan seluruh stok?"
                : "Tutup pesanan yang sudah lunas ini?"}
          </p>
          <p className="break-words text-xs leading-5 text-amber-800/90 dark:text-amber-200/80">
            {confirmation === "AWAITING_PAYMENT"
              ? "Item dikunci, pelanggan meninjau invoice akhir, lalu pembayaran terbuka."
              : confirmation === "CANCELLED"
                ? "Sparepart katalog kembali ke gudang asal. Tidak dapat dibatalkan."
                : "Status akhir setelah servis, peninjauan pelanggan, dan pembayaran selesai."}
          </p>

          {/* Always stacked: side by side these two wrap badly at ~340px. */}
          <div className="flex flex-col gap-1.5">
            <Button
              type="button"
              size="sm"
              onClick={() => handleStatusChange(confirmation)}
              className="h-auto min-h-10 w-full whitespace-normal break-words px-3 py-2"
            >
              Konfirmasi{" "}
              {confirmation === "AWAITING_PAYMENT"
                ? "Service Done"
                : confirmation === "CANCELLED"
                  ? "Batalkan Order"
                  : "Close Order"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setConfirmation(null)}
              className="min-h-10 w-full"
            >
              Batal
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
