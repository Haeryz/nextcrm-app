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
import type { ReceivingEditDraft, ReceivingEditItemDraft } from "./ReceivingManager";

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

export type EditPurchaseOrderReceivingDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editDraft: ReceivingEditDraft | null;
  setEditDraft: Dispatch<SetStateAction<ReceivingEditDraft | null>>;
  setEditingPurchaseOrderId: (value: string | null) => void;
  isSavingEdit: boolean;
  isPending: boolean;
  submitEditedPurchaseOrder: () => void;
  updateEditItem: <K extends keyof ReceivingEditItemDraft>(
    itemId: string,
    key: K,
    value: ReceivingEditItemDraft[K],
  ) => void;
  addEditItem: () => void;
  removeEditItem: (clientId: string) => void;
  switchEditItemSource: (
    clientId: string,
    source: ReceivingEditItemDraft["source"],
  ) => void;
  updateEditCatalogQuery: (clientId: string, catalogQuery: string) => void;
  selectEditCatalogItem: (
    clientId: string,
    catalogItem: {
      id: string;
      description: string;
      partNumber: string | null;
      price?: number | null;
    },
  ) => void;
  editPurchaseOrderTotal: number;
  hasInvalidEditItems: boolean;
  selectedEditCatalogItemIds: ReadonlySet<string>;
  catalogItems: CatalogItemSummary[];
  supplierNameSuggestions: string[];
};

