import type { Dispatch, SetStateAction } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";

import { CatalogOrManualItemPicker } from "@/app/[locale]/(routes)/mektek/_components/CatalogOrManualItemPicker";
import SupplierNameCombobox from "@/app/[locale]/(routes)/mektek/_components/SupplierNameCombobox";
import { Badge } from "@/components/ui/badge";
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
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import type { PurchaseOrderDraft, PurchaseOrderItemDraft } from "./ReceivingManager";

type CatalogItemSummary = {
  id: string;
  description: string;
  partNumber: string | null;
  price: number | null;
  rearStock: number;
  frontStock: number;
};

const rupiahFormatter = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

function formatRupiah(value: number) {
  return rupiahFormatter.format(value);
}

export type CreatePurchaseOrderDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  createValue: PurchaseOrderDraft;
  setCreateValue: Dispatch<SetStateAction<PurchaseOrderDraft>>;
  updateCreateValue: <K extends keyof PurchaseOrderDraft>(
    key: K,
    value: PurchaseOrderDraft[K],
  ) => void;
  submitPurchaseOrder: () => void;
  supplierNameSuggestions: string[];
  isPending: boolean;
  catalogItems: CatalogItemSummary[];
  selectedCatalogItemIds: ReadonlySet<string>;
  removeItem: (clientId: string) => void;
  switchItemSource: (clientId: string, source: "CATALOG" | "MANUAL") => void;
  updateCatalogQuery: (clientId: string, catalogQuery: string) => void;
  selectCatalogItem: (
    clientId: string,
    catalogItem: {
      id: string;
      description: string;
      partNumber: string | null;
      price?: number | null;
    },
  ) => void;
  updateItem: <K extends Exclude<keyof PurchaseOrderItemDraft, "clientId">>(
    clientId: string,
    key: K,
    value: PurchaseOrderItemDraft[K],
  ) => void;
  addItem: () => void;
  createPurchaseOrderTotal: number;
  hasInvalidCreateItems: boolean;
};

