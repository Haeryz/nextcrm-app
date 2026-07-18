"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Circle, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { updateMektekServiceOrderStatus } from "@/actions/mektek/service-orders";
import { Button } from "@/components/ui/button";

type OrderStatus = "ACTIVE" | "PENDING" | "AWAITING_PAYMENT" | "COMPLETE";

interface ServiceOrderStatusControlProps {
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
        serviceOrderId,
        newStatus,
        markAllTimelineComplete:
          newStatus === "AWAITING_PAYMENT" ? markAllComplete : false,
      });
      if (!result || "error" in result) {
        toast.error(result?.error || "Failed to update order status");
        setConfirmation(null);
        return;
      }

      toast.success(`Status updated to ${statusLabel(newStatus)}`);
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
      <p className="text-xs text-muted-foreground">Set status</p>
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
          This order is fully paid and permanently closed.
        </p>
      )}

      {showCloseAction && currentStatus === "AWAITING_PAYMENT" && (
        <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
          {balanceDue > 0
            ? `Done · Closed unlocks after the remaining ${formattedBalance} is paid.`
            : "Payment is settled. This order can now be closed permanently."}
        </div>
      )}

      {confirmation && !isPending && (
        <div className="space-y-3 rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/20">
          <div>
            <p className="text-xs font-medium text-amber-800 dark:text-amber-300">
              {confirmation === "AWAITING_PAYMENT"
                ? "Finish service and open payment?"
                : "Close this fully paid order?"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {confirmation === "AWAITING_PAYMENT"
                ? "Items will be locked, the customer can review the final invoice, and payment becomes available."
                : "Done · Closed is the final state after service, customer review, and payment are complete."}
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
                Also mark all timeline steps as done
              </span>
            </label>
          )}

          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => handleStatusChange(confirmation)}
            >
              Confirm {confirmation === "AWAITING_PAYMENT" ? "Service Done" : "Close Order"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setConfirmation(null)}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
