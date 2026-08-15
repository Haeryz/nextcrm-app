import type { Dispatch, RefObject, SetStateAction } from "react";
import { Camera, Eye, ImagePlus, Loader2, Pencil, Printer, Save } from "lucide-react";

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
import { getCatalogInventoryLocalDateKey } from "@/lib/mektek/catalog-inventory";
import {
  getLogisticsItemProgress,
  getLogisticsStatusLabel,
} from "@/lib/mektek/logistics";
import type {
  DispatchItemDraft,
  OutboundBatchGroup,
  OutboundPurchaseOrder,
} from "./OutboundLogisticsManager";

const dateFormatter = new Intl.DateTimeFormat("id-ID", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

function formatDate(value: string) {
  return dateFormatter.format(new Date(value));
}

type DispatchDraftValue = { picId: string; dispatchedAt: string };
type ActiveProgressValue = {
  orderedQuantity: number;
  receivedQuantity: number;
  remainingQuantity: number;
};

export type DetailOutboundPurchaseOrderDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activePurchaseOrder: OutboundPurchaseOrder | null;
  activeProgress: ActiveProgressValue | null;
  activeOutboundBatches: OutboundBatchGroup[];
  dispatchDraft: DispatchDraftValue;
  setDispatchDraft: Dispatch<SetStateAction<DispatchDraftValue>>;
  dispatchItemDrafts: Record<string, DispatchItemDraft>;
  dispatchImage: File | null;
  dispatchImageError: string | null;
  editingDispatchReference: string | null;
  setEditingDispatchReference: (value: string | null) => void;
  dispatchRevisionDrafts: Record<string, DispatchItemDraft>;
  dispatchRevisionHeader: DispatchDraftValue;
  setDispatchRevisionHeader: Dispatch<SetStateAction<DispatchDraftValue>>;
  isSavingDispatchRevision: boolean;
  isUploadingDetailPo: boolean;
  detailCustomerPoFile: File | null;
  detailCustomerPoError: string | null;
  hasSelectedDispatchItems: boolean;
  isPending: boolean;
  pics: Array<{ id: string; name: string }>;
  openEditPurchaseOrder: (purchaseOrder: OutboundPurchaseOrder) => void;
  submitDispatch: () => void;
  updateDispatchItem: <K extends keyof DispatchItemDraft>(
    itemId: string,
    key: K,
    value: DispatchItemDraft[K],
  ) => void;
  selectDispatchImage: (file: File | null) => void;
  selectDetailCustomerPoFile: (file: File | null) => void;
  submitDetailCustomerPoImage: () => void;
  updateDispatchRevisionDraft: <K extends keyof DispatchItemDraft>(
    itemId: string,
    key: K,
    value: DispatchItemDraft[K],
  ) => void;
  startEditDispatch: (batch: OutboundBatchGroup) => void;
  saveDispatchRevision: (batch: OutboundBatchGroup) => void;
  cancelEditDispatch: () => void;
  conditionCameraInputRef: RefObject<HTMLInputElement | null>;
  conditionGalleryInputRef: RefObject<HTMLInputElement | null>;
  detailCustomerPoInputRef: RefObject<HTMLInputElement | null>;
};

