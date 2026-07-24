"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Send } from "lucide-react";
import { toast } from "sonner";

import {
  addMektekTimelineEntry,
  appendMektekServiceOrderItems,
} from "@/actions/mektek/service-orders";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { haveRequiredMektekItemInputPrices } from "@/lib/mektek/items";
import DamageItemsInput, {
  type DamageItem,
} from "../../_components/DamageItemsInput";

interface ServiceOrderItemsEditorProps {
  serviceOrderId: string;
  initialSparepartItems: DamageItem[];
}

export default function ServiceOrderItemsEditor({
  serviceOrderId,
  initialSparepartItems,
}: ServiceOrderItemsEditorProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [serviceItems, setServiceItems] = useState<DamageItem[]>([]);
  const [sparepartItems, setSparepartItems] = useState<DamageItem[]>(
    initialSparepartItems,
  );
  const [timelineDraft, setTimelineDraft] = useState("");

  const submit = () => {
    const validServiceItems = serviceItems.filter((item) => item.description.trim());
    const validSparepartItems = sparepartItems.filter((item) => item.description.trim());
    if (!haveRequiredMektekItemInputPrices(validServiceItems)) {
      toast.error(
        "Estimasi biaya wajib diisi untuk setiap deskripsi servis",
      );
      return;
    }

    if (!haveRequiredMektekItemInputPrices(validSparepartItems)) {
      toast.error("Estimasi biaya wajib diisi untuk setiap sparepart");
      return;
    }
    const sparepartWithoutWarehouse = validSparepartItems.find(
      (item) => item.catalogItemId && !item.stockWarehouse,
    );
    if (sparepartWithoutWarehouse) {
      toast.error(`Pilih gudang untuk sparepart ${sparepartWithoutWarehouse.description}`);
      return;
    }

    startTransition(async () => {
      const result = await appendMektekServiceOrderItems({
        serviceOrderId,
        serviceItems: validServiceItems,
        sparepartItems: validSparepartItems,
        replaceSparepartItems: true,
      });
      if (!result || "error" in result) {
        toast.error(result?.error || "Gagal menambahkan item pesanan");
        return;
      }

      setServiceItems([]);
      setTimelineDraft(result.data.timelineDraft);
      toast.success("Item pesanan dan total pembayaran diperbarui");
      router.refresh();
    });
  };

  const sendTimelineDraft = () => {
    if (!timelineDraft.trim()) return;
    startTransition(async () => {
      const result = await addMektekTimelineEntry({
        serviceOrderId,
        description: timelineDraft,
      });
      if (!result || "error" in result) {
        toast.error(result?.error || "Gagal mengirim update Timeline");
        return;
      }
      setTimelineDraft("");
      toast.success("Update berhasil dikirim ke Timeline");
      router.refresh();
    });
  };

  return (
    <div className="min-w-0 space-y-5">
      <Separator />
      <div>
        <p className="text-sm font-semibold">Kelola servis dan sparepart</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Harga baru langsung ditambahkan ke invoice dan total pembayaran akhir.
        </p>
      </div>

      <div className="grid min-w-0 gap-4">
        <DamageItemsInput
          items={serviceItems}
          onChange={setServiceItems}
          label="Deskripsi Servis Tambahan"
          addLabel="Tambah deskripsi servis"
          emptyMessage="Belum ada deskripsi servis tambahan."
          descriptionPlaceholder={(index) => `Deskripsi servis ${index + 1}`}
          minimumItems={0}
          disabled={isPending}
        />
        <DamageItemsInput
          items={sparepartItems}
          onChange={setSparepartItems}
          label="Daftar Sparepart"
          itemLabel="Sparepart"
          descriptionLabel="Nama sparepart"
          addLabel="Tambah sparepart"
          emptyMessage="Belum ada sparepart."
          descriptionPlaceholder={(index) => `Sparepart ${index + 1}`}
          minimumItems={0}
          disabled={isPending}
          catalogSearch
        />
      </div>

      <div className="flex flex-col sm:flex-row sm:justify-end">
        <Button
          type="button"
          onClick={submit}
          disabled={isPending}
          className="w-full sm:w-auto"
        >
          {isPending ? (
            <Loader2 data-icon="inline-start" className="animate-spin" />
          ) : (
            <Plus data-icon="inline-start" />
          )}
          Simpan perubahan
        </Button>
      </div>

      {timelineDraft && (
        <div className="space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
          <div>
            <p className="text-sm font-semibold">Template update Timeline siap</p>
            <p className="text-xs text-muted-foreground">
              Periksa pesannya lalu klik kirim agar pelanggan tidak melewatkan perubahan.
            </p>
          </div>
          <Textarea
            value={timelineDraft}
            onChange={(event) => setTimelineDraft(event.target.value)}
            disabled={isPending}
          />
          <Button type="button" onClick={sendTimelineDraft} disabled={isPending}>
            {isPending ? (
              <Loader2 data-icon="inline-start" className="animate-spin" />
            ) : (
              <Send data-icon="inline-start" />
            )}
            Kirim update ke Timeline
          </Button>
        </div>
      )}
    </div>
  );
}
