"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import { addMektekTimelineEntry } from "@/actions/mektek/service-orders";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import WhatsAppNotifyToggle from "./WhatsAppNotifyToggle";

interface AddTimelineEntryFormProps {
  serviceOrderId: string;
}

export default function AddTimelineEntryForm({
  serviceOrderId,
}: AddTimelineEntryFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [description, setDescription] = useState("");

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    startTransition(async () => {
      const result = await addMektekTimelineEntry({
        serviceOrderId,
        description,
      });

      if (result?.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Entri Timeline ditambahkan");
      setDescription("");
      router.refresh();
    });
  };

  return (
    <form
      onSubmit={onSubmit}
      className="min-w-0 space-y-3 rounded-lg border bg-card p-3 sm:p-4"
    >
      <div>
        <p className="text-sm font-semibold">Add Timeline</p>
        <p className="text-xs text-muted-foreground">
          Tambahkan catatan terbaru ke riwayat pesanan.
        </p>
      </div>
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row">
        <Input
          placeholder="Contoh: Sparepart sudah dipasang"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          disabled={isPending}
          required
          className="min-w-0"
        />
        <Button
          type="submit"
          className="w-full shrink-0 sm:w-auto"
          disabled={isPending}
        >
          {isPending ? "Menyimpan..." : "Add Timeline"}
        </Button>
      </div>
      <WhatsAppNotifyToggle />
    </form>
  );
}
