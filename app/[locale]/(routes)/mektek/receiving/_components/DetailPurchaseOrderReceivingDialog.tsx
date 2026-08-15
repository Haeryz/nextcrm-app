import type { Dispatch, RefObject, SetStateAction } from "react";
import Link from "next/link";
import { Eye, Loader2, Pencil, Printer, ReceiptText, RefreshCw, Upload } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  getLogisticsItemProgress,
  getLogisticsStatusLabel,
} from "@/lib/mektek/logistics";
import { cn } from "@/lib/utils";
import { getCatalogInventoryLocalDateKey } from "@/lib/mektek/catalog-inventory";
import type {
  LogisticsPurchaseOrderRow,
  LogisticsReceiptItemDraft,
  LogisticsReceivingBatchGroup,
  ReceiptItemPhotoDraft,
} from "./ReceivingManager";

const logisticsDateFormatter = new Intl.DateTimeFormat("id-ID", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

function formatDate(value: string) {
  return logisticsDateFormatter.format(new Date(value));
}

const rupiahFormatter = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

function formatRupiah(value: number) {
  return rupiahFormatter.format(value);
}

type ReceiptDraftValue = { picId: string; receivedAt: string };
type ActiveProgressValue = {
  orderedQuantity: number;
  receivedQuantity: number;
  remainingQuantity: number;
};

export type DetailPurchaseOrderReceivingDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeReceiptPurchaseOrder: LogisticsPurchaseOrderRow | null;
  activeProgress: ActiveProgressValue | null;
  activePurchaseOrderTotal: number;
  activeReceivingBatches: LogisticsReceivingBatchGroup[];
  hasSelectedReceiptItems: boolean;
  receiptDraft: ReceiptDraftValue;
  setReceiptDraft: Dispatch<SetStateAction<ReceiptDraftValue>>;
  receiptItemDrafts: Record<string, LogisticsReceiptItemDraft>;
  receiptItemPhotos: Record<string, ReceiptItemPhotoDraft>;
  pics: Array<{ id: string; name: string }>;
  isPending: boolean;
  isSavingEdit: boolean;
  isSelectingDeliveryNoteSource: boolean;
  isCreatingMektekDeliveryNote: boolean;
  isUploadingDeliveryNote: boolean;
  isUploadingMektekDeliveryNote: boolean;
  isUploadingSignedPo: boolean;
  isUploadingSupplierInvoice: boolean;
  openEditPurchaseOrder: (purchaseOrder: LogisticsPurchaseOrderRow) => void;
  submitReceipt: () => void;
  updateReceiptItem: <K extends keyof LogisticsReceiptItemDraft>(
    itemId: string,
    key: K,
    value: LogisticsReceiptItemDraft[K],
  ) => void;
  selectExistingSupplierDeliveryNote: () => void;
  selectSupplierDeliveryNote: (file: File | null) => void;
  selectSupplierInvoice: (file: File | null) => void;
  selectMektekDeliveryNoteImage: (file: File | null) => void;
  selectSignedPoImage: (file: File | null) => void;
  selectReceiptItemPhoto: (itemId: string, file: File | null) => void;
  createMektekDeliveryNote: () => void;
  supplierInvoiceInputRef: RefObject<HTMLInputElement | null>;
  deliveryNoteInputRef: RefObject<HTMLInputElement | null>;
  mektekDeliveryNoteInputRef: RefObject<HTMLInputElement | null>;
  signedPoInputRef: RefObject<HTMLInputElement | null>;
};

