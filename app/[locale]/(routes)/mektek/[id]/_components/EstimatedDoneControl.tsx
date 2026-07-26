"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Loader2, Save, X } from "lucide-react";
import { toast } from "sonner";

import { updateMektekServiceOrderEstimatedDone } from "@/actions/mektek/service-orders";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface EstimatedDoneControlProps {
  serviceOrderId: string;
  estimatedDone: string | null;
}

function toLocalInputValue(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatEstimate(value: string | null) {
  if (!value) return "Belum diatur";
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Makassar",
  }).format(new Date(value));
}

export default function EstimatedDoneControl({
  serviceOrderId,
  estimatedDone,
}: EstimatedDoneControlProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [currentEstimate, setCurrentEstimate] = useState(estimatedDone);
  const [inputValue, setInputValue] = useState(() => toLocalInputValue(estimatedDone));

  const submit = (nextInput: string | null) => {
    let nextEstimate: string | null = null;
    if (nextInput) {
      const parsed = new Date(nextInput);
      if (Number.isNaN(parsed.getTime())) {
        toast.error("Pilih ETA yang valid");
        return;
      }
      nextEstimate = parsed.toISOString();
    }

    startTransition(async () => {
      const result = await updateMektekServiceOrderEstimatedDone({
        serviceOrderId,
        estimatedDone: nextEstimate,
      });
      if (!result || "error" in result) {
        toast.error(result?.error || "Gagal memperbarui ETA");
        return;
      }

      const savedEstimate = result.data.estimatedDone;
      setCurrentEstimate(savedEstimate);
      setInputValue(toLocalInputValue(savedEstimate));
      toast.success(savedEstimate ? "ETA berhasil diperbarui" : "ETA berhasil dihapus");
      router.refresh();
    });
  };

  return (
    <div className="min-w-0 space-y-3">
      <div className="flex min-w-0 items-baseline gap-2 rounded-md border bg-muted/20 px-3 py-2">
        <CalendarClock
          className="size-4 shrink-0 translate-y-0.5 text-muted-foreground"
          aria-hidden="true"
        />
        <span className="shrink-0 text-xs text-muted-foreground">Saat ini</span>
        <span className="min-w-0 break-words text-sm font-medium">
          {formatEstimate(currentEstimate)}
        </span>
      </div>

      <div className="min-w-0 space-y-1.5">
        <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-2">
          <Label htmlFor={`estimated-done-${serviceOrderId}`}>ETA</Label>
          <span className="text-xs text-muted-foreground">
            Terlihat oleh pelanggan
          </span>
        </div>
        <Input
          id={`estimated-done-${serviceOrderId}`}
          type="datetime-local"
          value={inputValue}
          onChange={(event) => setInputValue(event.target.value)}
          disabled={isPending}
          className="min-w-0"
        />
      </div>

      {/* Wraps on its own instead of switching at a viewport breakpoint: this
          card sits in a ~380px sidebar even when the viewport is wide. */}
      <div className="flex min-w-0 flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          onClick={() => submit(inputValue)}
          disabled={isPending || !inputValue}
          className="min-h-10 flex-1 basis-36"
        >
          {isPending ? (
            <Loader2 data-icon="inline-start" className="animate-spin" />
          ) : (
            <Save data-icon="inline-start" />
          )}
          Simpan perkiraan
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => submit(null)}
          disabled={isPending || (!currentEstimate && !inputValue)}
          className="min-h-10 flex-1 basis-24"
        >
          <X data-icon="inline-start" />
          Hapus
        </Button>
      </div>
    </div>
  );
}
