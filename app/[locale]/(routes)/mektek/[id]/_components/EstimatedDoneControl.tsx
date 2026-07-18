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
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en-ID", {
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
        toast.error("Choose a valid estimated date and time");
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
        toast.error(result?.error || "Failed to update estimated done time");
        return;
      }

      const savedEstimate = result.data.estimatedDone;
      setCurrentEstimate(savedEstimate);
      setInputValue(toLocalInputValue(savedEstimate));
      toast.success(savedEstimate ? "Estimated completion updated" : "Estimate cleared");
      router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-md border bg-muted/20 p-3">
        <CalendarClock className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <div>
          <p className="text-xs text-muted-foreground">Current estimate</p>
          <p className="text-sm font-medium">{formatEstimate(currentEstimate)}</p>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`estimated-done-${serviceOrderId}`}>Estimated done time</Label>
        <Input
          id={`estimated-done-${serviceOrderId}`}
          type="datetime-local"
          value={inputValue}
          onChange={(event) => setInputValue(event.target.value)}
          disabled={isPending}
        />
        <p className="text-xs text-muted-foreground">
          The customer schedule updates as soon as you save.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          onClick={() => submit(inputValue)}
          disabled={isPending || !inputValue}
        >
          {isPending ? (
            <Loader2 data-icon="inline-start" className="animate-spin" />
          ) : (
            <Save data-icon="inline-start" />
          )}
          Save estimate
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => submit(null)}
          disabled={isPending || (!currentEstimate && !inputValue)}
        >
          <X data-icon="inline-start" />
          Clear
        </Button>
      </div>
    </div>
  );
}
