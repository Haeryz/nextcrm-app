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
    <div className="space-y-4">
      <div className="flex min-w-0 items-start gap-3 rounded-md border bg-muted/20 p-3">
        <CalendarClock className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">Perkiraan saat ini</p>
          <p className="break-words text-sm font-medium">
            {formatEstimate(currentEstimate)}
          </p>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`estimated-done-${serviceOrderId}`}>ETA</Label>
        <Input
          id={`estimated-done-${serviceOrderId}`}
          type="datetime-local"
          value={inputValue}
          onChange={(event) => setInputValue(event.target.value)}
          disabled={isPending}
          className="min-w-0"
        />
        <p className="text-xs text-muted-foreground">
          Jadwal pelanggan langsung diperbarui setelah Anda menyimpan.
        </p>
      </div>

      <div className="flex flex-col gap-2 min-[400px]:flex-row min-[400px]:flex-wrap">
        <Button
          type="button"
          size="sm"
          onClick={() => submit(inputValue)}
          disabled={isPending || !inputValue}
          className="w-full min-[400px]:w-auto"
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
          className="w-full min-[400px]:w-auto"
        >
          <X data-icon="inline-start" />
          Hapus
        </Button>
      </div>
    </div>
  );
}