export function CreatePurchaseOrderDialog({
  open,
  onOpenChange,
  createValue,
  setCreateValue,
  updateCreateValue,
  submitPurchaseOrder,
  supplierNameSuggestions,
  isPending,
  catalogItems,
  selectedCatalogItemIds,
  removeItem,
  switchItemSource,
  updateCatalogQuery,
  selectCatalogItem,
  updateItem,
  addItem,
  createPurchaseOrderTotal,
  hasInvalidCreateItems,
}: CreatePurchaseOrderDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button className="min-w-0 flex-1 px-2 sm:flex-none sm:px-4">
          <Plus data-icon="inline-start" />
          <span className="sm:hidden">Buat PO</span>
          <span className="hidden sm:inline">Buat Purchase Order</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>Buat Purchase Order Receiving</DialogTitle>
          <DialogDescription>
            Masukkan seluruh Part yang diorder, termasuk barang yang belum ready dari supplier.
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
              <Label htmlFor="logistics-po-number">PO No.</Label>
              <Input
                id="logistics-po-number"
                value={createValue.poNumber}
                onChange={(event) => updateCreateValue("poNumber", event.target.value)}
                placeholder="Contoh: PO-MKT-001"
                disabled={isPending}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="logistics-supplier">Supplier / tujuan PO</Label>
              <SupplierNameCombobox
                id="logistics-supplier"
                value={createValue.supplierName}
                onChange={(value) => updateCreateValue("supplierName", value)}
                suggestions={supplierNameSuggestions}
                placeholder="Nama supplier"
                disabled={isPending}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="logistics-project">Job Site / Project</Label>
              <Input
                id="logistics-project"
                value={createValue.projectName}
                onChange={(event) =>
                  updateCreateValue("projectName", event.target.value)
                }
                placeholder="Nama job site atau project"
                disabled={isPending}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="logistics-input-date">Tanggal Create</Label>
              <Input
                id="logistics-input-date"
                type="date"
                value={createValue.inputDate}
                onChange={(event) => {
                  const next = event.target.value;
                  setCreateValue((current) => ({
                    ...current,
                    inputDate: next,
                    dueDate: next,
                  }));
                }}
                disabled={isPending}
                required
              />
            </div>
          </div>

          <fieldset className="space-y-4 rounded-xl border bg-muted/15 p-4 sm:p-5">
            <legend className="sr-only">Item yang dipesan</legend>
            <div className="flex items-center gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-semibold text-primary">
                {createValue.items.length}
              </span>
              <p className="font-semibold">Item yang dipesan</p>
            </div>
            <div className="space-y-4">
              {createValue.items.map((item, index) => {
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
                        {item.source === "MANUAL" && (
                          <Badge variant="secondary">Manual</Badge>
                        )}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => removeItem(item.clientId)}
                        disabled={isPending || createValue.items.length === 1}
                        aria-label={`Hapus Item ${index + 1}`}
                      >
                        <Trash2 aria-hidden="true" />
                      </Button>
                    </div>

                    <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_10rem] lg:items-start">
                      <div className="space-y-4">
                        <CatalogOrManualItemPicker
                          idPrefix={`receiving-${item.clientId}`}
                          itemNumber={index + 1}
                          source={item.source}
                          catalogItemId={item.catalogItemId}
                          catalogQuery={item.catalogQuery}
                          partName={item.partName}
                          partNumber={item.partNumber}
                          catalogItems={catalogItems}
                          excludedCatalogItemIds={selectedCatalogItemIds}
                          disabled={isPending}
                          requireManualPartNumber={false}
                          catalogStockMessage="Stok bertambah otomatis saat diterima."
                          manualStockMessage="Item manual otomatis ditambahkan ke Catalog / Item."
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
                        {item.source === "MANUAL" && (
                          <div className="grid gap-4 rounded-lg border bg-muted/20 p-3 sm:grid-cols-2">
                            <div className="space-y-2">
                              <Label htmlFor={`receiving-machine-${item.clientId}`}>
                                Mesin
                              </Label>
                              <Input
                                id={`receiving-machine-${item.clientId}`}
                                value={item.machine}
                                onChange={(event) =>
                                  updateItem(
                                    item.clientId,
                                    "machine",
                                    event.target.value,
                                  )
                                }
                                placeholder="Contoh: Komatsu PC200"
                                disabled={isPending}
                                required
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor={`receiving-warehouse-${item.clientId}`}>
                                Gudang Tujuan
                              </Label>
                              <Select
                                value={item.warehouse}
                                onValueChange={(value: "REAR" | "FRONT") =>
                                  updateItem(item.clientId, "warehouse", value)
                                }
                                disabled={isPending}
                              >
                                <SelectTrigger
                                  id={`receiving-warehouse-${item.clientId}`}
                                  aria-label="Gudang tujuan item manual"
                                >
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="REAR">
                                    Gudang Belakang
                                  </SelectItem>
                                  <SelectItem value="FRONT">
                                    Gudang Depan
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
                        <Label htmlFor={`logistics-qty-${item.clientId}`}>
                          QTY Order
                        </Label>
                        <Input
                          id={`logistics-qty-${item.clientId}`}
                          className="h-11 bg-background font-mono text-base"
                          type="number"
                          inputMode="numeric"
                          min={1}
                          step={1}
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
                        <Label htmlFor={`logistics-price-${item.clientId}`}>
                          Harga Supplier
                        </Label>
                        <Input
                          id={`logistics-price-${item.clientId}`}
                          className="h-11 bg-background font-mono text-base"
                          type="number"
                          inputMode="decimal"
                          min={0}
                          step="0.01"
                          value={item.unitPrice}
                          onChange={(event) =>
                            updateItem(
                              item.clientId,
                              "unitPrice",
                              event.target.value,
                            )
                          }
                          disabled={isPending}
                          required
                        />
                        <p className="text-xs text-muted-foreground">
                          Harga modal dari supplier. Harga jual diatur
                          terpisah di Catalog / Item setelah barang diterima.
                        </p>
                        <Separator />
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground">
                            Jumlah
                          </p>
                          <p className="font-mono font-semibold">
                            {formatRupiah(
                              (Number(item.orderedQuantity) || 0) *
                                (Number(item.unitPrice) || 0),
                            )}
                          </p>
                        </div>
                      </div>
                    </div>
                  </fieldset>
                );
              })}
              <Button
                type="button"
                variant="outline"
                onClick={addItem}
                disabled={isPending || createValue.items.length >= 100}
                className="w-full border-dashed"
              >
                <Plus data-icon="inline-start" />
                Tambah Item
              </Button>
            </div>
          </fieldset>

          <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-4">
            <span className="font-medium">Total Purchase Order</span>
            <span className="font-mono text-lg font-semibold">
              {formatRupiah(createPurchaseOrderTotal)}
            </span>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="logistics-notes">Catatan PO</Label>
            <Textarea
              id="logistics-notes"
              value={createValue.notes}
              onChange={(event) => updateCreateValue("notes", event.target.value)}
              placeholder="Catatan tambahan untuk supplier atau tim Purchasing"
              disabled={isPending}
            />
          </div>
          <div className="flex shrink-0 justify-end">
            <Button
              type="submit"
              disabled={isPending || hasInvalidCreateItems}
            >
              {isPending && <Loader2 data-icon="inline-start" className="animate-spin" />}
              Simpan Purchase Order
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