export function EditPurchaseOrderReceivingDialog({
  open,
  onOpenChange,
  editDraft,
  setEditDraft,
  setEditingPurchaseOrderId,
  isSavingEdit,
  isPending,
  submitEditedPurchaseOrder,
  updateEditItem,
  addEditItem,
  removeEditItem,
  switchEditItemSource,
  updateEditCatalogQuery,
  selectEditCatalogItem,
  editPurchaseOrderTotal,
  hasInvalidEditItems,
  selectedEditCatalogItemIds,
  catalogItems,
  supplierNameSuggestions,
}: EditPurchaseOrderReceivingDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>Edit Purchase Order Receiving</DialogTitle>
            <DialogDescription>
              Perbarui data PO, harga supplier, QTY Order, tambah, atau hapus
              item. Item yang sudah memiliki barang masuk tidak dapat dihapus
              dan QTY tidak boleh kurang dari barang masuk.
            </DialogDescription>
          </DialogHeader>
          {editDraft && (
            <form
              className="space-y-5"
              onSubmit={(event) => {
                event.preventDefault();
                submitEditedPurchaseOrder();
              }}
            >
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="edit-receiving-po-number">PO No.</Label>
                  <Input
                    id="edit-receiving-po-number"
                    value={editDraft.poNumber}
                    onChange={(event) =>
                      setEditDraft((current) => current && ({
                        ...current,
                        poNumber: event.target.value,
                      }))
                    }
                    disabled={isSavingEdit}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-receiving-supplier">Supplier / tujuan PO</Label>
                  <SupplierNameCombobox
                    id="edit-receiving-supplier"
                    value={editDraft.supplierName}
                    onChange={(value) =>
                      setEditDraft((current) => current && ({
                        ...current,
                        supplierName: value,
                      }))
                    }
                    suggestions={supplierNameSuggestions}
                    placeholder="Nama supplier"
                    disabled={isSavingEdit}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-receiving-project">Job Site / Project</Label>
                  <Input
                    id="edit-receiving-project"
                    value={editDraft.projectName}
                    onChange={(event) =>
                      setEditDraft((current) => current && ({
                        ...current,
                        projectName: event.target.value,
                      }))
                    }
                    disabled={isSavingEdit}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-receiving-input-date">Tanggal Create</Label>
                  <Input
                    id="edit-receiving-input-date"
                    type="date"
                    value={editDraft.inputDate}
                    onChange={(event) => {
                      const next = event.target.value;
                      setEditDraft((current) => current && ({
                        ...current,
                        inputDate: next,
                        dueDate: next,
                      }));
                    }}
                    disabled={isSavingEdit}
                    required
                  />
                </div>
              </div>

              <fieldset className="space-y-4 rounded-xl border bg-muted/15 p-4 sm:p-5">
                <legend className="sr-only">Item yang dipesan</legend>
                <div>
                  <h3 className="font-medium">Item yang dipesan</h3>
                  <p className="text-xs text-muted-foreground">
                    Tambah atau hapus item. Item yang sudah memiliki barang
                    masuk tidak dapat dihapus.
                  </p>
                </div>
                <div className="space-y-4">
                  {editDraft.items.map((item, index) => {
                    const minimumQuantity = Math.max(1, item.receivedQuantity);
                    const canRemoveEditItem =
                      item.receivedQuantity === 0;
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
                            {item.isNew && (
                              <Badge variant="secondary">Baru</Badge>
                            )}
                            {item.source === "MANUAL" && (
                              <Badge variant="secondary">Manual</Badge>
                            )}
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="text-muted-foreground hover:text-destructive"
                            onClick={() => removeEditItem(item.clientId)}
                            disabled={isSavingEdit || !canRemoveEditItem}
                            aria-label={`Hapus Item ${index + 1}`}
                            title={
                              canRemoveEditItem
                                ? "Hapus item"
                                : "Item sudah memiliki barang masuk"
                            }
                          >
                            <Trash2 aria-hidden="true" />
                          </Button>
                        </div>

                        <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_10rem] lg:items-start">
                          <div className="space-y-4">
                            {item.isNew ? (
                              <>
                                <CatalogOrManualItemPicker
                                  idPrefix={`edit-receiving-${item.clientId}`}
                                  itemNumber={index + 1}
                                  source={item.source}
                                  catalogItemId={item.catalogItemId}
                                  catalogQuery={item.catalogQuery}
                                  partName={item.partName}
                                  partNumber={item.partNumber}
                                  catalogItems={catalogItems}
                                  excludedCatalogItemIds={selectedEditCatalogItemIds}
                                  disabled={isSavingEdit}
                                  requireManualPartNumber={false}
                                  catalogStockMessage="Stok bertambah otomatis saat diterima."
                                  manualStockMessage="Item manual otomatis ditambahkan ke Catalog / Item."
                                  onSourceChange={(source) =>
                                    switchEditItemSource(item.clientId, source)
                                  }
                                  onCatalogQueryChange={(query) =>
                                    updateEditCatalogQuery(item.clientId, query)
                                  }
                                  onCatalogItemSelect={(catalogItem) =>
                                    selectEditCatalogItem(item.clientId, catalogItem)
                                  }
                                  onPartNameChange={(value) =>
                                    updateEditItem(item.clientId, "partName", value)
                                  }
                                  onPartNumberChange={(value) =>
                                    updateEditItem(item.clientId, "partNumber", value)
                                  }
                                />
                                {item.source === "MANUAL" && (
                                  <div className="grid gap-4 rounded-lg border bg-muted/20 p-3 sm:grid-cols-2">
                                    <div className="space-y-2">
                                      <Label htmlFor={`edit-receiving-machine-${item.clientId}`}>
                                        Mesin
                                      </Label>
                                      <Input
                                        id={`edit-receiving-machine-${item.clientId}`}
                                        value={item.machine}
                                        onChange={(event) =>
                                          updateEditItem(
                                            item.clientId,
                                            "machine",
                                            event.target.value,
                                          )
                                        }
                                        placeholder="Contoh: Komatsu PC200"
                                        disabled={isSavingEdit}
                                        required
                                      />
                                    </div>
                                    <div className="space-y-2">
                                      <Label htmlFor={`edit-receiving-warehouse-${item.clientId}`}>
                                        Gudang Tujuan
                                      </Label>
                                      <Select
                                        value={item.warehouse || "REAR"}
                                        onValueChange={(value: "REAR" | "FRONT") =>
                                          updateEditItem(item.clientId, "warehouse", value)
                                        }
                                        disabled={isSavingEdit}
                                      >
                                        <SelectTrigger
                                          id={`edit-receiving-warehouse-${item.clientId}`}
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
                              </>
                            ) : (
                              <>
                                <div className="space-y-1">
                                  <p className="font-medium">{item.partName}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {item.partNumber || "Tanpa Part Number"}
                                    {item.machine ? ` · ${item.machine}` : ""}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    QTY Masuk {item.receivedQuantity}
                                  </p>
                                </div>
                                <div className="space-y-1.5">
                                  <Label htmlFor={`edit-receiving-note-${item.clientId}`}>
                                    Keterangan Item
                                    <span className="ml-1 font-normal text-muted-foreground">
                                      (opsional)
                                    </span>
                                  </Label>
                                  <Input
                                    id={`edit-receiving-note-${item.clientId}`}
                                    value={item.note}
                                    maxLength={500}
                                    onChange={(event) =>
                                      updateEditItem(item.clientId, "note", event.target.value)
                                    }
                                    disabled={isSavingEdit}
                                  />
                                </div>
                                <div className="space-y-1.5">
                                  <Label htmlFor={`edit-receiving-warehouse-${item.clientId}`}>
                                    Gudang Tujuan
                                  </Label>
                                  <Select
                                    value={item.warehouse || "REAR"}
                                    onValueChange={(value: "REAR" | "FRONT") =>
                                      updateEditItem(item.clientId, "warehouse", value)
                                    }
                                    disabled={isSavingEdit}
                                  >
                                    <SelectTrigger
                                      id={`edit-receiving-warehouse-${item.clientId}`}
                                    >
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="REAR">Gudang Belakang</SelectItem>
                                      <SelectItem value="FRONT">Gudang Depan</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              </>
                            )}
                          </div>

                          <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
                            <Label htmlFor={`edit-receiving-qty-${item.clientId}`}>
                              QTY Order
                            </Label>
                            <Input
                              id={`edit-receiving-qty-${item.clientId}`}
                              className="h-11 bg-background font-mono text-base"
                              type="number"
                              inputMode="numeric"
                              min={minimumQuantity}
                              step={1}
                              value={item.orderedQuantity}
                              onChange={(event) =>
                                updateEditItem(
                                  item.clientId,
                                  "orderedQuantity",
                                  event.target.value,
                                )
                              }
                              disabled={isSavingEdit}
                              required
                            />
                            {item.receivedQuantity > 0 && (
                              <p className="text-xs text-muted-foreground">
                                Minimal {minimumQuantity}
                              </p>
                            )}
                            <Label htmlFor={`edit-receiving-price-${item.clientId}`}>
                              Harga Supplier
                            </Label>
                            <Input
                              id={`edit-receiving-price-${item.clientId}`}
                              className="h-11 bg-background font-mono text-base"
                              type="number"
                              inputMode="decimal"
                              min={0}
                              step="0.01"
                              value={item.unitPrice}
                              onChange={(event) =>
                                updateEditItem(
                                  item.clientId,
                                  "unitPrice",
                                  event.target.value,
                                )
                              }
                              disabled={isSavingEdit}
                              required
                            />
                            <Separator />
                            <div className="space-y-1">
                              <p className="text-xs text-muted-foreground">Jumlah</p>
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
                    onClick={addEditItem}
                    disabled={isSavingEdit || editDraft.items.length >= 100}
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
                  {formatRupiah(editPurchaseOrderTotal)}
                </span>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-receiving-notes">Catatan PO</Label>
                <Textarea
                  id="edit-receiving-notes"
                  value={editDraft.notes}
                  onChange={(event) =>
                    setEditDraft((current) => current && ({
                      ...current,
                      notes: event.target.value,
                    }))
                  }
                  placeholder="Catatan tambahan untuk supplier atau tim Purchasing"
                  disabled={isSavingEdit}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setEditingPurchaseOrderId(null);
                    setEditDraft(null);
                  }}
                  disabled={isSavingEdit}
                >
                  Batal
                </Button>
                <Button type="submit" disabled={isSavingEdit || hasInvalidEditItems}>
                  {isSavingEdit && (
                    <Loader2 data-icon="inline-start" className="animate-spin" />
                  )}
                  Simpan Perubahan
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
  );
}