export function DetailOutboundPurchaseOrderDialog({
  open,
  onOpenChange,
  activePurchaseOrder,
  activeProgress,
  activeOutboundBatches,
  dispatchDraft,
  setDispatchDraft,
  dispatchItemDrafts,
  dispatchImage,
  dispatchImageError,
  editingDispatchReference,
  setEditingDispatchReference,
  dispatchRevisionDrafts,
  dispatchRevisionHeader,
  setDispatchRevisionHeader,
  isSavingDispatchRevision,
  isUploadingDetailPo,
  detailCustomerPoFile,
  detailCustomerPoError,
  hasSelectedDispatchItems,
  isPending,
  pics,
  openEditPurchaseOrder,
  submitDispatch,
  updateDispatchItem,
  selectDispatchImage,
  selectDetailCustomerPoFile,
  submitDetailCustomerPoImage,
  updateDispatchRevisionDraft,
  startEditDispatch,
  saveDispatchRevision,
  cancelEditDispatch,
  conditionCameraInputRef,
  conditionGalleryInputRef,
  detailCustomerPoInputRef,
}: DetailOutboundPurchaseOrderDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Detail Purchase Order Monitoring</DialogTitle>
            <DialogDescription>
              {activePurchaseOrder?.poNumber} · {activePurchaseOrder?.userName}
            </DialogDescription>
          </DialogHeader>

          {activePurchaseOrder && activeProgress && (
            <div className="space-y-5">
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => openEditPurchaseOrder(activePurchaseOrder)}
                  disabled={isPending}
                >
                  <Pencil data-icon="inline-start" /> Edit PO
                </Button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground">User / PT</p>
                  <p className="mt-1 font-medium">{activePurchaseOrder.userName}</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground">Project</p>
                  <p className="mt-1 font-medium">{activePurchaseOrder.projectName}</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground">Status</p>
                  <Badge
                    className="mt-1"
                    variant={
                      activePurchaseOrder.status === "CLOSED"
                        ? "secondary"
                        : "outline"
                    }
                  >
                    {getLogisticsStatusLabel(activePurchaseOrder.status)}
                  </Badge>
                </div>
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground">QTY Order</p>
                  <p className="mt-1 font-mono text-lg font-semibold tabular-nums">
                    {activeProgress.orderedQuantity}
                  </p>
                </div>
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground">QTY Keluar</p>
                  <p className="mt-1 font-mono text-lg font-semibold tabular-nums">
                    {activeProgress.receivedQuantity}
                  </p>
                </div>
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground">QTY Sisa</p>
                  <p className="mt-1 font-mono text-lg font-semibold tabular-nums">
                    {activeProgress.remainingQuantity}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <h3 className="font-medium">Detail Part</h3>
                  <p className="text-xs text-muted-foreground">
                    Progres pengiriman dihitung per item.
                  </p>
                </div>
                <div className="divide-y rounded-lg border">
                  {[...activePurchaseOrder.items]
                    .sort((left, right) => left.position - right.position)
                    .map((item) => {
                      const progress = getLogisticsItemProgress(item);
                      return (
                        <div key={item.id} className="p-3 text-sm">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-medium">{item.partName}</p>
                                {item.source === "MANUAL" && (
                                  <Badge variant="secondary">Manual</Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {item.partNumber || "Tanpa Part Number"}
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-3 text-xs">
                              <span>
                                Order{" "}
                                <strong className="font-mono">
                                  {progress.orderedQuantity}
                                </strong>
                              </span>
                              <span>
                                Keluar{" "}
                                <strong className="font-mono">
                                  {progress.receivedQuantity}
                                </strong>
                              </span>
                              <span>
                                Sisa{" "}
                                <strong className="font-mono">
                                  {progress.remainingQuantity}
                                </strong>
                              </span>
                              <Badge
                                variant={
                                  progress.status === "CLOSED"
                                    ? "secondary"
                                    : "outline"
                                }
                              >
                                {getLogisticsStatusLabel(progress.status)}
                              </Badge>
                            </div>
                          </div>
                          {item.note && (
                            <p className="mt-2 text-xs text-muted-foreground">
                              <span className="font-medium text-foreground">
                                Keterangan:
                              </span>{" "}
                              {item.note}
                            </p>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>

              <div className="space-y-3 border-t pt-4">
                <div>
                  <h3 className="font-medium">PO dari Customer</h3>
                  <p className="text-xs text-muted-foreground">
                    Unggah atau perbarui dokumen PO yang diterima dari Customer.
                  </p>
                </div>
                <div className="space-y-2 rounded-lg border bg-muted/20 p-4">
                  {activePurchaseOrder.hasCustomerPoImage && (
                    <Button
                      asChild
                      type="button"
                      variant="outline"
                      size="sm"
                    >
                      <a
                        href={`/api/mektek/logistics/purchase-orders/${encodeURIComponent(activePurchaseOrder.id)}/customer-po-image`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Eye data-icon="inline-start" /> Lihat PO Customer
                      </a>
                    </Button>
                  )}
                  <input
                    ref={detailCustomerPoInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    className="block w-full text-sm file:mr-3 file:rounded-md file:border file:border-input file:bg-background file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-accent"
                    onChange={(event) =>
                      selectDetailCustomerPoFile(event.target.files?.[0] ?? null)
                    }
                    disabled={isUploadingDetailPo}
                  />
                  {detailCustomerPoFile && (
                    <p className="text-xs text-muted-foreground">
                      Terpilih: {detailCustomerPoFile.name}
                    </p>
                  )}
                  {detailCustomerPoError && (
                    <p className="text-xs text-destructive">
                      {detailCustomerPoError}
                    </p>
                  )}
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      size="sm"
                      onClick={submitDetailCustomerPoImage}
                      disabled={isUploadingDetailPo || !detailCustomerPoFile}
                    >
                      {isUploadingDetailPo && <Loader2 className="animate-spin" />}
                      Simpan PO Customer
                    </Button>
                  </div>
                </div>
              </div>

              {activePurchaseOrder.status === "OPEN" && (
                <form
                  className="space-y-4 rounded-lg border bg-muted/20 p-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    submitDispatch();
                  }}
                >
                  <div>
                    <h3 className="font-medium">Catat Barang Keluar</h3>
                    <p className="text-xs text-muted-foreground">
                      Pilih item, gudang sumber, dan quantity yang benar-benar
                      dikirim hari ini.
                    </p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="outbound-dispatched-at">Tanggal Keluar</Label>
                      <Input
                        id="outbound-dispatched-at"
                        type="date"
                        min={activePurchaseOrder.inputDate.slice(0, 10)}
                        max={getCatalogInventoryLocalDateKey()}
                        value={dispatchDraft.dispatchedAt}
                        onChange={(event) =>
                          setDispatchDraft((current) => ({
                            ...current,
                            dispatchedAt: event.target.value,
                          }))
                        }
                        disabled={isPending}
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="outbound-delivery-note-number">
                        Nomor Surat Jalan
                      </Label>
                      <div
                        id="outbound-delivery-note-number"
                        className="flex h-10 items-center rounded-md border bg-muted/40 px-3 text-sm text-muted-foreground"
                      >
                        Dibuat otomatis saat disimpan
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Format YYMMNN (tahun-bulan-urutan), unik per bulan.
                      </p>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="outbound-dispatch-pic">PIC</Label>
                      <Select
                        value={dispatchDraft.picId}
                        onValueChange={(picId) =>
                          setDispatchDraft((current) => ({ ...current, picId }))
                        }
                        disabled={isPending || pics.length === 0}
                      >
                        <SelectTrigger id="outbound-dispatch-pic">
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
                    </div>
                  </div>

                  <fieldset className="space-y-3">
                    <legend className="text-sm font-medium">
                      Item yang dikirim
                    </legend>
                    <p className="text-xs text-muted-foreground">
                      Isi 0 atau kosongkan item yang belum dikirim.
                    </p>
                    {activePurchaseOrder.items.map((item) => {
                      const progress = getLogisticsItemProgress(item);
                      if (progress.remainingQuantity <= 0) return null;
                      const itemDraft = dispatchItemDrafts[item.id] ?? {
                        quantity: "",
                        warehouse: "REAR" as const,
                        note: "",
                      };
                      return (
                        <div
                          key={item.id}
                          className="space-y-3 rounded-md border bg-background p-3"
                        >
                          <div>
                            <p className="font-medium">{item.partName}</p>
                            <p className="text-xs text-muted-foreground">
                              {item.partNumber || "Tanpa Part Number"} · Sisa{" "}
                              {progress.remainingQuantity}
                            </p>
                            {item.source === "MANUAL" && (
                              <p className="text-xs text-muted-foreground">
                                Item manual tidak mengubah stok Catalog / Item.
                              </p>
                            )}
                          </div>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-1.5">
                              <Label htmlFor={`dispatch-qty-${item.id}`}>
                                QTY Keluar
                              </Label>
                              <Input
                                id={`dispatch-qty-${item.id}`}
                                type="number"
                                inputMode="numeric"
                                min={0}
                                max={progress.remainingQuantity}
                                value={itemDraft.quantity}
                                onChange={(event) =>
                                  updateDispatchItem(
                                    item.id,
                                    "quantity",
                                    event.target.value,
                                  )
                                }
                                disabled={isPending}
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label htmlFor={`dispatch-warehouse-${item.id}`}>
                                Gudang Sumber
                              </Label>
                              <Select
                                value={itemDraft.warehouse}
                                onValueChange={(warehouse) =>
                                  updateDispatchItem(
                                    item.id,
                                    "warehouse",
                                    warehouse as DispatchItemDraft["warehouse"],
                                  )
                                }
                                disabled={isPending}
                              >
                                <SelectTrigger
                                  id={`dispatch-warehouse-${item.id}`}
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
                          <div className="space-y-1.5">
                            <Label htmlFor={`dispatch-note-${item.id}`}>
                              Keterangan Item{" "}
                              <span className="font-normal text-muted-foreground">
                                (opsional)
                              </span>
                            </Label>
                            <Input
                              id={`dispatch-note-${item.id}`}
                              value={itemDraft.note}
                              maxLength={500}
                              onChange={(event) =>
                                updateDispatchItem(
                                  item.id,
                                  "note",
                                  event.target.value,
                                )
                              }
                              placeholder="Contoh: dikirim sebagian"
                              disabled={isPending}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </fieldset>

                  <div className="space-y-2">
                    <Label>Foto Kondisi Barang</Label>
                    <input
                      ref={conditionCameraInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      capture="environment"
                      className="sr-only"
                      onChange={(event) =>
                        selectDispatchImage(event.target.files?.[0] ?? null)
                      }
                    />
                    <input
                      ref={conditionGalleryInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="sr-only"
                      onChange={(event) =>
                        selectDispatchImage(event.target.files?.[0] ?? null)
                      }
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          if (!conditionCameraInputRef.current) return;
                          conditionCameraInputRef.current.value = "";
                          conditionCameraInputRef.current.click();
                        }}
                        disabled={isPending}
                      >
                        <Camera data-icon="inline-start" />
                        Ambil Foto
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          if (!conditionGalleryInputRef.current) return;
                          conditionGalleryInputRef.current.value = "";
                          conditionGalleryInputRef.current.click();
                        }}
                        disabled={isPending}
                      >
                        <ImagePlus data-icon="inline-start" />
                        Pilih Galeri
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Format JPEG, PNG, atau WebP, maksimal 5 MB.
                    </p>
                    {dispatchImage && (
                      <p className="text-xs font-medium">{dispatchImage.name}</p>
                    )}
                    {dispatchImageError && (
                      <p className="text-xs text-destructive" role="alert">
                        {dispatchImageError}
                      </p>
                    )}
                  </div>

                  <div className="flex justify-end">
                    <Button
                      type="submit"
                      disabled={
                        isPending ||
                        !!dispatchImageError ||
                        !dispatchDraft.picId ||
                        !hasSelectedDispatchItems
                      }
                    >
                      {isPending && <Loader2 className="animate-spin" />}
                      Simpan Barang Keluar
                    </Button>
                  </div>
                </form>
              )}

              <div className="space-y-3 border-t pt-4">
                <div>
                  <h3 className="font-medium">Riwayat Barang Keluar</h3>
                  <p className="text-xs text-muted-foreground">
                    Setiap batch tampil satu kali bersama seluruh item yang dikirim.
                  </p>
                </div>
                {activeOutboundBatches.length > 0 ? (
                  <div className="space-y-3">
                    {activeOutboundBatches.map((batch) => {
                      const imageReceipt = batch.lines.find(
                        ({ receipt }) => receipt.imageMimeType,
                      )?.receipt;
                      const isEditing =
                        editingDispatchReference === batch.dispatchReference;
                      return (
                        <div
                          key={batch.dispatchReference}
                          className="rounded-lg border p-3 sm:p-4"
                        >
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <p className="font-mono font-semibold">
                                Surat Jalan {batch.dispatchReference}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {formatDate(batch.dispatchedAt)} · PIC{" "}
                                {batch.pic.name}
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {imageReceipt && (
                                <Button
                                  asChild
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                >
                                  <a
                                    href={`/api/mektek/logistics/receipts/${encodeURIComponent(imageReceipt.id)}/image`}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    Foto Kondisi
                                  </a>
                                </Button>
                              )}
                              <Button
                                asChild
                                type="button"
                                variant="outline"
                                size="sm"
                              >
                                <a
                                  href={`/api/mektek/logistics/purchase-orders/${encodeURIComponent(activePurchaseOrder.id)}/delivery-note?reference=${encodeURIComponent(batch.dispatchReference)}`}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  <Printer data-icon="inline-start" />
                                  PDF Surat Jalan
                                </a>
                              </Button>
                              {!isEditing && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => startEditDispatch(batch)}
                                >
                                  <Pencil data-icon="inline-start" />
                                  Edit Surat Jalan
                                </Button>
                              )}
                            </div>
                          </div>
                          {isEditing && (
                            <div className="mt-3 grid gap-3 rounded-md border bg-muted/20 p-3 sm:grid-cols-2">
                              <div className="space-y-1.5">
                                <Label htmlFor={`revision-date-${batch.dispatchReference}`}>
                                  Tanggal Keluar
                                </Label>
                                <Input
                                  id={`revision-date-${batch.dispatchReference}`}
                                  type="date"
                                  min={activePurchaseOrder.inputDate.slice(0, 10)}
                                  max={getCatalogInventoryLocalDateKey()}
                                  value={dispatchRevisionHeader.dispatchedAt}
                                  onChange={(event) =>
                                    setDispatchRevisionHeader((current) => ({
                                      ...current,
                                      dispatchedAt: event.target.value,
                                    }))
                                  }
                                  disabled={isSavingDispatchRevision}
                                  required
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label htmlFor={`revision-pic-${batch.dispatchReference}`}>
                                  PIC
                                </Label>
                                <Select
                                  value={dispatchRevisionHeader.picId}
                                  onValueChange={(picId) =>
                                    setDispatchRevisionHeader((current) => ({
                                      ...current,
                                      picId,
                                    }))
                                  }
                                  disabled={isSavingDispatchRevision}
                                >
                                  <SelectTrigger id={`revision-pic-${batch.dispatchReference}`}>
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
                              </div>
                            </div>
                          )}
                          <div className="mt-3 divide-y rounded-md border">
                            {[...batch.lines]
                              .sort(
                                (left, right) =>
                                  left.item.position - right.item.position,
                              )
                              .map(({ item, receipt }) => {
                                const draft = dispatchRevisionDrafts[receipt.id] ?? {
                                  quantity: String(receipt.quantity),
                                  warehouse: receipt.warehouse,
                                  note: receipt.note ?? "",
                                };
                                return (
                                  <div key={receipt.id} className="p-3 text-sm">
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="min-w-0">
                                        <p className="font-medium">
                                          {item.partName}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                          {item.partNumber ||
                                            "Tanpa Part Number"}{" "}
                                          ·{" "}
                                          {receipt.warehouse === "FRONT"
                                            ? "Gudang Depan"
                                            : "Gudang Belakang"}
                                        </p>
                                        {isEditing && (
                                          <p className="text-xs text-muted-foreground">
                                            QTY Order: {item.orderedQuantity} ·
                                            QTY Keluar (termasuk batch lain):{" "}
                                            {item.receivedQuantity}
                                          </p>
                                        )}
                                      </div>
                                      {!isEditing && (
                                        <span className="font-mono font-semibold tabular-nums text-destructive">
                                          -{receipt.quantity}
                                        </span>
                                      )}
                                    </div>
                                    {isEditing && (
                                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                        <div className="space-y-1.5">
                                          <Label htmlFor={`revision-qty-${receipt.id}`}>
                                            QTY Keluar
                                          </Label>
                                          <Input
                                            id={`revision-qty-${receipt.id}`}
                                            type="number"
                                            inputMode="numeric"
                                            min={1}
                                            max={item.orderedQuantity}
                                            step={1}
                                            value={draft.quantity}
                                            onChange={(event) =>
                                              updateDispatchRevisionDraft(
                                                receipt.id,
                                                "quantity",
                                                event.target.value,
                                              )
                                            }
                                            disabled={isSavingDispatchRevision}
                                            aria-label={`QTY Surat Jalan untuk ${item.partName}`}
                                          />
                                        </div>
                                        <div className="space-y-1.5">
                                          <Label htmlFor={`revision-warehouse-${receipt.id}`}>
                                            Gudang Sumber
                                          </Label>
                                          <Select
                                            value={draft.warehouse}
                                            onValueChange={(warehouse) =>
                                              updateDispatchRevisionDraft(
                                                receipt.id,
                                                "warehouse",
                                                warehouse as DispatchItemDraft["warehouse"],
                                              )
                                            }
                                            disabled={isSavingDispatchRevision}
                                          >
                                            <SelectTrigger id={`revision-warehouse-${receipt.id}`}>
                                              <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                              <SelectItem value="REAR">Gudang Belakang</SelectItem>
                                              <SelectItem value="FRONT">Gudang Depan</SelectItem>
                                            </SelectContent>
                                          </Select>
                                        </div>
                                        <div className="space-y-1.5 sm:col-span-2">
                                          <Label htmlFor={`revision-note-${receipt.id}`}>
                                            Keterangan Item <span className="font-normal text-muted-foreground">(opsional)</span>
                                          </Label>
                                          <Input
                                            id={`revision-note-${receipt.id}`}
                                            value={draft.note}
                                            maxLength={500}
                                            onChange={(event) =>
                                              updateDispatchRevisionDraft(
                                                receipt.id,
                                                "note",
                                                event.target.value,
                                              )
                                            }
                                            placeholder="Contoh: dikirim sebagian"
                                            disabled={isSavingDispatchRevision}
                                          />
                                        </div>
                                      </div>
                                    )}
                                    {receipt.note && !isEditing && (
                                      <p className="mt-2 text-xs text-muted-foreground">
                                        <span className="font-medium text-foreground">
                                          Keterangan:
                                        </span>{" "}
                                        {receipt.note}
                                      </p>
                                    )}
                                  </div>
                                );
                              })}
                          </div>
                          {isEditing && (
                            <div className="mt-3 flex flex-wrap gap-2">
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => saveDispatchRevision(batch)}
                                disabled={
                                  isSavingDispatchRevision ||
                                  !dispatchRevisionHeader.picId ||
                                  !dispatchRevisionHeader.dispatchedAt
                                }
                              >
                                {isSavingDispatchRevision ? (
                                  <Loader2
                                    data-icon="inline-start"
                                    className="animate-spin"
                                  />
                                ) : (
                                  <Save data-icon="inline-start" />
                                )}
                                Simpan Surat Jalan
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={cancelEditDispatch}
                                disabled={isSavingDispatchRevision}
                              >
                                Batal
                              </Button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                    Belum ada Barang Keluar untuk Monitoring PO ini.
                  </p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
  );
}
