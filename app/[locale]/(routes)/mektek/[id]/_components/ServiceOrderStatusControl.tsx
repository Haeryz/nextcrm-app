"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Circle, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { updateMektekServiceOrderStatus } from "@/actions/mektek/service-orders";
import { Button } from "@/components/ui/button";

type OrderStatus = "ACTIVE" | "PENDING" | "AWAITING_PAYMENT" | "COMPLETE";

interface ServiceOrderStatusControlProps {
  locale: string;
  serviceOrderId: string;
  currentStatus: string;
  balanceDue: number;
  showCloseAction: boolean;
}

const STATUSES: { key: OrderStatus; label: string }[] = [
  { key: "PENDING", label: "Pending" },
  { key: "ACTIVE", label: "In Progress" },
  { key: "AWAITING_PAYMENT", label: "Service Done · Awaiting Payment" },
  { key: "COMPLETE", label: "Done · Closed" },
];

const statusLabel = (status: OrderStatus) =>
  STATUSES.find((item) => item.key === status)?.label ?? status;

export default function ServiceOrderStatusControl({
  locale,
  serviceOrderId,
  currentStatus,
  balanceDue,
  showCloseAction,
}: ServiceOrderStatusControlProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirmation, setConfirmation] = useState<
    "AWAITING_PAYMENT" | "COMPLETE" | null
  >(null);
  const [markAllComplete, setMarkAllComplete] = useState(true);

  const handleStatusChange = (newStatus: OrderStatus) => {
    if (
      (newStatus === "AWAITING_PAYMENT" || newStatus === "COMPLETE") &&
      confirmation !== newStatus
    ) {
      setConfirmation(newStatus);
      return;
    }

    startTransition(async () => {
      const result = await updateMektekServiceOrderStatus({
        locale,
        serviceOrderId,
        newStatus,
        markAllTimelineComplete:
          newStatus === "AWAITING_PAYMENT" ? markAllComplete : false,
      });
      if (!result || "error" in result) {
        toast.error(result?.error || "Gagal memperbarui status pesanan");
        setConfirmation(null);
        return;
      }

      toast.success(`Status diperbarui menjadi ${statusLabel(newStatus)}`);
      setConfirmation(null);
      router.refresh();
    });
  };

  const visibleStatuses = showCloseAction
    ? STATUSES
    : STATUSES.filter((status) => status.key !== "COMPLETE");
  const formattedBalance = balanceDue.toLocaleString("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  });
  const isClosed = currentStatus === "COMPLETE";

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Atur status</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {visibleStatuses.map(({ key, label }) => {
          const closeBlocked = key === "COMPLETE" && balanceDue > 0;
          return (
            <Button
              key={key}
              type="button"
              variant={currentStatus === key ? "default" : "outline"}
              size="sm"
              className="h-auto min-h-9 gap-1.5 whitespace-normal"
              disabled={isPending || isClosed || currentStatus === key || closeBlocked}
              onClick={() => handleStatusChange(key)}
            >
              {isPending && confirmation === key ? (
                <Loader2 className="size-3 animate-spin" />
              ) : currentStatus === key ? (
                <CheckCircle2 className="size-3" />
              ) : (
                <Circle className="size-3" />
              )}
              {label}
            </Button>
          );
        })}
      </div>

      {isClosed && (
        <p className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
          Pesanan ini telah lunas dan ditutup secara permanen.
        </p>
      )}

      {showCloseAction && currentStatus === "AWAITING_PAYMENT" && (
        <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
          {balanceDue > 0
            ? `Status Done · Closed tersedia setelah sisa ${formattedBalance} dibayar.`
            : "Pembayaran telah lunas. Pesanan ini sekarang dapat ditutup permanen."}
        </div>
      )}

      {confirmation && !isPending && (
        <div className="space-y-3 rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/20">
          <div>
            <p className="text-xs font-medium text-amber-800 dark:text-amber-300">
              {confirmation === "AWAITING_PAYMENT"
                ? "Selesaikan servis dan buka pembayaran?"
                : "Tutup pesanan yang sudah lunas ini?"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {confirmation === "AWAITING_PAYMENT"
                ? "Item akan dikunci, pelanggan dapat meninjau invoice akhir, dan pembayaran akan tersedia."
                : "Done · Closed adalah status akhir setelah servis, peninjauan pelanggan, dan pembayaran selesai."}
            </p>
          </div>

          {confirmation === "AWAITING_PAYMENT" && (
            <label className="flex cursor-pointer select-none items-center gap-2">
              <input
                type="checkbox"
                checked={markAllComplete}
                onChange={(event) => setMarkAllComplete(event.target.checked)}
                className="rounded"
              />
              <span className="text-xs text-muted-foreground">
                Tandai semua Timeline Step sebagai Done
              </span>
            </label>
          )}

          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => handleStatusChange(confirmation)}
            >
              Konfirmasi {confirmation === "AWAITING_PAYMENT" ? "Service Done" : "Close Order"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setConfirmation(null)}
            >
              Batal
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
