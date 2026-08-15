import type { Dispatch, SetStateAction } from "react";
import { useRef } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";

import { CatalogOrManualItemPicker } from "@/app/[locale]/(routes)/mektek/_components/CatalogOrManualItemPicker";
import SupplierNameCombobox from "@/app/[locale]/(routes)/mektek/_components/SupplierNameCombobox";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getCatalogInventoryLocalDateKey } from "@/lib/mektek/catalog-inventory";
import type {
  CatalogOption,
  ItemDraft,
  OutboundDraft,
} from "./OutboundLogisticsManager";

export type CreateOutboundPurchaseOrderDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft: OutboundDraft;
  setDraft: Dispatch<SetStateAction<OutboundDraft>>;
  updateDraft: <K extends keyof OutboundDraft>(
    key: K,
    value: OutboundDraft[K],
  ) => void;
  submitPurchaseOrder: () => void;
  supplierNameSuggestions: string[];
  catalogItems: CatalogOption[];
  selectedCatalogItemIds: ReadonlySet<string>;
  isPending: boolean;
  switchItemSource: (clientId: string, source: ItemDraft["source"]) => void;
  updateCatalogQuery: (clientId: string, catalogQuery: string) => void;
  selectCatalogItem: (
    clientId: string,
    catalogItem: Pick<CatalogOption, "id" | "description" | "partNumber">,
  ) => void;
  updateItem: <K extends Exclude<keyof ItemDraft, "clientId">>(
    clientId: string,
    key: K,
    value: ItemDraft[K],
  ) => void;
  addItem: () => void;
  hasInvalidCreateItems: boolean;
  customerPoFile: File | null;
  customerPoError: string | null;
  selectCustomerPoFile: (file: File | null) => void;
};

