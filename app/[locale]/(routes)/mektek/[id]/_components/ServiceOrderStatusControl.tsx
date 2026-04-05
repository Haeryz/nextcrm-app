"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { CheckCircle2, Circle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { updateMektekServiceOrderStatus } from "@/actions/mektek/service-orders";

interface ServiceOrderStatusControlProps {
  serviceOrderId: string;
  currentStatus: string;
}

const STATUSES = [
  { key: "PENDING"  as const, label: "Pending" },
  { key: "ACTIVE"   as const, label: "In Progress" },
  { key: "COMPLETE" as const, label: "Done" },
];

export default function ServiceOrderStatusControl({
  serviceOrderId,
  currentStatus,
}: ServiceOrderStatusControlProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pendingDone, setPendingDone] = useState(false);
  const [markAllComplete, setMarkAllComplete] = useState(true);

  const handleStatusChange = (newStatus: "ACTIVE" | "PENDING" | "COMPLETE") => {
    if (newStatus === "COMPLETE" && !pendingDone) {
      setPendingDone(true);
      return;
    }

    startTransition(async () => {
      const result = await updateMektekServiceOrderStatus({
        serviceOrderId,
        newStatus,
        markAllTimelineComplete: newStatus === "COMPLETE" ? markAllComplete : false,
      });

      if (result?.error) {
        toast.error(result.error);
        setPendingDone(false);
        return;
      }

      toast.success(`Status updated to ${newStatus === "COMPLETE" ? "Done" : newStatus === "ACTIVE" ? "In Progress" : "Pending"}`);
      setPendingDone(false);
      router.refresh();
    });
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Set status</p>
      <div className="flex gap-2">
        {STATUSES.map(({ key, label }) => (
          <Button
            key={key}
            type="button"
            variant={currentStatus === key ? "default" : "outline"}
            size="sm"
            className="flex-1 gap-1.5"
            disabled={isPending || currentStatus === key}
            onClick={() => handleStatusChange(key)}
          >
            {isPending && pendingDone && key === "COMPLETE" ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : currentStatus === key ? (
              <CheckCircle2 className="w-3 h-3" />
            ) : (
              <Circle className="w-3 h-3" />
            )}
            {label}
          </Button>
        ))}
      </div>

      {pendingDone && !isPending && (
        <div className="rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 p-3 space-y-2">
          <p className="text-xs font-medium text-amber-800 dark:text-amber-300">
            Mark this order as complete?
          </p>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={markAllComplete}
              onChange={(e) => setMarkAllComplete(e.target.checked)}
              className="rounded"
            />
            <span className="text-xs text-muted-foreground">
              Also mark all timeline steps as done
            </span>
          </label>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => handleStatusChange("COMPLETE")}
            >
              Confirm Done
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setPendingDone(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
