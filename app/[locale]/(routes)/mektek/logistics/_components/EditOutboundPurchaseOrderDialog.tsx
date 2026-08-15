import type { Dispatch, SetStateAction } from "react";
import { Loader2 } from "lucide-react";

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
import { Textarea } from "@/components/ui/textarea";
import { getCatalogInventoryLocalDateKey } from "@/lib/mektek/catalog-inventory";
import type { OutboundDraft, OutboundPurchaseOrder } from "./OutboundLogisticsManager";

export type EditOutboundPurchaseOrderDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editDraft: OutboundDraft | null;
  setEditDraft: Dispatch<SetStateAction<OutboundDraft | null>>;
  setEditingPurchaseOrderId: (value: string | null) => void;
  isPending: boolean;
  submitEditedPurchaseOrder: () => void;
  editingPurchaseOrder: OutboundPurchaseOrder | null;
};

export function EditOutboundPurchaseOrderDialog({
  open,
  onOpenChange,
  editDraft,
  setEditDraft,
  setEditingPurchaseOrderId,
  isPending,
  submitEditedPurchaseOrder,
  editingPurchaseOrder,
}: EditOutboundPurchaseOrderDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Edit PO</DialogTitle>
          <DialogDescription>
            Perbarui data Monitoring PO dan QTY Order. QTY tidak dapat lebih kecil
            dari barang yang sudah keluar.
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
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="edit-outbound-po-number">PO No.</Label>
                <Input
                  id="edit-outbound-po-number"
                  value={editDraft.poNumber}
                  onChange={(event) =>
                    setEditDraft((current) => current && ({ ...current, poNumber: event.target.value }))
                  }
                  disabled={isPending}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-outbound-user">User / PT Tujuan</Label>
                <Input
                  id="edit-outbound-user"
                  value={editDraft.userName}
                  onChange={(event) =>
                    setEditDraft((current) => current && ({ ...current, userName: event.target.value }))
                  }
                  disabled={isPending}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-outbound-project">Job Site / Project</Label>
                <Input
                  id="edit-outbound-project"
                  value={editDraft.projectName}
                  onChange={(event) =>
                    setEditDraft((current) => current && ({ ...current, projectName: event.target.value }))
                  }
                  disabled={isPending}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-outbound-po-type">Mode Supply</Label>
                <Select
                  value={editDraft.poType}
                  onValueChange={(poType) =>
                    setEditDraft((current) => current && ({ ...current, poType }))
                  }
                  disabled={isPending}
                >
                  <SelectTrigger id="edit-outbound-po-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Normal">Manual · PO satu kali</SelectItem>
                    <SelectItem value="Consignment">Konsinyasi · pasokan kontrak</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-outbound-input-date">Tanggal Pengiriman</Label>
                <Input
                  id="edit-outbound-input-date"
                  type="date"
                  max={getCatalogInventoryLocalDateKey()}
                  value={editDraft.inputDate}
                  onChange={(event) =>
                    setEditDraft((current) => current && ({ ...current, inputDate: event.target.value }))
                  }
                  disabled={isPending}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-outbound-due-date">Batas Waktu</Label>
                <Input
                  id="edit-outbound-due-date"
                  type="date"
                  min={editDraft.inputDate}
                  value={editDraft.dueDate}
                  onChange={(event) =>
                    setEditDraft((current) => current && ({ ...current, dueDate: event.target.value }))
                  }
                  disabled={isPending}
                  required
                />
              </div>
            </div>

            <fieldset className="space-y-3 rounded-xl border bg-muted/15 p-4">
              <legend className="sr-only">Item PO</legend>
              <div>
                <h3 className="font-medium">Item PO</h3>
                <p className="text-xs text-muted-foreground">
                  Nama item tetap agar riwayat Surat Jalan tidak terputus.
                </p>
              </div>
              {editDraft.items.map((item, index) => {
                const savedItem = editingPurchaseOrder?.items.find(
                  (candidate) => candidate.id === item.clientId,
                );
                const minimumQuantity = savedItem?.receivedQuantity ?? 0;
                return (
                  <div key={item.clientId} className="grid gap-3 rounded-lg border bg-background p-3 sm:grid-cols-[minmax(0,1fr)_9rem]">
                    <div className="space-y-2">
                      <div>
                        <p className="font-medium">{item.partName}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.partNumber || "Tanpa Part Number"} · QTY Keluar {minimumQuantity}
                        </p>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor={`edit-outbound-note-${item.clientId}`}>Keterangan Item</Label>
                        <Input
                          id={`edit-outbound-note-${item.clientId}`}
                          value={item.note}
                          maxLength={500}
                          onChange={(event) =>
                            setEditDraft((current) => current && ({
                              ...current,
                              items: current.items.map((line) =>
                                line.clientId === item.clientId
                                  ? { ...line, note: event.target.value }
                                  : line,
                              ),
                            }))
                          }
                          disabled={isPending}
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor={`edit-outbound-qty-${item.clientId}`}>QTY Order</Label>
                      <Input
                        id={`edit-outbound-qty-${item.clientId}`}
                        type="number"
                        inputMode="numeric"
                        min={Math.max(1, minimumQuantity)}
                        value={item.orderedQuantity}
                        onChange={(event) =>
                          setEditDraft((current) => current && ({
                            ...current,
                            items: current.items.map((line) =>
                              line.clientId === item.clientId
                                ? { ...line, orderedQuantity: event.target.value }
                                : line,
                            ),
                          }))
                        }
                        disabled={isPending}
                        required
                      />
                      <p className="text-xs text-muted-foreground">Minimal {Math.max(1, minimumQuantity)}</p>
                    </div>
                  </div>
                );
              })}
            </fieldset>

            <div className="space-y-1.5">
              <Label htmlFor="edit-outbound-notes">Catatan PO</Label>
              <Textarea
                id="edit-outbound-notes"
                value={editDraft.notes}
                maxLength={500}
                onChange={(event) =>
                  setEditDraft((current) => current && ({ ...current, notes: event.target.value }))
                }
                disabled={isPending}
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
                disabled={isPending}
              >
                Batal
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="animate-spin" />}
                Simpan Perubahan PO
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
