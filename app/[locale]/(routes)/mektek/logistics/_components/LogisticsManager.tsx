"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Clock3,
  ImagePlus,
  Loader2,
  PackageCheck,
  Plus,
  Printer,
  ReceiptText,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  createMektekLogisticsPurchaseOrder,
  recordMektekLogisticsReceipt,
  type LogisticsPurchaseOrderInput,
} from "@/actions/mektek/logistics";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { getCatalogInventoryLocalDateKey } from "@/lib/mektek/catalog-inventory";
import {
  getLogisticsItemProgress,
  getLogisticsStatusLabel,
} from "@/lib/mektek/logistics";

type LogisticsReceiptRow = {
  id: string;
  purchaseOrderItemId: string;
  deliveryNoteNumber: string;
  quantity: number;
  receivedAt: string;
  note: string | null;
  imageMimeType: string | null;
  createdBy: string | null;
  createdAt: string;
};

type LogisticsPurchaseOrderItemRow = {
  id: string;
  purchaseOrderId: string;
  position: number;
  partName: string;
  partNumber: string | null;
  orderedQuantity: number;
  receivedQuantity: number;
  status: "OPEN" | "CLOSED";
  createdAt: string;
  updatedAt: string;
  receipts: LogisticsReceiptRow[];
};

type LogisticsPurchaseOrderRow = {
  id: string;
  poNumber: string;
  supplierName: string;
  userName: string;
  projectName: string;
  inputDate: string;
  dueDate: string;
  poType: string;
  status: "OPEN" | "CLOSED";
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  items: LogisticsPurchaseOrderItemRow[];
};

type LogisticsStats = {
  openPurchaseOrders: number;
  closedPurchaseOrders: number;
  overduePurchaseOrders: number;
  totalOrdered: number;
  totalReceived: number;
  totalRemaining: number;
};

type LogisticsManagerProps = {
  purchaseOrders: LogisticsPurchaseOrderRow[];
  stats: LogisticsStats;
  mode: "overview" | "spreadsheet";
  spreadsheetHref?: string;
};

type PurchaseOrderItemDraft = {
  clientId: string;
  partName: string;
  partNumber: string;
  orderedQuantity: string;
};

type PurchaseOrderDraft = Omit<LogisticsPurchaseOrderInput, "items"> & {
  items: PurchaseOrderItemDraft[];
};

type ActiveReceiptItem = {
  purchaseOrder: LogisticsPurchaseOrderRow;
  item: LogisticsPurchaseOrderItemRow;
};

function blankPurchaseOrder(): PurchaseOrderDraft {
  const today = getCatalogInventoryLocalDateKey();
  return {
    poNumber: "",
    supplierName: "",
    userName: "",
    projectName: "",
    inputDate: today,
    dueDate: today,
    poType: "Normal",
    notes: "",
    items: [
      {
        clientId: "item-1",
        partName: "",
        partNumber: "",
        orderedQuantity: "",
      },
    ],
  };
}

