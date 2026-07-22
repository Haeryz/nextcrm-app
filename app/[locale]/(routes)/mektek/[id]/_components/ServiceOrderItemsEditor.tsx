"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { appendMektekServiceOrderItems } from "@/actions/mektek/service-orders";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { haveRequiredMektekItemInputPrices } from "@/lib/mektek/items";
import DamageItemsInput, {
  type DamageItem,
} from "../../_components/DamageItemsInput";

interface ServiceOrderItemsEditorProps {
  serviceOrderId: string;
}

export default function ServiceOrderItemsEditor({
  serviceOrderId,
}: ServiceOrderItemsEditorProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [serviceItems, setServiceItems] = useState<DamageItem[]>([]);
  const [sparepartItems, setSparepartItems] = useState<DamageItem[]>([]);

  const submit = () => {
    const validServiceItems = serviceItems.filter((item) => item.description.trim());
    const validSparepartItems = sparepartItems.filter((item) => item.description.trim());
    if (validServiceItems.length === 0 && validSparepartItems.length === 0) {
      toast.error("Tambahkan minimal satu item servis atau sparepart");
      return;
    }

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

    startTransition(async () => {
      const result = await appendMektekServiceOrderItems({
        serviceOrderId,
        serviceItems: validServiceItems,
        sparepartItems: validSparepartItems,
      });
      if (!result || "error" in result) {
        toast.error(result?.error || "Gagal menambahkan item pesanan");
        return;
      }

      setServiceItems([]);
      setSparepartItems([]);
      toast.success("Item pesanan dan total pembayaran diperbarui");
      router.refresh();
    });
  };

  return (
    <div className="space-y-5">
      <Separator />
      <div>
        <p className="text-sm font-semibold">Tambah servis atau sparepart</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Harga baru langsung ditambahkan ke invoice dan total pembayaran akhir.
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
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
          label="Sparepart Tambahan"
          addLabel="Tambah sparepart"
          emptyMessage="Belum ada sparepart tambahan."
          descriptionPlaceholder={(index) => `Sparepart ${index + 1}`}
          disabled={isPending}
          catalogSearch
        />
      </div>

      <div className="flex justify-end">
        <Button type="button" onClick={submit} disabled={isPending}>
          {isPending ? (
            <Loader2 data-icon="inline-start" className="animate-spin" />
          ) : (
            <Plus data-icon="inline-start" />
          )}
          Tambahkan ke pesanan
        </Button>
      </div>
    </div>
  );
}