export function CreateOutboundPurchaseOrderDialog({
  open,
  onOpenChange,
  draft,
  setDraft,
  updateDraft,
  submitPurchaseOrder,
  supplierNameSuggestions,
  catalogItems,
  selectedCatalogItemIds,
  isPending,
  switchItemSource,
  updateCatalogQuery,
  selectCatalogItem,
  updateItem,
  addItem,
  hasInvalidCreateItems,
  customerPoFile,
  customerPoError,
  selectCustomerPoFile,
}: CreateOutboundPurchaseOrderDialogProps) {
  const customerPoInputRef = useRef<HTMLInputElement>(null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus data-icon="inline-start" />
          Buat PO Pengiriman
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>Buat Monitoring PO</DialogTitle>
          <DialogDescription>
            Pilih item dari Catalog untuk dikirim ke User / PT.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-5"
          onSubmit={(event) => {
            event.preventDefault();
            submitPurchaseOrder();
          }}
        >
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="outbound-po-number">PO No.</Label>
              <Input
                id="outbound-po-number"
                value={draft.poNumber}
                onChange={(event) => updateDraft("poNumber", event.target.value)}
                placeholder="Contoh: PO-USER-001"
                disabled={isPending}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="outbound-user">User / PT Tujuan</Label>
              <SupplierNameCombobox
                id="outbound-user"
                value={draft.userName}
                onChange={(value) => updateDraft("userName", value)}
                suggestions={supplierNameSuggestions}
                placeholder="Nama perusahaan penerima"
                disabled={isPending}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="outbound-project">Job Site / Project</Label>
              <Input
                id="outbound-project"
                value={draft.projectName}
                onChange={(event) => updateDraft("projectName", event.target.value)}
                placeholder="Lokasi atau project tujuan"
                disabled={isPending}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="outbound-po-type">Tipe PO</Label>
              <Select
                value={draft.poType}
                onValueChange={(value) => updateDraft("poType", value)}
                disabled={isPending}
              >
                <SelectTrigger id="outbound-po-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Manual">Normal</SelectItem>
                  <SelectItem value="Consignment">Consignment</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="outbound-input-date">Tanggal Terima PO</Label>
              <Input
                id="outbound-input-date"
                type="date"
                max={getCatalogInventoryLocalDateKey()}
                value={draft.inputDate}
                onChange={(event) => {
                  const next = event.target.value;
                  setDraft((current) => ({
                    ...current,
                    inputDate: next,
                    dueDate: next > current.dueDate ? next : current.dueDate,
                  }));
                }}
                disabled={isPending}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="outbound-due-date">Due Date</Label>
              <Input
                id="outbound-due-date"
                type="date"
                min={draft.inputDate}
                value={draft.dueDate}
                onChange={(event) =>
                  updateDraft("dueDate", event.target.value)
                }
                disabled={isPending}
                required
              />
            </div>
          </div>

          <fieldset className="space-y-4 rounded-xl border bg-muted/15 p-4 sm:p-5">
            <legend className="sr-only">Item yang dikirim</legend>
            <div className="flex items-center gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-semibold text-primary">
                {draft.items.length}
              </span>
              <p className="font-semibold">Item yang dikirim</p>
            </div>
            <div className="space-y-4">
              {draft.items.map((item, index) => {
                return (
                  <fieldset
                    key={item.clientId}
                    className="overflow-visible rounded-xl border bg-background shadow-sm"
                  >
                    <legend className="sr-only">Item {index + 1}</legend>
                    <div className="flex items-center justify-between gap-3 rounded-t-xl border-b bg-muted/25 px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="flex size-7 items-center justify-center rounded-full bg-foreground text-xs font-semibold text-background">
                          {index + 1}
                        </span>
                        <p className="text-sm font-semibold">Detail Item</p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() =>
                          setDraft((current) => ({
                            ...current,
                            items: current.items.filter(
                              (line) => line.clientId !== item.clientId,
                            ),
                          }))
                        }
                        disabled={isPending || draft.items.length === 1}
                        aria-label={`Hapus Item ${index + 1}`}
                      >
                        <Trash2 aria-hidden="true" />
                      </Button>
                    </div>

                    <div className="space-y-4 p-4">
                      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_9rem] lg:items-start">
                        <CatalogOrManualItemPicker
                          idPrefix={`outbound-${item.clientId}`}
                          itemNumber={index + 1}
                          source={item.source}
                          catalogItemId={item.catalogItemId}
                          catalogQuery={item.catalogQuery}
                          partName={item.partName}
                          partNumber={item.partNumber}
                          catalogItems={catalogItems}
                          excludedCatalogItemIds={selectedCatalogItemIds}
                          disabled={isPending}
                          hideManual
                          catalogStockMessage="Stok berkurang saat Barang Keluar dicatat."
                          onSourceChange={(source) =>
                            switchItemSource(item.clientId, source)
                          }
                          onCatalogQueryChange={(query) =>
                            updateCatalogQuery(item.clientId, query)
                          }
                          onCatalogItemSelect={(catalogItem) =>
                            selectCatalogItem(item.clientId, catalogItem)
                          }
                          onPartNameChange={(value) =>
                            updateItem(item.clientId, "partName", value)
                          }
                          onPartNumberChange={(value) =>
                            updateItem(item.clientId, "partNumber", value)
                          }
                        />

                        <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
                          <Label htmlFor={`outbound-qty-${item.clientId}`}>
                            QTY Order
                          </Label>
                          <Input
                            id={`outbound-qty-${item.clientId}`}
                            className="h-11 bg-background font-mono text-base"
                            type="number"
                            inputMode="numeric"
                            min={1}
                            value={item.orderedQuantity}
                            onChange={(event) =>
                              updateItem(
                                item.clientId,
                                "orderedQuantity",
                                event.target.value,
                              )
                            }
                            disabled={isPending}
                            required
                          />
                        </div>

                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor={`outbound-note-${item.clientId}`}>
                          Keterangan Item{" "}
                          <span className="font-normal text-muted-foreground">
                            (opsional)
                          </span>
                        </Label>
                        <Textarea
                          id={`outbound-note-${item.clientId}`}
                          className="min-h-20 resize-y"
                          rows={2}
                          value={item.note}
                          maxLength={500}
                          onChange={(event) =>
                            updateItem(
                              item.clientId,
                              "note",
                              event.target.value,
                            )
                          }
                          placeholder="Keterangan khusus item pada Surat Jalan"
                          disabled={isPending}
                        />
                      </div>
                    </div>
                  </fieldset>
                );
              })}
              <Button
                type="button"
                variant="outline"
                onClick={addItem}
                disabled={isPending || draft.items.length >= 100}
                className="w-full border-dashed"
              >
                <Plus data-icon="inline-start" />
                Tambah Item
              </Button>
            </div>
          </fieldset>
          <div className="space-y-2 rounded-lg border bg-muted/20 p-4">
            <Label htmlFor="outbound-customer-po">
              PO dari Customer{" "}
              <span className="font-normal text-muted-foreground">
                (opsional)
              </span>
            </Label>
            <p className="text-xs text-muted-foreground">
              Unggah PDF atau gambar PO yang diterima dari Customer.
              Bisa diunggah nanti pada Detail PO.
            </p>
            <input
              ref={customerPoInputRef}
              id="outbound-customer-po"
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              onChange={(event) =>
                selectCustomerPoFile(event.target.files?.[0] ?? null)
              }
              disabled={isPending}
              className="block w-full text-sm file:mr-3 file:rounded-md file:border file:border-input file:bg-background file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-accent"
            />
            {customerPoFile && (
              <p className="text-xs text-muted-foreground">
                Terpilih: {customerPoFile.name}
              </p>
            )}
            {customerPoError && (
              <p className="text-xs text-destructive">{customerPoError}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="outbound-notes">Catatan PO</Label>
            <Textarea
              id="outbound-notes"
              value={draft.notes}
              maxLength={500}
              onChange={(event) => updateDraft("notes", event.target.value)}
              disabled={isPending}
            />
          </div>
          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={isPending || hasInvalidCreateItems}
            >
              {isPending && <Loader2 className="animate-spin" />}
              Simpan Monitoring PO
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