export function DetailPurchaseOrderReceivingDialog({
  open,
  onOpenChange,
  activeReceiptPurchaseOrder,
  activeProgress,
  activePurchaseOrderTotal,
  activeReceivingBatches,
  hasSelectedReceiptItems,
  receiptDraft,
  setReceiptDraft,
  receiptItemDrafts,
  receiptItemPhotos,
  pics,
  isPending,
  isSavingEdit,
  isSelectingDeliveryNoteSource,
  isCreatingMektekDeliveryNote,
  isUploadingDeliveryNote,
  isUploadingMektekDeliveryNote,
  isUploadingSignedPo,
  isUploadingSupplierInvoice,
  openEditPurchaseOrder,
  submitReceipt,
  updateReceiptItem,
  selectExistingSupplierDeliveryNote,
  selectSupplierDeliveryNote,
  selectSupplierInvoice,
  selectMektekDeliveryNoteImage,
  selectSignedPoImage,
  selectReceiptItemPhoto,
  createMektekDeliveryNote,
  supplierInvoiceInputRef,
  deliveryNoteInputRef,
  mektekDeliveryNoteInputRef,
  signedPoInputRef,
}: DetailPurchaseOrderReceivingDialogProps) {
  const today = getCatalogInventoryLocalDateKey();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Detail Purchase Order Receiving</DialogTitle>
            <DialogDescription>
              {activeReceiptPurchaseOrder?.poNumber} ·{" "}
              {activeReceiptPurchaseOrder?.supplierName}
            </DialogDescription>
          </DialogHeader>

          {activeReceiptPurchaseOrder && activeProgress && (
            <div className="space-y-5">
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => openEditPurchaseOrder(activeReceiptPurchaseOrder)}
                  disabled={isPending || isSavingEdit}
                >
                  <Pencil data-icon="inline-start" /> Edit Purchase Order Receiving
                </Button>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground">Project</p>
                  <p className="mt-1 font-medium">
                    {activeReceiptPurchaseOrder.projectName}
                  </p>
                </div>
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground">Status</p>
                  <Badge
                    className="mt-1"
                    variant={
                      activeReceiptPurchaseOrder.status === "CLOSED"
                        ? "secondary"
                        : "outline"
                    }
                  >
                    {getLogisticsStatusLabel(activeReceiptPurchaseOrder.status)}
                  </Badge>
                </div>
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground">Supplier / tujuan PO</p>
                  <p className="mt-1 font-medium">
                    {activeReceiptPurchaseOrder.supplierName}
                  </p>
                </div>
              </div>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Dokumen Receiving</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Faktur dan Surat Jalan supplier hanya diunggah dari dokumen
                    yang diberikan supplier. Mektek hanya membuat PDF Purchase
                    Order dan Surat Jalan Mektek.
                  </p>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="grid gap-3 md:grid-cols-2">
                    <section className="space-y-3 rounded-lg border p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h4 className="font-medium">PDF Purchase Order</h4>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Cetak PO, minta ditandatangani, lalu unggah hasilnya.
                          </p>
                        </div>
                        <Badge variant="secondary">Tersedia</Badge>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button asChild type="button" variant="outline" size="sm">
                          <Link
                            href={`/api/mektek/logistics/purchase-orders/${encodeURIComponent(activeReceiptPurchaseOrder.id)}/pdf`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Printer data-icon="inline-start" />
                            Lihat PDF Purchase Order
                          </Link>
                        </Button>
                        {activeReceiptPurchaseOrder.hasSignedPoImage && (
                          <Button asChild type="button" size="sm" variant="outline">
                            <Link
                              href={`/api/mektek/logistics/purchase-orders/${encodeURIComponent(activeReceiptPurchaseOrder.id)}/signed-po-image`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <Eye data-icon="inline-start" />
                              Lihat PO ditandatangani
                            </Link>
                          </Button>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        PO ditandatangani:{" "}
                        {activeReceiptPurchaseOrder.hasSignedPoImage
                          ? "sudah diunggah"
                          : "belum diunggah"}
                      </p>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() =>
                          signedPoInputRef.current?.click()
                        }
                        disabled={isUploadingSignedPo}
                      >
                        {isUploadingSignedPo ? (
                          <Loader2
                            data-icon="inline-start"
                            className="animate-spin"
                          />
                        ) : (
                          <Upload data-icon="inline-start" />
                        )}
                        {activeReceiptPurchaseOrder.hasSignedPoImage
                          ? "Ganti PO yang Sudah Ditandatangani"
                          : "Unggah PO yang Sudah Ditandatangani"}
                      </Button>
                      <input
                        ref={signedPoInputRef}
                        className="sr-only"
                        type="file"
                        accept="image/jpeg,image/png,image/webp,application/pdf"
                        aria-label="Pilih PO yang sudah ditandatangani"
                        onChange={(event) => {
                          selectSignedPoImage(event.target.files?.[0] ?? null);
                          event.currentTarget.value = "";
                        }}
                      />
                    </section>

                    <section className="space-y-3 rounded-lg border p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h4 className="font-medium">Faktur dari Supplier</h4>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Hanya diunggah dari dokumen yang diberikan supplier.
                          </p>
                        </div>
                        <Badge
                          variant={
                            activeReceiptPurchaseOrder.hasSupplierInvoiceImage
                              ? "secondary"
                              : "outline"
                          }
                        >
                          {activeReceiptPurchaseOrder.hasSupplierInvoiceImage
                            ? "Sudah diunggah"
                            : "Belum diunggah"}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {activeReceiptPurchaseOrder.hasSupplierInvoiceImage && (
                          <Button asChild type="button" size="sm">
                            <Link
                              href={`/api/mektek/logistics/purchase-orders/${encodeURIComponent(activeReceiptPurchaseOrder.id)}/supplier-invoice-image`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <Eye data-icon="inline-start" />
                              Lihat Faktur
                            </Link>
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            supplierInvoiceInputRef.current?.click()
                          }
                          disabled={isUploadingSupplierInvoice}
                        >
                          {isUploadingSupplierInvoice ? (
                            <Loader2
                              data-icon="inline-start"
                              className="animate-spin"
                            />
                          ) : activeReceiptPurchaseOrder.hasSupplierInvoiceImage ? (
                            <RefreshCw data-icon="inline-start" />
                          ) : (
                            <Upload data-icon="inline-start" />
                          )}
                          {activeReceiptPurchaseOrder.hasSupplierInvoiceImage
                            ? "Ganti Faktur"
                            : "Unggah Faktur"}
                        </Button>
                      </div>
                      <input
                        ref={supplierInvoiceInputRef}
                        className="sr-only"
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        aria-label="Pilih gambar Faktur dari supplier"
                        onChange={(event) => {
                          selectSupplierInvoice(event.target.files?.[0] ?? null);
                          event.currentTarget.value = "";
                        }}
                      />
                    </section>
                  </div>

                  <Separator />

                  <section className="space-y-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h4 className="font-medium">Pilih sumber Surat Jalan</h4>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Gunakan dokumen supplier atau buat Surat Jalan Mektek.
                          Pilihan terakhir akan menjadi dokumen aktif.
                        </p>
                      </div>
                      <Badge
                        variant={
                          activeReceiptPurchaseOrder.receivingDeliveryNoteSource
                            ? "secondary"
                            : "outline"
                        }
                      >
                        {activeReceiptPurchaseOrder.receivingDeliveryNoteSource
                          ? `Sudah diunggah / tersedia · ${
                              activeReceiptPurchaseOrder.receivingDeliveryNoteSource ===
                              "MEKTEK"
                                ? "Dibuat Mektek"
                                : "Dari supplier"
                            }`
                          : "Belum tersedia"}
                      </Badge>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div
                        className={cn(
                          "space-y-3 rounded-lg border p-4 transition-colors",
                          activeReceiptPurchaseOrder.receivingDeliveryNoteSource ===
                            "SUPPLIER" &&
                            "border-primary bg-primary/5 ring-1 ring-primary",
                          activeReceiptPurchaseOrder.receivingDeliveryNoteSource ===
                            "MEKTEK" && "opacity-50",
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h5 className="font-medium">
                              Surat Jalan dari Supplier
                            </h5>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {activeReceiptPurchaseOrder.receivingDeliveryNoteSource ===
                              "MEKTEK"
                                ? "Dinonaktifkan karena Surat Jalan Mektek dipilih."
                                : "Pilih ini jika supplier memberikan Surat Jalan."}
                            </p>
                          </div>
                          {activeReceiptPurchaseOrder.receivingDeliveryNoteSource ===
                            "SUPPLIER" && <Badge>Dipilih</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          File supplier:{" "}
                          {activeReceiptPurchaseOrder.hasDeliveryNoteImage
                            ? "sudah diunggah"
                            : "belum diunggah"}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {activeReceiptPurchaseOrder.hasDeliveryNoteImage && (
                            <>
                              <Button
                                asChild
                                type="button"
                                variant="outline"
                                size="sm"
                              >
                                <Link
                                  href={`/api/mektek/logistics/purchase-orders/${encodeURIComponent(activeReceiptPurchaseOrder.id)}/delivery-note-image`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  <Eye data-icon="inline-start" />
                                  Lihat Surat Jalan Supplier
                                </Link>
                              </Button>
                              {activeReceiptPurchaseOrder.receivingDeliveryNoteSource !==
                                "SUPPLIER" &&
                                activeReceiptPurchaseOrder.receivingDeliveryNoteSource !==
                                  "MEKTEK" && (
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={selectExistingSupplierDeliveryNote}
                                  disabled={isSelectingDeliveryNoteSource}
                                >
                                  {isSelectingDeliveryNoteSource && (
                                    <Loader2
                                      data-icon="inline-start"
                                      className="animate-spin"
                                    />
                                  )}
                                  Pilih dokumen ini
                                </Button>
                              )}
                            </>
                          )}
                          <Button
                            type="button"
                            size="sm"
                            onClick={() =>
                              deliveryNoteInputRef.current?.click()
                            }
                            disabled={
                              isUploadingDeliveryNote ||
                              activeReceiptPurchaseOrder.receivingDeliveryNoteSource ===
                                "MEKTEK"
                            }
                          >
                            {isUploadingDeliveryNote ? (
                              <Loader2
                                data-icon="inline-start"
                                className="animate-spin"
                              />
                            ) : (
                              <Upload data-icon="inline-start" />
                            )}
                            {activeReceiptPurchaseOrder.hasDeliveryNoteImage
                              ? "Ganti file"
                              : "Unggah & pilih"}
                          </Button>
                        </div>
                        <input
                          ref={deliveryNoteInputRef}
                          className="sr-only"
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          aria-label="Pilih gambar Surat Jalan dari supplier"
                          disabled={
                            activeReceiptPurchaseOrder.receivingDeliveryNoteSource ===
                            "MEKTEK"
                          }
                          onChange={(event) => {
                            selectSupplierDeliveryNote(
                              event.target.files?.[0] ?? null,
                            );
                            event.currentTarget.value = "";
                          }}
                        />
                      </div>

                      <div
                        className={cn(
                          "space-y-3 rounded-lg border p-4 transition-colors",
                          activeReceiptPurchaseOrder.receivingDeliveryNoteSource ===
                            "MEKTEK" &&
                            "border-primary bg-primary/5 ring-1 ring-primary",
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h5 className="font-medium">
                              Buat Surat Jalan Mektek
                            </h5>
                            <p className="mt-1 text-xs text-muted-foreground">
                              Pilih ini jika supplier tidak memberikan Surat
                              Jalan.
                            </p>
                          </div>
                          {activeReceiptPurchaseOrder.receivingDeliveryNoteSource ===
                            "MEKTEK" && <Badge>Dipilih</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Dokumen Mektek:{" "}
                          {activeReceiptPurchaseOrder.receivingDeliveryNoteSource ===
                          "MEKTEK"
                            ? "sudah tersedia"
                            : "belum dibuat"}
                        </p>
                        {activeReceiptPurchaseOrder.receivingDeliveryNoteSource ===
                        "MEKTEK" ? (
                          <div className="space-y-3">
                            <div className="flex flex-wrap gap-2">
                              <Button asChild type="button" size="sm" variant="outline">
                                <Link
                                  href={`/api/mektek/logistics/purchase-orders/${encodeURIComponent(activeReceiptPurchaseOrder.id)}/delivery-note?flow=receiving`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  <Printer data-icon="inline-start" />
                                  Cetak Surat Jalan
                                </Link>
                              </Button>
                              {activeReceiptPurchaseOrder.hasMektekDeliveryNoteImage && (
                                <Button asChild type="button" size="sm" variant="outline">
                                  <Link
                                    href={`/api/mektek/logistics/purchase-orders/${encodeURIComponent(activeReceiptPurchaseOrder.id)}/mektek-delivery-note-image`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    <Eye data-icon="inline-start" />
                                    Lihat foto tanda tangan
                                  </Link>
                                </Button>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Cetak Surat Jalan, minta ditandatangani manual,
                              lalu unggah foto hasil tanda tangan.
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Foto tanda tangan:{" "}
                              {activeReceiptPurchaseOrder.hasMektekDeliveryNoteImage
                                ? "sudah diunggah"
                                : "belum diunggah"}
                            </p>
                            <Button
                              type="button"
                              size="sm"
                              onClick={() =>
                                mektekDeliveryNoteInputRef.current?.click()
                              }
                              disabled={isUploadingMektekDeliveryNote}
                            >
                              {isUploadingMektekDeliveryNote ? (
                                <Loader2
                                  data-icon="inline-start"
                                  className="animate-spin"
                                />
                              ) : (
                                <Upload data-icon="inline-start" />
                              )}
                              {activeReceiptPurchaseOrder.hasMektekDeliveryNoteImage
                                ? "Ganti Surat Jalan yang Sudah Ditandatangani"
                                : "Unggah Surat Jalan yang Sudah Ditandatangani"}
                            </Button>
                            <input
                              ref={mektekDeliveryNoteInputRef}
                              className="sr-only"
                              type="file"
                              accept="image/jpeg,image/png,image/webp"
                              aria-label="Pilih foto Surat Jalan Mektek yang sudah ditandatangani"
                              onChange={(event) => {
                                selectMektekDeliveryNoteImage(
                                  event.target.files?.[0] ?? null,
                                );
                                event.currentTarget.value = "";
                              }}
                            />
                          </div>
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            onClick={createMektekDeliveryNote}
                            disabled={isCreatingMektekDeliveryNote}
                          >
                            {isCreatingMektekDeliveryNote ? (
                              <Loader2
                                data-icon="inline-start"
                                className="animate-spin"
                              />
                            ) : (
                              <ReceiptText data-icon="inline-start" />
                            )}
                            Buat & pilih Surat Jalan Mektek
                          </Button>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Format upload: JPG, PNG, atau WebP · Maksimal 5 MB
                    </p>
                  </section>
                </CardContent>
              </Card>

              <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted/50 p-3 text-center sm:grid-cols-4 sm:gap-3 sm:p-4">
                <div>
                  <p className="text-xs text-muted-foreground">QTY Order</p>
                  <p className="font-mono text-lg font-semibold tabular-nums">
                    {activeProgress.orderedQuantity}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">QTY Masuk</p>
                  <p className="font-mono text-lg font-semibold tabular-nums">
                    {activeProgress.receivedQuantity}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">QTY Sisa</p>
                  <p className="font-mono text-lg font-semibold tabular-nums">
                    {activeProgress.remainingQuantity}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total PO</p>
                  <p className="font-mono text-sm font-semibold sm:text-base">
                    {formatRupiah(activePurchaseOrderTotal)}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="font-medium">Detail Part</h3>
                <div className="divide-y rounded-lg border">
                  {activeReceiptPurchaseOrder.items.map((item) => {
                    const progress = getLogisticsItemProgress(item);
           return (
                      <div
                        key={item.id}
                        className="grid gap-3 p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="break-words font-medium">{item.partName}</p>
                            {item.source === "MANUAL" && (
                              <Badge variant="outline">Manual</Badge>
                            )}
                          </div>
                          <p className="break-words text-xs text-muted-foreground">
                            {item.partNumber || "Tanpa Part Number"}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-xs">
                          <span>
                            Order <strong>{progress.orderedQuantity}</strong>
                          </span>
                          <span>
                            Masuk <strong>{progress.receivedQuantity}</strong>
                          </span>
                          <span>
                            Sisa <strong>{progress.remainingQuantity}</strong>
                          </span>
                          <span>
                            Harga{" "}
                            <strong>
                              {formatRupiah(Number(item.agreedUnitPrice || 0))}
                            </strong>
                          </span>
                          <span>
                            Jumlah{" "}
                            <strong>
                              {formatRupiah(
                                item.orderedQuantity *
                                  Number(item.agreedUnitPrice || 0),
                              )}
                            </strong>
                          </span>
                          <Badge
                            variant={
                              progress.status === "CLOSED" ? "secondary" : "outline"
                            }
                          >
                            {getLogisticsStatusLabel(progress.status)}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {activeReceiptPurchaseOrder.status === "OPEN" && (
                <form
                  className="space-y-4 rounded-lg border p-3 sm:p-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    submitReceipt();
                  }}
                >
                  <div>
                    <h3 className="font-medium">Catat Barang Masuk</h3>
                    <p className="text-xs text-muted-foreground">
                      Pilih item, gudang tujuan, dan quantity yang benar-benar diterima.
                    </p>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="logistics-received-date">Tanggal Masuk</Label>
                      <Input
                        id="logistics-received-date"
                        type="date"
                        min={activeReceiptPurchaseOrder.inputDate.slice(0, 10)}
                        max={today}
                        value={receiptDraft.receivedAt}
                        onChange={(event) =>
                          setReceiptDraft((current) => ({
                            ...current,
                            receivedAt: event.target.value,
                          }))
                        }
                        disabled={isPending}
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="logistics-receipt-pic">PIC</Label>
                      <Select
                        value={receiptDraft.picId}
                        onValueChange={(picId) =>
                          setReceiptDraft((current) => ({ ...current, picId }))
                        }
                        disabled={isPending || pics.length === 0}
                        required
                      >
                        <SelectTrigger id="logistics-receipt-pic">
                          <SelectValue placeholder="Pilih PIC" />
                        </SelectTrigger>
                        <SelectContent>
                          {pics.map((pic) => (
                            <SelectItem key={pic.id} value={pic.id}>
                              {pic.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {pics.length === 0 && (
                        <p className="text-xs text-destructive">
                          Belum ada PIC aktif. Admin perlu mengaktifkan PIC terlebih dahulu.
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div>
                      <h4 className="text-sm font-medium">Item yang diterima</h4>
                      <p className="text-xs text-muted-foreground">
                        Isi 0 atau kosongkan item yang belum diterima.
                      </p>
                    </div>
                    <div className="divide-y rounded-lg border">
                      {activeReceiptPurchaseOrder.items.map((item) => {
                        const progress = getLogisticsItemProgress(item);
                        const canReceiveItem =
                          item.source === "MANUAL" || !!item.catalogItemId;
                        return (
                          <div
                            key={item.id}
                            className="grid gap-3 p-3 sm:grid-cols-[minmax(0,1fr)_140px_180px] sm:items-end"
                          >
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="break-words text-sm font-medium">
                                  {item.partName}
                                </p>
                                {item.source === "MANUAL" && (
                                  <Badge variant="outline">Manual</Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {item.partNumber || "Tanpa Part Number"} · Sisa {progress.remainingQuantity}
                              </p>
                              {item.source === "MANUAL" ? (
                                <p className="text-xs text-muted-foreground">
                                  Item manual · otomatis terhubung ke Catalog / Item.
                                </p>
                              ) : !item.catalogItemId ? (
                                <p className="text-xs text-destructive">
                                  Belum terhubung ke Catalog / Item.
                                </p>
                              ) : null}
                            </div>
                            <div className="space-y-1.5">
                              <Label htmlFor={`logistics-received-quantity-${item.id}`}>
                                QTY Masuk
                              </Label>
                              <Input
                                id={`logistics-received-quantity-${item.id}`}
                                type="number"
                                inputMode="numeric"
                                min={0}
                                max={progress.remainingQuantity}
                                step={1}
                                value={receiptItemDrafts[item.id]?.quantity ?? ""}
                                onChange={(event) =>
                                  updateReceiptItem(item.id, "quantity", event.target.value)
                                }
                                placeholder="0"
                                disabled={
                                  isPending ||
                                  progress.status === "CLOSED" ||
                                  !canReceiveItem
                                }
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label htmlFor={`receiving-warehouse-${item.id}`}>
                                Gudang Tujuan
                              </Label>
                              <Select
                                value={receiptItemDrafts[item.id]?.warehouse ?? "REAR"}
                                onValueChange={(value) =>
                                  updateReceiptItem(
                                    item.id,
                                    "warehouse",
                                    value as LogisticsReceiptItemDraft["warehouse"],
                                  )
                                }
                                disabled={
                                  isPending ||
                                  progress.status === "CLOSED" ||
                                  !canReceiveItem
                                }
                              >
                                <SelectTrigger id={`receiving-warehouse-${item.id}`}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="REAR">Gudang Belakang</SelectItem>
                                  <SelectItem value="FRONT">Gudang Depan</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            {Number(receiptItemDrafts[item.id]?.quantity) > 0 && (
                              <div className="space-y-1.5 sm:col-span-3">
                                <Label htmlFor={`logistics-receipt-note-${item.id}`}>
                                  Keterangan Item
                                  <span className="ml-1 font-normal text-muted-foreground">
                                    (opsional)
                                  </span>
                                </Label>
                                <Textarea
                                  id={`logistics-receipt-note-${item.id}`}
                                  value={receiptItemDrafts[item.id]?.note ?? ""}
                                  onChange={(event) =>
                                    updateReceiptItem(item.id, "note", event.target.value)
                                  }
                                  placeholder={`Kondisi atau catatan khusus untuk ${item.partName}`}
                                  maxLength={500}
                                  rows={2}
                                  disabled={
                                    isPending ||
                                    progress.status === "CLOSED" ||
                                    !canReceiveItem
                                  }
                                />
                                <p className="text-xs text-muted-foreground">
                                  Keterangan ini hanya berlaku untuk item ini.
                                </p>
                              </div>
                            )}
                            {Number(receiptItemDrafts[item.id]?.quantity) > 0 && (
                              <div className="space-y-1.5 sm:col-span-3">
                                <Label htmlFor={`receiving-item-photo-${item.id}`}>
                                  Foto Item{" "}
                                  <span className="font-normal text-muted-foreground">
                                    (opsional)
                                  </span>
                                </Label>
                                <Input
                                  id={`receiving-item-photo-${item.id}`}
                                  type="file"
                                  accept="image/jpeg,image/png,image/webp"
                                  capture="environment"
                                  onChange={(event) =>
                                    selectReceiptItemPhoto(
                                      item.id,
                                      event.currentTarget.files?.[0] ?? null,
                                    )
                                  }
                                  disabled={
                                    isPending ||
                                    progress.status === "CLOSED" ||
                                    !canReceiveItem
                                  }
                                />
                                <p className="text-xs text-muted-foreground">
                                  Di HP akan membuka kamera; di PC pilih file JPEG,
                                  PNG, atau WebP maksimal 5 MB.
                                </p>
                                {receiptItemPhotos[item.id]?.file && (
                                  <p className="truncate text-xs font-medium">
                                    File dipilih:{" "}
                                    {receiptItemPhotos[item.id].file?.name}
                                  </p>
                                )}
                                {receiptItemPhotos[item.id]?.error && (
                                  <p
                                    className="text-xs text-destructive"
                                    role="alert"
                                  >
                                    {receiptItemPhotos[item.id].error}
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button
                      type="submit"
                      disabled={
                        isPending ||
                        Object.values(receiptItemPhotos).some(
                          (photo) => !!photo.error,
                        ) ||
                        !receiptDraft.picId ||
                        !hasSelectedReceiptItems
                      }
                    >
                      {isPending && (
                        <Loader2 data-icon="inline-start" className="animate-spin" />
                      )}
                      Simpan Penerimaan
                    </Button>
                  </div>
                </form>
              )}

              <Separator />
              <div className="space-y-3">
                <div>
                  <h3 className="font-medium">Riwayat Barang Masuk</h3>
                  <p className="text-xs text-muted-foreground">
                    Setiap batch tampil satu kali bersama seluruh item yang diterima.
                  </p>
                </div>
                {activeReceivingBatches.length > 0 ? (
                  <div className="space-y-3">
                    {activeReceivingBatches.map((batch) => {
                      return (
                        <div
                          key={batch.receivingReference}
                          className="rounded-lg border p-3 sm:p-4"
                        >
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <p className="font-mono font-semibold">
                                Batch {batch.receivingReference}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {formatDate(batch.receivedAt)} · PIC {batch.pic.name}
                              </p>
                            </div>
                          </div>
                          <div className="mt-3 divide-y rounded-md border">
                            {[...batch.lines]
                              .sort((left, right) => left.item.position - right.item.position)
                              .map(({ item, receipt }) => (
                                <div
                                  key={receipt.id}
                                  className="p-3 text-sm"
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <p className="break-words font-medium">
                                          {item.partName}
                                        </p>
                                        {item.source === "MANUAL" && (
                                          <Badge variant="outline">Manual</Badge>
                                        )}
                                      </div>
                                      <p className="break-words text-xs text-muted-foreground">
                                        {item.partNumber || "Tanpa Part Number"}
                                      </p>
                                    </div>
                                    <div className="flex shrink-0 items-center gap-2">
                                      {receipt.imageMimeType && (
                                        <Button
                                          asChild
                                          type="button"
                                          variant="outline"
                                          size="sm"
                                        >
                                          <a
                                            href={`/api/mektek/logistics/receipts/${encodeURIComponent(receipt.id)}/image`}
                                            target="_blank"
                                            rel="noreferrer"
                                          >
                                            Foto Item
                                          </a>
                                        </Button>
                                      )}
                                      <span className="font-mono font-semibold tabular-nums">
                                        +{receipt.quantity}
                                      </span>
                                    </div>
                                  </div>
                                  {receipt.note && (
                                    <p className="mt-2 break-words text-xs text-muted-foreground">
                                      <span className="font-medium text-foreground">
                                        Keterangan:
                                      </span>{" "}
                                      {receipt.note}
                                    </p>
                                  )}
                                </div>
                              ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                    Belum ada barang masuk untuk Purchase Order ini.
                  </p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
  );
}
