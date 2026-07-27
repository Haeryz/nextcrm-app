"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2, Save, Send } from "lucide-react";
import { toast } from "sonner";

import {
  addMektekTimelineEntry,
  appendMektekServiceOrderItems,
} from "@/actions/mektek/service-orders";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  // Saving always sends `replaceSparepartItems: true`, so any sparepart that is
  // no longer in the list is dropped from the invoice. That silently changed the
  // customer's bill, so removals now need an explicit confirmation.
  const [removalConfirmation, setRemovalConfirmation] = useState<string[] | null>(
    null,
  );

  const trackedSpareparts = useMemo(
    () =>
      initialSparepartItems
        .map((item, index) => ({
          key: item.clientId ?? `stored-sparepart-${index}`,
          description: item.description.trim(),
        }))
        .filter((item) => item.description),
    [initialSparepartItems],
  );

  const findRemovedSpareparts = (currentItems: DamageItem[]) => {
    const keptKeys = new Set(
      currentItems
        .map((item) => item.clientId)
        .filter((clientId): clientId is string => Boolean(clientId)),
    );
    return trackedSpareparts
      .filter((item) => !keptKeys.has(item.key))
      .map((item) => item.description);
  };

  const requestSubmit = () => {
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

    const removed = findRemovedSpareparts(validSparepartItems);
    if (removed.length > 0) {
      setRemovalConfirmation(removed);
      return;
    }

    submit();
  };

  const submit = () => {
    const validServiceItems = serviceItems.filter((item) => item.description.trim());
    const validSparepartItems = sparepartItems.filter((item) => item.description.trim());

    setRemovalConfirmation(null);
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
      <div className="min-w-0 space-y-4 rounded-xl border bg-muted/10 p-3 sm:p-4">
        <div>
          <p className="text-sm font-semibold">Perbarui item pesanan</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Servis baru akan ditambahkan ke pekerjaan yang sudah ada. Daftar
            sparepart di bawah menjadi kondisi terbaru dan langsung memperbarui
            invoice.
          </p>
        </div>

        <div className="grid min-w-0 gap-5">
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
          <Separator />
          <DamageItemsInput
            items={sparepartItems}
            onChange={setSparepartItems}
            label="Daftar Sparepart"
            itemLabel="Sparepart"
            descriptionLabel="Nama Sparepart / Part Number"
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
            onClick={requestSubmit}
            disabled={isPending}
            className="min-h-10 w-full sm:w-auto"
          >
            {isPending ? (
              <Loader2 data-icon="inline-start" className="animate-spin" />
            ) : (
              <Save data-icon="inline-start" />
            )}
            Simpan item pesanan
          </Button>
        </div>
      </div>

      {timelineDraft && (
        <div className="min-w-0 space-y-2 rounded-lg border border-primary/30 bg-primary/5 p-3 sm:p-4">
          <div>
            <p className="text-sm font-semibold">Template update Timeline siap</p>
            <p className="text-xs leading-5 text-muted-foreground">
              Periksa pesannya lalu klik kirim agar pelanggan tidak melewatkan perubahan.
            </p>
          </div>
          <Textarea
            value={timelineDraft}
            onChange={(event) => setTimelineDraft(event.target.value)}
            disabled={isPending}
            className="min-w-0"
          />
          <Button
            type="button"
            onClick={sendTimelineDraft}
            disabled={isPending}
            className="min-h-10 w-full sm:w-auto"
          >
            {isPending ? (
              <Loader2 data-icon="inline-start" className="animate-spin" />
            ) : (
              <Send data-icon="inline-start" />
            )}
            Kirim update ke Timeline
          </Button>
        </div>
      )}

      <Dialog
        open={removalConfirmation !== null}
        onOpenChange={(open) => {
          if (!open) setRemovalConfirmation(null);
        }}
      >
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-start gap-2 break-words text-left">
              <AlertTriangle
                className="mt-0.5 size-4 shrink-0 text-destructive"
                aria-hidden="true"
              />
              Hapus {removalConfirmation?.length ?? 0} sparepart dari pesanan?
            </DialogTitle>
            <DialogDescription className="text-left leading-5">
              Sparepart berikut akan dihapus dari invoice, total tagihan
              pelanggan ikut berubah, dan stok yang sudah dialokasikan
              dikembalikan ke gudang.
            </DialogDescription>
          </DialogHeader>

          <ul className="max-h-40 min-w-0 space-y-1 overflow-y-auto rounded-md border bg-muted/20 p-2 text-sm">
            {(removalConfirmation ?? []).map((description, index) => (
              <li
                key={`${description}-${index}`}
                className="break-words text-muted-foreground"
              >
                • {description}
              </li>
            ))}
          </ul>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setRemovalConfirmation(null)}
              disabled={isPending}
              className="min-h-10 w-full sm:w-auto"
            >
              Batal
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={submit}
              disabled={isPending}
              className="min-h-10 w-full sm:w-auto"
            >
              {isPending ? (
                <Loader2 data-icon="inline-start" className="animate-spin" />
              ) : null}
              Ya, hapus dan simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