const logisticsDateFormatter = new Intl.DateTimeFormat("id-ID", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

function formatDate(value: string) {
  return logisticsDateFormatter.format(new Date(value));
}

async function uploadLogisticsReceiptImage(receiptId: string, file: File) {
  const response = await fetch(
    `/api/mektek/logistics/receipts/${encodeURIComponent(receiptId)}/image`,
    {
      method: "PUT",
      body: file,
      headers: { "Content-Type": file.type },
    },
  );
  const payload = (await response.json().catch(() => null)) as
    | { error?: string }
    | null;
  if (!response.ok) {
    throw new Error(payload?.error || "Gagal mengunggah foto Surat Jalan");
  }
}

export default function LogisticsManager({
  purchaseOrders,
  stats,
  mode,
  spreadsheetHref,
}: LogisticsManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const nextItemId = useRef(2);
  const [createOpen, setCreateOpen] = useState(false);
  const [createValue, setCreateValue] = useState<PurchaseOrderDraft>(() =>
    blankPurchaseOrder(),
  );
  const [activeReceiptItem, setActiveReceiptItem] =
    useState<ActiveReceiptItem | null>(null);
  const [activePurchaseOrder, setActivePurchaseOrder] =
    useState<LogisticsPurchaseOrderRow | null>(null);
  const [receiptDraft, setReceiptDraft] = useState({
    deliveryNoteNumber: "",
    quantity: "",
    receivedAt: getCatalogInventoryLocalDateKey(),
    note: "",
  });
  const [receiptImage, setReceiptImage] = useState<File | null>(null);
  const [receiptImageError, setReceiptImageError] = useState<string | null>(null);

  const rows = useMemo(
    () =>
      purchaseOrders.flatMap((purchaseOrder) =>
        purchaseOrder.items.map((item) => ({ purchaseOrder, item })),
      ),
    [purchaseOrders],
  );
  const today = getCatalogInventoryLocalDateKey();

  const updateCreateValue = <K extends keyof PurchaseOrderDraft>(
    key: K,
    value: PurchaseOrderDraft[K],
  ) => {
    setCreateValue((current) => ({ ...current, [key]: value }));
  };

  const updateItem = (
    clientId: string,
    key: Exclude<keyof PurchaseOrderItemDraft, "clientId">,
    value: string,
  ) => {
    setCreateValue((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.clientId === clientId ? { ...item, [key]: value } : item,
      ),
    }));
  };

  const addItem = () => {
    const clientId = `item-${nextItemId.current}`;
    nextItemId.current += 1;
    setCreateValue((current) => ({
      ...current,
      items: [
        ...current.items,
        { clientId, partName: "", partNumber: "", orderedQuantity: "" },
      ],
    }));
  };

  const removeItem = (clientId: string) => {
    setCreateValue((current) => ({
      ...current,
      items: current.items.filter((item) => item.clientId !== clientId),
    }));
  };

  const submitPurchaseOrder = () => {
    startTransition(async () => {
      const result = await createMektekLogisticsPurchaseOrder({
        ...createValue,
        items: createValue.items.map(({ clientId: _clientId, ...item }) => item),
      });
      if (!result || "error" in result) {
        toast.error(result?.error || "Gagal membuat Purchase Order");
        return;
      }
      toast.success(`Purchase Order ${result.data.poNumber} berhasil dibuat`);
      nextItemId.current = 2;
      setCreateValue(blankPurchaseOrder());
      setCreateOpen(false);
      router.refresh();
    });
  };

  const openReceipt = (
    purchaseOrder: LogisticsPurchaseOrderRow,
    item: LogisticsPurchaseOrderItemRow,
  ) => {
    setActiveReceiptItem({ purchaseOrder, item });
    setReceiptDraft({
      deliveryNoteNumber: "",
      quantity: "",
      receivedAt: getCatalogInventoryLocalDateKey(),
      note: "",
    });
    setReceiptImage(null);
    setReceiptImageError(null);
  };

  const selectReceiptImage = (file: File | null) => {
    if (!file) {
      setReceiptImage(null);
      setReceiptImageError(null);
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setReceiptImage(null);
      setReceiptImageError("Pilih foto Surat Jalan berformat JPEG, PNG, atau WebP");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setReceiptImage(null);
      setReceiptImageError("Ukuran foto Surat Jalan maksimal 5 MB");
      return;
    }
    setReceiptImage(file);
    setReceiptImageError(null);
  };

  const submitReceipt = () => {
    if (!activeReceiptItem) return;
    startTransition(async () => {
      const result = await recordMektekLogisticsReceipt({
        purchaseOrderItemId: activeReceiptItem.item.id,
        ...receiptDraft,
      });
      if (!result || "error" in result) {
        toast.error(result?.error || "Gagal mencatat barang masuk");
        return;
      }
      let imageUploadError: string | null = null;
      if (receiptImage) {
        try {
          await uploadLogisticsReceiptImage(result.data.receipt.id, receiptImage);
        } catch (error) {
          imageUploadError =
            error instanceof Error ? error.message : "Gagal mengunggah foto Surat Jalan";
        }
      }
      const closed = result.data.itemProgress.status === "CLOSED";
      if (imageUploadError) {
        toast.warning(`Barang masuk tersimpan, tetapi ${imageUploadError}`);
      } else {
        toast.success(
          closed
            ? "Barang masuk tercatat dan item PO otomatis Closed"
            : `Barang masuk tercatat. QTY Sisa ${result.data.itemProgress.remainingQuantity}`,
        );
      }
      setActiveReceiptItem(null);
      router.refresh();
    });
  };

  const activeProgress = activeReceiptItem
    ? getLogisticsItemProgress(activeReceiptItem.item)
    : null;
  const latestReceipt = activeReceiptItem?.item.receipts[0] ?? null;

  return (
    <div className="space-y-6">
      {mode === "overview" && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Clock3 className="size-5 text-primary" aria-hidden="true" />
            <div>
              <p className="text-xs text-muted-foreground">PO Open</p>
              <p className="text-xl font-semibold tabular-nums">
                {stats.openPurchaseOrders}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <CheckCircle2 className="size-5 text-primary" aria-hidden="true" />
            <div>
              <p className="text-xs text-muted-foreground">PO Closed</p>
              <p className="text-xl font-semibold tabular-nums">
                {stats.closedPurchaseOrders}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <PackageCheck className="size-5 text-primary" aria-hidden="true" />
            <div>
              <p className="text-xs text-muted-foreground">Total QTY Sisa</p>
              <p className="text-xl font-semibold tabular-nums">
                {stats.totalRemaining}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <AlertTriangle className="size-5 text-destructive" aria-hidden="true" />
            <div>
              <p className="text-xs text-muted-foreground">PO Terlambat</p>
              <p className="text-xl font-semibold tabular-nums">
                {stats.overduePurchaseOrders}
              </p>
            </div>
          </CardContent>
        </Card>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Purchase Order Logistics</h2>
              <p className="text-sm text-muted-foreground">
                Buat PO baru atau buka spreadsheet untuk mencatat barang masuk.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto">
              <Plus data-icon="inline-start" />
              Buat Purchase Order
            </Button>
          </DialogTrigger>
           <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-5xl md:flex md:flex-col md:overflow-hidden">
             <DialogHeader className="shrink-0">
              <DialogTitle>Buat Purchase Order Logistics</DialogTitle>
              <DialogDescription>
                Masukkan seluruh Part yang diorder, termasuk barang yang belum ready dari supplier.
              </DialogDescription>
            </DialogHeader>
            <form
               className="space-y-5 md:flex md:min-h-0 md:flex-1 md:flex-col md:space-y-0 md:gap-5"
              onSubmit={(event) => {
                event.preventDefault();
                submitPurchaseOrder();
              }}
            >
               <div className="grid shrink-0 gap-4 md:grid-cols-2 lg:grid-cols-3">
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
                  <Label htmlFor="logistics-supplier">Supplier</Label>
                  <Input
                    id="logistics-supplier"
                    value={createValue.supplierName}
                    onChange={(event) =>
                      updateCreateValue("supplierName", event.target.value)
                    }
                    placeholder="Nama supplier"
                    disabled={isPending}
                    required
                  />
                </div>
                 <div className="space-y-1.5">
                   <Label htmlFor="logistics-po-type">PO Type</Label>
                   <Select
                     value={createValue.poType}
                     onValueChange={(value) => updateCreateValue("poType", value)}
                     disabled={isPending}
                   >
                     <SelectTrigger id="logistics-po-type" className="w-full">
                       <SelectValue placeholder="Pilih PO Type" />
                     </SelectTrigger>
                     <SelectContent>
                       <SelectItem value="Normal">Normal</SelectItem>
                       <SelectItem value="Consignment">Consignment</SelectItem>
                     </SelectContent>
                   </Select>
                 </div>
                <div className="space-y-1.5">
                  <Label htmlFor="logistics-user">User / PT</Label>
                  <Input
                    id="logistics-user"
                    value={createValue.userName}
                    onChange={(event) => updateCreateValue("userName", event.target.value)}
                    placeholder="PT XXX"
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
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="logistics-input-date">Tanggal Input</Label>
                    <Input
                      id="logistics-input-date"
                      type="date"
                      value={createValue.inputDate}
                      onChange={(event) =>
                        updateCreateValue("inputDate", event.target.value)
                      }
                      disabled={isPending}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="logistics-due-date">Due To</Label>
                    <Input
                      id="logistics-due-date"
                      type="date"
                      min={createValue.inputDate}
                      value={createValue.dueDate}
                      onChange={(event) => updateCreateValue("dueDate", event.target.value)}
                      disabled={isPending}
                      required
                    />
                  </div>
                </div>
              </div>

               <fieldset className="space-y-3 rounded-lg border p-4 md:flex md:min-h-0 md:flex-1 md:flex-col md:space-y-0 md:gap-3">
                <legend className="sr-only">Part yang diorder</legend>
                 <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium">Part yang diorder</p>
                    <p className="text-xs text-muted-foreground">
                      Jangan hapus Part yang belum ready; biarkan QTY Masuk 0 agar tetap pending.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addItem}
                    disabled={isPending}
                  >
                    <Plus data-icon="inline-start" />
                    Tambah Part
                  </Button>
                </div>
                 <div className="max-h-[18rem] space-y-3 overflow-y-auto overscroll-contain pe-2 md:min-h-0 md:flex-1">
                  {createValue.items.map((item, index) => (
                    <div
                      key={item.clientId}
                      className="grid gap-3 rounded-md bg-muted/40 p-3 md:grid-cols-[minmax(200px,1fr)_180px_130px_auto] md:items-end"
                    >
               <div className="shrink-0 space-y-1.5">
                        <Label htmlFor={`logistics-part-${item.clientId}`}>
                          Part {index + 1}
                        </Label>
                        <Input
                          id={`logistics-part-${item.clientId}`}
                          value={item.partName}
                          onChange={(event) =>
                            updateItem(item.clientId, "partName", event.target.value)
                          }
                          placeholder="Compressor, Aki, Baterai..."
                          disabled={isPending}
                          required
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor={`logistics-part-number-${item.clientId}`}>
                          Part Number
                        </Label>
                        <Input
                          id={`logistics-part-number-${item.clientId}`}
                          value={item.partNumber}
                          onChange={(event) =>
                            updateItem(item.clientId, "partNumber", event.target.value)
                          }
                          placeholder="Opsional"
                          disabled={isPending}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor={`logistics-qty-${item.clientId}`}>
                          QTY Order
                        </Label>
                        <Input
                          id={`logistics-qty-${item.clientId}`}
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
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeItem(item.clientId)}
                        disabled={isPending || createValue.items.length === 1}
                        aria-label={`Hapus Part ${index + 1}`}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  ))}
                </div>
              </fieldset>

              <div className="space-y-1.5">
                <Label htmlFor="logistics-notes">Catatan PO</Label>
                <Textarea
                  id="logistics-notes"
                  value={createValue.notes}
                  onChange={(event) => updateCreateValue("notes", event.target.value)}
                  placeholder="Catatan tambahan untuk supplier atau tim Logistics"
                  disabled={isPending}
                />
              </div>
               <div className="flex shrink-0 justify-end">
                <Button type="submit" disabled={isPending}>
                  {isPending && <Loader2 data-icon="inline-start" className="animate-spin" />}
                  Simpan Purchase Order
                </Button>
              </div>
            </form>
          </DialogContent>
              </Dialog>
              {spreadsheetHref && (
                <Button asChild variant="outline" className="w-full sm:w-auto">
                  <Link href={spreadsheetHref}>Buka Spreadsheet PO</Link>
                </Button>
              )}
            </div>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Riwayat Purchase Order</CardTitle>
              <p className="text-sm text-muted-foreground">
                Pilih Purchase Order untuk melihat detail part dan riwayat penerimaannya.
              </p>
            </CardHeader>
            <CardContent className="p-0">
              {purchaseOrders.length > 0 ? (
                <div className="divide-y">
                  {purchaseOrders.map((purchaseOrder) => {
                    const itemProgress = purchaseOrder.items.map((item) =>
                      getLogisticsItemProgress(item),
                    );
                    const totalOrdered = itemProgress.reduce(
                      (total, progress) => total + progress.orderedQuantity,
                      0,
                    );
                    const totalRemaining = itemProgress.reduce(
                      (total, progress) => total + progress.remainingQuantity,
                      0,
                    );

                    return (
                      <Button
                        key={purchaseOrder.id}
                        type="button"
                        variant="ghost"
                        className="h-auto w-full justify-start rounded-none px-4 py-4 text-left whitespace-normal"
                        onClick={() => setActivePurchaseOrder(purchaseOrder)}
                        aria-label={`Lihat detail Purchase Order ${purchaseOrder.poNumber}`}
                      >
                        <div className="grid w-full gap-3 sm:grid-cols-[minmax(180px,1fr)_minmax(180px,1fr)_auto_auto] sm:items-center">
                          <div className="min-w-0">
                            <p className="truncate font-mono font-semibold">
                              {purchaseOrder.poNumber}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {purchaseOrder.supplierName}
                            </p>
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-medium">{purchaseOrder.userName}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {purchaseOrder.projectName}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge
                              variant={
                                purchaseOrder.status === "CLOSED" ? "secondary" : "outline"
                              }
                            >
                              {getLogisticsStatusLabel(purchaseOrder.status)}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {purchaseOrder.items.length} part · {totalRemaining}/{totalOrdered} sisa
                            </span>
                          </div>
                          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                        </div>
                      </Button>
                    );
                  })}
                </div>
              ) : (
                <p className="p-8 text-center text-sm text-muted-foreground">
                  Belum ada Purchase Order Logistics.
                </p>
              )}
            </CardContent>
          </Card>

          <Dialog
            open={!!activePurchaseOrder}
            onOpenChange={(open) => !open && setActivePurchaseOrder(null)}
          >
            <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
              <DialogHeader>
                <DialogTitle>Detail Purchase Order</DialogTitle>
                <DialogDescription>
                  {activePurchaseOrder?.poNumber} · {activePurchaseOrder?.supplierName}
                </DialogDescription>
              </DialogHeader>

              {activePurchaseOrder && (
                <div className="space-y-5">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
                      <p className="text-xs text-muted-foreground">User / PT</p>
                      <p className="mt-1 font-medium">{activePurchaseOrder.userName}</p>
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
                      <p className="text-xs text-muted-foreground">Tanggal Input</p>
                      <p className="mt-1 font-medium">
                        {formatDate(activePurchaseOrder.inputDate)}
                      </p>
                    </div>
                    <div className="rounded-lg bg-muted/50 p-3">
                      <p className="text-xs text-muted-foreground">Due To</p>
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

                  <Separator />
                  <div className="space-y-3">
                    <h3 className="font-medium">Detail Part</h3>
                    {activePurchaseOrder.items.map((item) => {
                      const progress = getLogisticsItemProgress(item);

                      return (
                        <div key={item.id} className="rounded-lg border">
                          <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <p className="font-medium">{item.partName}</p>
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
                                  className="grid gap-1 text-sm sm:grid-cols-[120px_1fr_auto] sm:items-center"
                                >
                                  <span>{formatDate(receipt.receivedAt)}</span>
                                  <span className="font-mono">
                                    {receipt.deliveryNoteNumber}
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
        </>
      )}

      {mode === "spreadsheet" && (
        <>
          <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            Spreadsheet PO · {rows.length} item pada halaman ini
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="min-w-[1500px] border-collapse text-sm">
              <caption className="sr-only">
                Tracking Purchase Order supplier dan quantity barang yang masuk ke Logistics
              </caption>
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="border-b border-e px-3 py-3 text-center">No</th>
                  <th className="min-w-40 border-b border-e px-3 py-3 text-left">User/PT</th>
                  <th className="min-w-44 border-b border-e px-3 py-3 text-left">
                    Job Site / Project
                  </th>
                  <th className="min-w-32 border-b border-e px-3 py-3 text-left">
                    Tanggal Input
                  </th>
                  <th className="min-w-32 border-b border-e px-3 py-3 text-left">Due To</th>
                  <th className="min-w-36 border-b border-e px-3 py-3 text-left">
                    PO No. User
                  </th>
                  <th className="min-w-28 border-b border-e px-3 py-3 text-left">PO Type</th>
                  <th className="min-w-40 border-b border-e px-3 py-3 text-left">Supplier</th>
                  <th className="min-w-48 border-b border-e px-3 py-3 text-left">Part</th>
                  <th className="min-w-24 border-b border-e px-3 py-3 text-left">Status</th>
                  <th className="min-w-24 border-b border-e px-3 py-3 text-right">
                    QTY Masuk
                  </th>
                  <th className="min-w-24 border-b border-e px-3 py-3 text-right">
                    QTY Order
                  </th>
                  <th className="min-w-24 border-b border-e px-3 py-3 text-right">
                    QTY Sisa
                  </th>
                  <th className="min-w-36 border-b px-3 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ purchaseOrder, item }, index) => {
                  const progress = getLogisticsItemProgress(item);
                  const isOverdue =
                    progress.status === "OPEN" &&
                    purchaseOrder.dueDate.slice(0, 10) < today;
                  return (
                    <tr key={item.id} className="border-b last:border-b-0 hover:bg-muted/20">
                      <td className="border-e px-3 py-3 text-center font-mono tabular-nums">
                        {index + 1}
                      </td>
                      <td className="border-e px-3 py-3 font-medium">
                        {purchaseOrder.userName}
                      </td>
                      <td className="border-e px-3 py-3">{purchaseOrder.projectName}</td>
                      <td className="border-e px-3 py-3">{formatDate(purchaseOrder.inputDate)}</td>
                      <td className="border-e px-3 py-3">
                        <div className="flex flex-col items-start gap-1">
                          <span>{formatDate(purchaseOrder.dueDate)}</span>
                          {isOverdue && <Badge variant="destructive">Terlambat</Badge>}
                        </div>
                      </td>
                      <td className="border-e px-3 py-3 font-mono font-medium">
                        {purchaseOrder.poNumber}
                      </td>
                      <td className="border-e px-3 py-3">{purchaseOrder.poType}</td>
                      <td className="border-e px-3 py-3">{purchaseOrder.supplierName}</td>
                      <td className="border-e px-3 py-3">
                        <p className="font-medium">{item.partName}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.partNumber || "Tanpa Part Number"}
                        </p>
                      </td>
                      <td className="border-e px-3 py-3">
                        <Badge variant={progress.status === "CLOSED" ? "secondary" : "outline"}>
                          {getLogisticsStatusLabel(progress.status)}
                        </Badge>
                      </td>
                      <td className="border-e px-3 py-3 text-right font-mono font-semibold tabular-nums">
                        {progress.receivedQuantity}
                      </td>
                      <td className="border-e px-3 py-3 text-right font-mono tabular-nums">
                        {progress.orderedQuantity}
                      </td>
                      <td className="border-e px-3 py-3 text-right font-mono font-semibold tabular-nums">
                        {progress.remainingQuantity}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <Button
                          type="button"
                          size="sm"
                          variant={progress.status === "OPEN" ? "default" : "outline"}
                          onClick={() => openReceipt(purchaseOrder, item)}
                        >
                          <ReceiptText data-icon="inline-start" />
                          {progress.status === "OPEN" ? "Terima" : "Riwayat"}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={14} className="px-4 py-12 text-center text-muted-foreground">
                      Belum ada Purchase Order Logistics yang cocok dengan filter ini.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={!!activeReceiptItem}
        onOpenChange={(open) => !open && setActiveReceiptItem(null)}
      >
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader className="gap-3 sm:flex sm:flex-row sm:items-start sm:justify-between sm:text-left">
            <div className="space-y-1.5">
              <DialogTitle>
                {activeProgress?.status === "OPEN"
                  ? "Input Barang Masuk"
                  : "Riwayat Barang Masuk"}
              </DialogTitle>
              <DialogDescription>
                {activeReceiptItem?.purchaseOrder.poNumber} · {activeReceiptItem?.item.partName}
              </DialogDescription>
            </div>
            {activeProgress?.status === "CLOSED" && latestReceipt && (
              <Button asChild type="button" variant="outline" className="shrink-0">
                <a
                  href={`/api/mektek/logistics/receipts/${encodeURIComponent(latestReceipt.id)}/delivery-note`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Printer data-icon="inline-start" />
                  Cetak PDF Surat Jalan
                </a>
              </Button>
            )}
          </DialogHeader>

          {activeReceiptItem && activeProgress && (
            <div className="space-y-5">
              <div className="grid grid-cols-3 gap-3 rounded-lg bg-muted/50 p-4 text-center">
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
              </div>

              {activeProgress.status === "OPEN" && (
                <form
                  className="space-y-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    submitReceipt();
                  }}
                >
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="logistics-delivery-note">Nomor Surat Jalan</Label>
                      <Input
                        id="logistics-delivery-note"
                        value={receiptDraft.deliveryNoteNumber}
                        onChange={(event) =>
                          setReceiptDraft((current) => ({
                            ...current,
                            deliveryNoteNumber: event.target.value,
                          }))
                        }
                        placeholder="Wajib, untuk mencegah input double"
                        disabled={isPending}
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="logistics-received-date">Tanggal Masuk</Label>
                      <Input
                        id="logistics-received-date"
                        type="date"
                        min={activeReceiptItem.purchaseOrder.inputDate.slice(0, 10)}
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
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label htmlFor="logistics-received-quantity">QTY Masuk</Label>
                      <Input
                        id="logistics-received-quantity"
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={activeProgress.remainingQuantity}
                        step={1}
                        value={receiptDraft.quantity}
                        onChange={(event) =>
                          setReceiptDraft((current) => ({
                            ...current,
                            quantity: event.target.value,
                          }))
                        }
                        placeholder={`Maksimal ${activeProgress.remainingQuantity}`}
                        disabled={isPending}
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="logistics-receipt-note">Catatan Penerimaan</Label>
                    <Textarea
                      id="logistics-receipt-note"
                      value={receiptDraft.note}
                      onChange={(event) =>
                        setReceiptDraft((current) => ({
                          ...current,
                          note: event.target.value,
                        }))
                      }
                      placeholder="Kondisi barang atau catatan pengiriman"
                      disabled={isPending}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="logistics-receipt-image">Foto Surat Jalan</Label>
                    <div className="rounded-lg border bg-muted/20 p-3">
                      <Input
                        id="logistics-receipt-image"
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        capture="environment"
                        onChange={(event) =>
                          selectReceiptImage(event.target.files?.[0] ?? null)
                        }
                        disabled={isPending}
                      />
                      <div className="mt-2 flex items-start gap-2 text-xs text-muted-foreground">
                        <ImagePlus className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                        <p>
                          Ambil atau pilih foto JPEG, PNG, atau WebP dengan ukuran maksimal 5 MB.
                        </p>
                      </div>
                      {receiptImage && (
                        <p className="mt-2 truncate text-xs font-medium">
                          File dipilih: {receiptImage.name}
                        </p>
                      )}
                      {receiptImageError && (
                        <p className="mt-2 text-xs text-destructive" role="alert">
                          {receiptImageError}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button type="submit" disabled={isPending || !!receiptImageError}>
                      {isPending && (
                        <Loader2 data-icon="inline-start" className="animate-spin" />
                      )}
                      Simpan Barang Masuk
                    </Button>
                  </div>
                </form>
              )}

              <Separator />
              <div className="space-y-3">
                <div>
                  <h3 className="font-medium">Riwayat penerimaan</h3>
                  <p className="text-xs text-muted-foreground">
                    Nomor Surat Jalan yang sama tidak dapat diinput dua kali untuk item ini.
                  </p>
                </div>
                {activeReceiptItem.item.receipts.length > 0 ? (
                  <div className="divide-y rounded-lg border">
                    {activeReceiptItem.item.receipts.map((receipt) => (
                      <div
                        key={receipt.id}
                        className="grid gap-2 p-3 text-sm sm:grid-cols-[130px_1fr_70px_auto] sm:items-center"
                      >
                        <span>{formatDate(receipt.receivedAt)}</span>
                        <div>
                          <p className="font-mono font-medium">
                            {receipt.deliveryNoteNumber}
                          </p>
                          {receipt.note && (
                            <p className="text-xs text-muted-foreground">{receipt.note}</p>
                          )}
                        </div>
                        <span className="text-right font-mono font-semibold tabular-nums">
                          +{receipt.quantity}
                        </span>
                        <div className="flex flex-wrap justify-end gap-2">
                          {receipt.imageMimeType && (
                            <Button asChild type="button" variant="outline" size="sm">
                              <a
                                href={`/api/mektek/logistics/receipts/${encodeURIComponent(receipt.id)}/image`}
                                target="_blank"
                                rel="noreferrer"
                              >
                                Foto
                              </a>
                            </Button>
                          )}
                          {activeProgress.status === "CLOSED" && (
                            <Button asChild type="button" variant="outline" size="sm">
                              <a
                                href={`/api/mektek/logistics/receipts/${encodeURIComponent(receipt.id)}/delivery-note`}
                                target="_blank"
                                rel="noreferrer"
                                aria-label={`Cetak PDF Surat Jalan ${receipt.deliveryNoteNumber}`}
                              >
                                PDF
                              </a>
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                    Belum ada barang yang diterima untuk item ini.
                  </p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}
