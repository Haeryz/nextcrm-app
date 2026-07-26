"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import { addMektekTimelineEntry } from "@/actions/mektek/service-orders";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
      className="min-w-0 space-y-2 rounded-lg border bg-card p-3 sm:p-4"
    >
      <p className="text-sm font-semibold">Add Timeline</p>
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
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
          className="min-h-10 w-full shrink-0 sm:w-auto"
          disabled={isPending}
        >
          {isPending ? "Menyimpan..." : "Add Timeline"}
        </Button>
      </div>
      {/* Honest replacement for the old WhatsApp checkbox, which was never
          wired to anything and claimed the integration was still offline. */}
      <p className="text-xs leading-5 text-muted-foreground">
        Catatan langsung tampil di halaman lacak pelanggan. Menyimpan catatan
        tidak mengirim WhatsApp — pesan otomatis hanya terkirim saat status
        pesanan berubah. Untuk mengabari pelanggan sekarang, pakai tab WhatsApp.
      </p>
    </form>
  );
}
