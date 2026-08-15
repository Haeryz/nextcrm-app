import type { Dispatch, SetStateAction } from "react";
import { Loader2, MessageCircle, Printer } from "lucide-react";

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
import { Separator } from "@/components/ui/separator";
import {
  getLogisticsItemProgress,
  getLogisticsStatusLabel,
} from "@/lib/mektek/logistics";
import type { LogisticsPurchaseOrderRow } from "./ReceivingManager";

const logisticsDateFormatter = new Intl.DateTimeFormat("id-ID", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

function formatDate(value: string) {
  return logisticsDateFormatter.format(new Date(value));
}

export type DetailPurchaseOrderDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activePurchaseOrder: LogisticsPurchaseOrderRow | null;
  documentPhone: string;
  setDocumentPhone: Dispatch<SetStateAction<string>>;
  isSendingDocument: boolean;
  sendDocument: () => void;
};

export function DetailPurchaseOrderDialog({
  open,
  onOpenChange,
  activePurchaseOrder,
  documentPhone,
  setDocumentPhone,
  isSendingDocument,
  sendDocument,
}: DetailPurchaseOrderDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Detail Purchase Order</DialogTitle>
          <DialogDescription>
            {activePurchaseOrder?.poNumber} · {activePurchaseOrder?.supplierName}
          </DialogDescription>
        </DialogHeader>

        {activePurchaseOrder && (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">Status</p>
                <Badge
                  className="mt-1"
                  variant={
                    activePurchaseOrder.status === "CLOSED" ? "secondary" : "outline"
                  }
                >
                  {getLogisticsStatusLabel(activePurchaseOrder.status)}
                </Badge>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">Job Site / Project</p>
                <p className="mt-1 font-medium">{activePurchaseOrder.projectName}</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">PO Type</p>
                <p className="mt-1 font-medium">{activePurchaseOrder.poType}</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">Tanggal Create</p>
                <p className="mt-1 font-medium">
                  {formatDate(activePurchaseOrder.inputDate)}
                </p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">Due Date</p>
                <p className="mt-1 font-medium">
                  {formatDate(activePurchaseOrder.dueDate)}
                </p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3 sm:col-span-2">
                <p className="text-xs text-muted-foreground">Dibuat oleh</p>
                <p className="mt-1 font-medium">
                  {activePurchaseOrder.createdBy || "Tidak diketahui"}
                </p>
              </div>
            </div>

            {activePurchaseOrder.notes && (
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Catatan PO</p>
                <p className="mt-1 text-sm whitespace-pre-wrap">
                  {activePurchaseOrder.notes}
                </p>
              </div>
            )}

            <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
              <div>
                <p className="text-sm font-semibold">PDF & WhatsApp</p>
                <p className="text-xs text-muted-foreground">
                  Masukkan nomor tujuan untuk mengirim file PO atau DO sebagai lampiran PDF.
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  aria-label="Nomor WhatsApp tujuan dokumen Receiving"
                  placeholder="Contoh: 0812 3456 7890"
                  value={documentPhone}
                  onChange={(event) => setDocumentPhone(event.target.value)}
                  inputMode="tel"
                  disabled={isSendingDocument}
                />
                <Button asChild type="button" variant="outline">
                  <a
                    href={`/api/mektek/logistics/purchase-orders/${encodeURIComponent(activePurchaseOrder.id)}/pdf`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Printer data-icon="inline-start" />
                    PDF PO
                  </a>
                </Button>
                <Button
                  type="button"
                  onClick={sendDocument}
                  disabled={isSendingDocument || !documentPhone.trim()}
                >
                  {isSendingDocument ? (
                    <Loader2 data-icon="inline-start" className="animate-spin" />
                  ) : (
                    <MessageCircle data-icon="inline-start" />
                  )}
                  WhatsApp PO
                </Button>
              </div>
            </div>

            <Separator />
            <div className="space-y-3">
              <h3 className="font-medium">Detail Part</h3>
              {activePurchaseOrder.items.map((item) => {
                const progress = getLogisticsItemProgress(item);

                return (
                  <div key={item.id} className="rounded-lg border">
                    <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium">{item.partName}</p>
                          {item.source === "MANUAL" && (
                            <Badge variant="outline">Manual</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {item.partNumber || "Tanpa Part Number"}
                        </p>
                      </div>
                      <Badge
                        variant={progress.status === "CLOSED" ? "secondary" : "outline"}
                      >
                        {getLogisticsStatusLabel(progress.status)}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-3 border-t bg-muted/30 text-center">
                      <div className="p-3">
                        <p className="text-xs text-muted-foreground">QTY Order</p>
                        <p className="font-mono font-semibold tabular-nums">
                          {progress.orderedQuantity}
                        </p>
                      </div>
                      <div className="border-x p-3">
                        <p className="text-xs text-muted-foreground">QTY Masuk</p>
                        <p className="font-mono font-semibold tabular-nums">
                          {progress.receivedQuantity}
                        </p>
                      </div>
                      <div className="p-3">
                        <p className="text-xs text-muted-foreground">QTY Sisa</p>
                        <p className="font-mono font-semibold tabular-nums">
                          {progress.remainingQuantity}
                        </p>
                      </div>
                    </div>
                    {item.receipts.length > 0 && (
                      <div className="space-y-2 border-t p-4">
                        <p className="text-xs font-medium text-muted-foreground">
                          Riwayat penerimaan
                        </p>
                        {item.receipts.map((receipt) => (
                          <div
                            key={receipt.id}
                            className="grid gap-2 text-sm sm:grid-cols-[120px_1fr_auto_auto] sm:items-center"
                          >
                            <span>{formatDate(receipt.receivedAt)}</span>
                            <span className="text-xs text-muted-foreground">
                              {receipt.warehouse === "FRONT"
                                ? "Gudang Depan"
                                : "Gudang Belakang"}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              PIC: {receipt.pic.name}
                            </span>
                            <span className="font-mono font-semibold tabular-nums">
                              +{receipt.quantity}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
