"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Loader2,
  MessageCircle,
  PackageCheck,
  Plus,
  Printer,
  ReceiptText,
  Trash2,
  Upload,
  UsersRound,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  createMektekReceivingPurchaseOrder,
  recordMektekReceivingPurchaseOrderReceipt,
  type MektekReceivingPurchaseOrderInput,
  type MektekReceivingPurchaseOrderItemInput,
} from "@/actions/mektek/logistics";
import { sendMektekLogisticsDocumentWhatsApp } from "@/actions/mektek/logistics-document-whatsapp";
import { CatalogOrManualItemPicker } from "@/app/[locale]/(routes)/mektek/_components/CatalogOrManualItemPicker";
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
  picId: string;
  pic: { id: string; name: string };
  receivingReference: string;
  quantity: number;
  warehouse: "REAR" | "FRONT";
  receivedAt: string;
  note: string | null;
  imageMimeType: string | null;
  createdBy: string | null;
  createdAt: string;
};

type LogisticsPurchaseOrderItemRow = {
  id: string;
  purchaseOrderId: string;
  catalogItemId: string | null;
  source: "CATALOG" | "MANUAL";
  position: number;
  partName: string;
  partNumber: string | null;
  machine: string | null;
  orderedQuantity: number;
  receivedQuantity: number;
  agreedUnitPrice: string | null;
  warehouse: "REAR" | "FRONT" | null;
  note: string | null;
  status: "OPEN" | "CLOSED";
  createdAt: string;
  updatedAt: string;
  receipts: LogisticsReceiptRow[];
};

type LogisticsPurchaseOrderRow = {
  id: string;
  poNumber: string;
  supplierName: string;
  projectName: string;
  inputDate: string;
  dueDate: string;
  poType: string;
  status: "OPEN" | "CLOSED";
  hasDeliveryNoteImage: boolean;
  deliveryNoteImageMimeType: string | null;
  deliveryNoteImageUpdatedAt: string | null;
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

type ReceivingManagerProps = {
  pics: Array<{ id: string; name: string }>;
  catalogItems: Array<{
    id: string;
    description: string;
    partNumber: string | null;
    price: number | null;
    rearStock: number;
    frontStock: number;
  }>;
  purchaseOrders: LogisticsPurchaseOrderRow[];
  stats: LogisticsStats;
  mode: "combined" | "spreadsheet";
  managePicsHref?: string;
  showLegacyHistory?: boolean;
};

type PurchaseOrderItemDraft = {
  clientId: string;
  source: "CATALOG" | "MANUAL";
  catalogItemId: string;
  catalogQuery: string;
  partName: string;
  partNumber: string;
  machine: string;
  warehouse: "REAR" | "FRONT";
  orderedQuantity: string;
  unitPrice: string;
};

type PurchaseOrderDraft = Omit<MektekReceivingPurchaseOrderInput, "items"> & {
  items: PurchaseOrderItemDraft[];
};

type LogisticsReceiptItemDraft = {
  quantity: string;
  warehouse: "REAR" | "FRONT";
  note: string;
};

type ReceiptItemPhotoDraft = {
  file: File | null;
  error: string | null;
};

type LogisticsReceivingBatchGroup = {
  receivingReference: string;
  receivedAt: string;
  createdAt: string;
  pic: { id: string; name: string };
  lines: Array<{
    item: LogisticsPurchaseOrderItemRow;
    receipt: LogisticsReceiptRow;
  }>;
};

function blankPurchaseOrderItem(clientId: string): PurchaseOrderItemDraft {
  return {
    clientId,
    source: "CATALOG",
    catalogItemId: "",
    catalogQuery: "",
    partName: "",
    partNumber: "",
    machine: "",
    warehouse: "REAR",
    orderedQuantity: "",
    unitPrice: "",
  };
}

function toReceivingPurchaseOrderItem(
  item: PurchaseOrderItemDraft,
): MektekReceivingPurchaseOrderItemInput {
  if (item.source === "MANUAL") {
    return {
      source: "MANUAL",
      partName: item.partName,
      partNumber: item.partNumber,
      machine: item.machine,
      warehouse: item.warehouse,
      orderedQuantity: item.orderedQuantity,
      unitPrice: item.unitPrice,
    };
  }
  return {
    source: "CATALOG",
    catalogItemId: item.catalogItemId,
    orderedQuantity: item.orderedQuantity,
    unitPrice: item.unitPrice,
  };
}

function blankPurchaseOrder(): PurchaseOrderDraft {
  const today = getCatalogInventoryLocalDateKey();
  return {
    poNumber: "",
    supplierName: "",
    projectName: "",
    inputDate: today,
    dueDate: today,
    poType: "Normal",
    notes: "",
    items: [
      blankPurchaseOrderItem("item-1"),
    ],
  };
}

function formatRupiah(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
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
    throw new Error(payload?.error || "Gagal mengunggah foto kondisi barang");
  }
}

async function uploadSupplierDeliveryNoteImage(
  purchaseOrderId: string,
  file: File,
) {
  const response = await fetch(
    `/api/mektek/logistics/purchase-orders/${encodeURIComponent(purchaseOrderId)}/delivery-note-image`,
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
    throw new Error(payload?.error || "Gagal mengunggah Surat Jalan supplier");
  }
}

export default function ReceivingManager({
  pics,
  catalogItems,
  purchaseOrders,
  stats,
  mode,
  managePicsHref,
  showLegacyHistory = false,
}: ReceivingManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const nextItemId = useRef(2);
  const [createOpen, setCreateOpen] = useState(false);
  const [deliveryNoteFile, setDeliveryNoteFile] = useState<File | null>(null);
  const [isUploadingDeliveryNote, startUploadingDeliveryNote] = useTransition();
  const [createValue, setCreateValue] = useState<PurchaseOrderDraft>(() =>
    blankPurchaseOrder(),
  );
  const [activeReceiptPurchaseOrder, setActiveReceiptPurchaseOrder] =
    useState<LogisticsPurchaseOrderRow | null>(null);
  const [activePurchaseOrder, setActivePurchaseOrder] =
    useState<LogisticsPurchaseOrderRow | null>(null);
  const [receiptDraft, setReceiptDraft] = useState({
    picId: pics[0]?.id ?? "",
    receivedAt: getCatalogInventoryLocalDateKey(),
  });
  const [receiptItemDrafts, setReceiptItemDrafts] = useState<
    Record<string, LogisticsReceiptItemDraft>
  >({});
  const [receiptItemPhotos, setReceiptItemPhotos] = useState<
    Record<string, ReceiptItemPhotoDraft>
  >({});
  const [documentPhone, setDocumentPhone] = useState("");
  const [isSendingDocument, startSendingDocument] = useTransition();

  const today = getCatalogInventoryLocalDateKey();
  const selectedCatalogItemIds = useMemo(
    () =>
      new Set(
        createValue.items.flatMap((item) =>
          item.source === "CATALOG" && item.catalogItemId
            ? [item.catalogItemId]
            : [],
        ),
      ),
    [createValue.items],
  );

  const updateCreateValue = <K extends keyof PurchaseOrderDraft>(
    key: K,
    value: PurchaseOrderDraft[K],
  ) => {
    setCreateValue((current) => ({ ...current, [key]: value }));
  };

  const updateItem = <K extends Exclude<keyof PurchaseOrderItemDraft, "clientId">>(
    clientId: string,
    key: K,
    value: PurchaseOrderItemDraft[K],
  ) => {
    setCreateValue((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.clientId === clientId ? { ...item, [key]: value } : item,
      ),
    }));
  };

  const switchItemSource = (
    clientId: string,
    source: PurchaseOrderItemDraft["source"],
  ) => {
    setCreateValue((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.clientId === clientId
          ? {
              ...blankPurchaseOrderItem(clientId),
              source,
              orderedQuantity: item.orderedQuantity,
            }
          : item,
      ),
    }));
  };

  const updateCatalogQuery = (clientId: string, catalogQuery: string) => {
    setCreateValue((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.clientId === clientId
          ? { ...item, catalogItemId: "", catalogQuery, unitPrice: "" }
          : item,
      ),
    }));
  };

  const selectCatalogItem = (
    clientId: string,
    catalogItem: {
      id: string;
      description: string;
      partNumber: string | null;
      price?: number | null;
    },
  ) => {
    setCreateValue((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.clientId === clientId
          ? {
              ...item,
              catalogItemId: catalogItem.id,
              catalogQuery: `${catalogItem.description} · ${catalogItem.partNumber || "Tanpa PN"}`,
              unitPrice: catalogItem.price ? String(catalogItem.price) : "",
            }
          : item,
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
        blankPurchaseOrderItem(clientId),
      ],
    }));
  };

  const removeItem = (clientId: string) => {
    setCreateValue((current) => ({
      ...current,
      items: current.items.filter((item) => item.clientId !== clientId),
    }));
  };

  const updateReceiptItem = <K extends keyof LogisticsReceiptItemDraft>(
    itemId: string,
    key: K,
    value: LogisticsReceiptItemDraft[K],
  ) => {
    setReceiptItemDrafts((current) => ({
      ...current,
      [itemId]: {
        quantity: current[itemId]?.quantity ?? "",
        warehouse: current[itemId]?.warehouse ?? "REAR",
        note: current[itemId]?.note ?? "",
        [key]: value,
      },
    }));
  };

  const submitPurchaseOrder = () => {
    startTransition(async () => {
      const result = await createMektekReceivingPurchaseOrder({
        ...createValue,
        items: createValue.items.map(toReceivingPurchaseOrderItem),
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

  const openReceipt = (purchaseOrder: LogisticsPurchaseOrderRow) => {
    setActiveReceiptPurchaseOrder(purchaseOrder);
    setDeliveryNoteFile(null);
    setReceiptDraft({
      picId: pics[0]?.id ?? "",
      receivedAt: getCatalogInventoryLocalDateKey(),
    });
    setReceiptItemDrafts(
      Object.fromEntries(
        purchaseOrder.items.map((item) => {
          return [
            item.id,
            {
              quantity: "",
              warehouse: item.warehouse ?? "REAR",
              note: "",
            },
          ];
        }),
      ),
    );
    setReceiptItemPhotos({});
  };

  const submitSupplierDeliveryNote = () => {
    if (!activeReceiptPurchaseOrder || !deliveryNoteFile) {
      toast.error("Gambar Surat Jalan dari supplier wajib dipilih");
      return;
    }
    startUploadingDeliveryNote(async () => {
      try {
        await uploadSupplierDeliveryNoteImage(
          activeReceiptPurchaseOrder.id,
          deliveryNoteFile,
        );
        toast.success("Surat Jalan supplier berhasil diunggah");
        setDeliveryNoteFile(null);
        setActiveReceiptPurchaseOrder({
          ...activeReceiptPurchaseOrder,
          hasDeliveryNoteImage: true,
          deliveryNoteImageMimeType: deliveryNoteFile.type,
          deliveryNoteImageUpdatedAt: new Date().toISOString(),
        });
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Gagal mengunggah Surat Jalan supplier",
        );
      }
    });
  };

  const selectReceiptItemPhoto = (itemId: string, file: File | null) => {
    if (!file) {
      setReceiptItemPhotos((current) => ({
        ...current,
        [itemId]: { file: null, error: null },
      }));
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setReceiptItemPhotos((current) => ({
        ...current,
        [itemId]: {
          file: null,
          error: "Pilih foto kondisi barang berformat JPEG, PNG, atau WebP",
        },
      }));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setReceiptItemPhotos((current) => ({
        ...current,
        [itemId]: {
          file: null,
          error: "Ukuran foto kondisi barang maksimal 5 MB",
        },
      }));
      return;
    }
    setReceiptItemPhotos((current) => ({
      ...current,
      [itemId]: { file, error: null },
    }));
  };

  const submitReceipt = () => {
    if (!activeReceiptPurchaseOrder) return;
    const receiptItems = activeReceiptPurchaseOrder.items
      .map((item) => ({
        purchaseOrderItemId: item.id,
        quantity: receiptItemDrafts[item.id]?.quantity ?? "",
        warehouse: receiptItemDrafts[item.id]?.warehouse ?? "REAR",
        note: receiptItemDrafts[item.id]?.note ?? "",
      }))
      .filter((item) => Number(item.quantity) > 0);
    startTransition(async () => {
      const result = await recordMektekReceivingPurchaseOrderReceipt({
        purchaseOrderId: activeReceiptPurchaseOrder.id,
        ...receiptDraft,
        items: receiptItems,
      });
      if (!result || "error" in result) {
        toast.error(result?.error || "Gagal mencatat barang masuk");
        return;
      }
      const imageUploadErrors: string[] = [];
      const receiptByItemId = new Map(
        result.data.receipts.map((receipt) => [
          receipt.purchaseOrderItemId,
          receipt,
        ]),
      );
      for (const [itemId, photo] of Object.entries(receiptItemPhotos)) {
        const receipt = receiptByItemId.get(itemId);
        if (!photo.file || !receipt) continue;
        try {
          await uploadLogisticsReceiptImage(receipt.id, photo.file);
        } catch (error) {
          imageUploadErrors.push(
            error instanceof Error
              ? error.message
              : "Gagal mengunggah foto kondisi barang",
          );
        }
      }
      const closed = result.data.purchaseOrderStatus === "CLOSED";
      if (imageUploadErrors.length > 0) {
        toast.warning(
          `Penerimaan tersimpan, tetapi ${imageUploadErrors.length} foto item gagal diunggah`,
        );
      } else {
        toast.success(
          closed
            ? "Penerimaan tersimpan dan Purchase Order otomatis Closed"
            : `Penerimaan tersimpan untuk ${result.data.receipts.length} item`,
        );
      }
      setActiveReceiptPurchaseOrder(null);
      router.refresh();
    });
  };

  const activeProgress = activeReceiptPurchaseOrder
    ? activeReceiptPurchaseOrder.items.reduce(
        (totals, item) => {
          const progress = getLogisticsItemProgress(item);
          return {
            orderedQuantity: totals.orderedQuantity + progress.orderedQuantity,
            receivedQuantity: totals.receivedQuantity + progress.receivedQuantity,
            remainingQuantity: totals.remainingQuantity + progress.remainingQuantity,
          };
        },
        { orderedQuantity: 0, receivedQuantity: 0, remainingQuantity: 0 },
      )
    : null;
  const hasSelectedReceiptItems =
    activeReceiptPurchaseOrder?.items.some(
      (item) =>
        (item.source === "MANUAL" || !!item.catalogItemId) &&
        Number(receiptItemDrafts[item.id]?.quantity) > 0,
    ) ?? false;
  const activePurchaseOrderTotal =
    activeReceiptPurchaseOrder?.items.reduce(
      (total, item) =>
        total +
        item.orderedQuantity * Number(item.agreedUnitPrice || 0),
      0,
    ) ?? 0;
  const hasInvalidCreateItems = createValue.items.some((item) =>
    item.source === "CATALOG"
      ? !item.catalogItemId || Number(item.unitPrice) <= 0
      : !item.partName.trim() ||
        !item.partNumber.trim() ||
        !item.machine.trim() ||
        Number(item.unitPrice) <= 0,
  );
  const createPurchaseOrderTotal = createValue.items.reduce(
    (total, item) =>
      total +
      (Number(item.orderedQuantity) || 0) * (Number(item.unitPrice) || 0),
    0,
  );
  const activeReceivingBatches = useMemo(() => {
    if (!activeReceiptPurchaseOrder) return [];
    const receiptLines = activeReceiptPurchaseOrder.items
      .flatMap((item) => item.receipts.map((receipt) => ({ item, receipt })))
      .sort((left, right) =>
        right.receipt.createdAt.localeCompare(left.receipt.createdAt),
      );
    const groups = new Map<string, LogisticsReceivingBatchGroup>();
    for (const line of receiptLines) {
      const current = groups.get(line.receipt.receivingReference);
      if (current) {
        current.lines.push(line);
        continue;
      }
      groups.set(line.receipt.receivingReference, {
        receivingReference: line.receipt.receivingReference,
        receivedAt: line.receipt.receivedAt,
        createdAt: line.receipt.createdAt,
        pic: line.receipt.pic,
        lines: [line],
      });
    }
    return Array.from(groups.values());
  }, [activeReceiptPurchaseOrder]);

  const sendDocument = () => {
    if (!activePurchaseOrder) return;
    startSendingDocument(async () => {
      const result = await sendMektekLogisticsDocumentWhatsApp({
        documentType: "PO",
        purchaseOrderId: activePurchaseOrder.id,
        phone: documentPhone,
      });
      if (!result || "error" in result) {
        toast.error(result?.error || "Gagal mengirim dokumen WhatsApp");
        return;
      }
      toast.success("PO Receiving berhasil dikirim melalui WhatsApp");
    });
  };

  return (
    <div className="space-y-6">
      {mode === "combined" && (
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
              <h2 className="text-lg font-semibold">Purchase Order Receiving</h2>
              <p className="text-sm text-muted-foreground">
                Buat PO baru, kelola dokumen, dan catat barang masuk dari satu halaman.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Dialog open={createOpen} onOpenChange={setCreateOpen}>
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
                    <Label htmlFor="logistics-due-date">Due Date</Label>
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

              <fieldset className="space-y-4 rounded-xl border bg-muted/15 p-4 sm:p-5">
                <legend className="sr-only">Item yang dipesan</legend>
                <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-semibold text-primary">
                      {createValue.items.length}
                    </span>
                    <div>
                      <p className="font-semibold">Item yang dipesan</p>
                      <p className="text-xs text-muted-foreground">
                        Cari seluruh Catalog / Item atau gunakan input manual jika
                        barang belum terdaftar.
                      </p>
                    </div>
                  </div>
                  <Button
            type="button"
                    variant="outline"
                    size="sm"
                    onClick={addItem}
                    disabled={isPending || createValue.items.length >= 100}
                  >
                    <Plus data-icon="inline-start" />
                    Tambah Item
                  </Button>
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
                            catalogStockMessage="Terhubung ke Catalog / Item dan akan menambah stok ketika diterima."
                            manualStockMessage="Item manual otomatis ditambahkan ke Catalog / Item dan stoknya bertambah saat diterima."
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
                                <p className="text-xs text-muted-foreground">
                                  Akan digunakan sebagai kategori mesin di katalog.
                                </p>
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
                                <p className="text-xs text-muted-foreground">
                                  Otomatis menjadi tujuan awal saat barang diterima.
                                </p>
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
                            <p className="text-xs text-muted-foreground">
                              Jumlah yang dipesan.
                            </p>
                            <Label htmlFor={`logistics-price-${item.clientId}`}>
                              Harga Satuan
                            </Label>
                            <Input
                              id={`logistics-price-${item.clientId}`}
                              className="h-11 bg-background font-mono text-base"
                              type="number"
                              inputMode="decimal"
                              min={1}
                              step="0.01"
                              value={item.unitPrice}
                              onChange={(event) =>
                                updateItem(
                                  item.clientId,
                                  "unitPrice",
                                  event.target.value,
                                )
                              }
                              disabled={isPending || item.source === "CATALOG"}
                              required
                            />
                            <p className="text-xs text-muted-foreground">
                              {item.source === "CATALOG"
                                ? "Otomatis dari harga Catalog / Item."
                                : "Wajib diisi untuk item manual."}
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
              {managePicsHref && (
                <Button
                  asChild
                  variant="outline"
                  className="min-w-0 flex-1 px-2 sm:flex-none sm:px-4"
                >
                  <Link href={managePicsHref}>
                    <UsersRound data-icon="inline-start" />
                    Kelola PIC
                  </Link>
                </Button>
              )}
            </div>
          </div>

          {showLegacyHistory && (
            <>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Daftar Purchase Order lama</CardTitle>
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
                            <p className="truncate font-medium">
                              {purchaseOrder.projectName}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              Job Site / Project
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
                      <p className="text-xs text-muted-foreground">Tanggal Input</p>
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
            </>
          )}
        </>
      )}

      {(mode === "combined" || mode === "spreadsheet") && (
        <>
          <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            Daftar Receiving · {purchaseOrders.length} Purchase Order pada halaman ini
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Buka detail untuk melihat harga, progres, dokumen, dan mencatat barang masuk.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="min-w-[1360px] border-collapse text-sm">
              <caption className="sr-only">
                Tracking Purchase Order supplier dan quantity barang yang masuk ke Logistics
              </caption>
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="border-b border-e px-3 py-3 text-center">No</th>
                  <th className="min-w-44 border-b border-e px-3 py-3 text-left">
                    Job Site / Project
                  </th>
                  <th className="min-w-32 border-b border-e px-3 py-3 text-left">
                    Tanggal Input
                  </th>
                  <th className="min-w-32 border-b border-e px-3 py-3 text-left">Due Date</th>
                  <th className="min-w-36 border-b border-e px-3 py-3 text-left">
                    PO No. User
                  </th>
                  <th className="min-w-28 border-b border-e px-3 py-3 text-left">PO Type</th>
                  <th className="min-w-40 border-b border-e px-3 py-3 text-left">Supplier / tujuan PO</th>
                  <th className="min-w-52 border-b border-e px-3 py-3 text-left">
                    Ringkasan Part
                  </th>
                  <th className="min-w-36 border-b border-e px-3 py-3 text-right">
                    Total PO
                  </th>
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
                {purchaseOrders.map((purchaseOrder, index) => {
                  const progress = purchaseOrder.items.reduce(
                    (totals, item) => {
                      const itemProgress = getLogisticsItemProgress(item);
                      return {
                        orderedQuantity:
                          totals.orderedQuantity + itemProgress.orderedQuantity,
                        receivedQuantity:
                          totals.receivedQuantity + itemProgress.receivedQuantity,
                        remainingQuantity:
                          totals.remainingQuantity + itemProgress.remainingQuantity,
                      };
                    },
                    {
                      orderedQuantity: 0,
                      receivedQuantity: 0,
                      remainingQuantity: 0,
                    },
                  );
                  const isOverdue =
                    purchaseOrder.status === "OPEN" &&
                    purchaseOrder.dueDate.slice(0, 10) < today;
                  const purchaseOrderTotal = purchaseOrder.items.reduce(
                    (total, item) =>
                      total +
                      item.orderedQuantity * Number(item.agreedUnitPrice || 0),
                    0,
                  );
                  return (
                    <tr
                      key={purchaseOrder.id}
                      className="border-b last:border-b-0 hover:bg-muted/20"
                    >
                      <td className="border-e px-3 py-3 text-center font-mono tabular-nums">
                        {index + 1}
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
                        <p className="font-medium">
                          {purchaseOrder.items.length} part
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {purchaseOrder.items
                            .slice(0, 2)
                            .map((item) => item.partName)
                            .join(", ")}
                          {purchaseOrder.items.length > 2 ? ", …" : ""}
                        </p>
                      </td>
                      <td className="border-e px-3 py-3 text-right font-mono font-semibold">
                        {formatRupiah(purchaseOrderTotal)}
                      </td>
                      <td className="border-e px-3 py-3">
                        <Badge
                          variant={
                            purchaseOrder.status === "CLOSED" ? "secondary" : "outline"
                          }
                        >
                          {getLogisticsStatusLabel(purchaseOrder.status)}
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
                          variant={
                            purchaseOrder.status === "OPEN" ? "default" : "outline"
                          }
                          onClick={() => openReceipt(purchaseOrder)}
                          aria-label={`Buka detail Purchase Order ${purchaseOrder.poNumber}`}
                        >
                          <ReceiptText data-icon="inline-start" />
                          Buka detail
                        </Button>
                      </td>
                    </tr>
                  );
                })}
                {purchaseOrders.length === 0 && (
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
        open={!!activeReceiptPurchaseOrder}
        onOpenChange={(open) => !open && setActiveReceiptPurchaseOrder(null)}
      >
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
                    Unggah Surat Jalan dari supplier. Jika supplier tidak
                    memberikannya, buat Surat Jalan Mektek.
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <Button asChild type="button" variant="outline">
                      <Link
                        href={`/api/mektek/logistics/purchase-orders/${encodeURIComponent(activeReceiptPurchaseOrder.id)}/pdf`}
                        target="_blank"
                      >
                        <Printer data-icon="inline-start" />
                        PDF Purchase Order
                      </Link>
                    </Button>
                    <Button asChild type="button" variant="outline">
                      <Link
                        href={`/api/mektek/logistics/purchase-orders/${encodeURIComponent(activeReceiptPurchaseOrder.id)}/delivery-note?flow=receiving`}
                        target="_blank"
                      >
                        <ReceiptText data-icon="inline-start" />
                        Buat Surat Jalan Mektek
                      </Link>
                    </Button>
                    {activeReceiptPurchaseOrder.hasDeliveryNoteImage && (
                      <Button asChild type="button" variant="ghost">
                        <Link
                          href={`/api/mektek/logistics/purchase-orders/${encodeURIComponent(activeReceiptPurchaseOrder.id)}/delivery-note-image`}
                          target="_blank"
                        >
                          Lihat Surat Jalan Supplier
                        </Link>
                      </Button>
                    )}
                  </div>

                  <div className="space-y-2 rounded-lg border p-3">
                    <Label
                      htmlFor={`supplier-delivery-note-${activeReceiptPurchaseOrder.id}`}
                    >
                      Surat Jalan dari Supplier
                    </Label>
                    <Input
                      id={`supplier-delivery-note-${activeReceiptPurchaseOrder.id}`}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(event) =>
                        setDeliveryNoteFile(event.target.files?.[0] ?? null)
                      }
                      disabled={isUploadingDeliveryNote}
                    />
                    <p className="text-xs text-muted-foreground">
                      Wajib unggah gambar JPG, PNG, atau WebP maksimal 5 MB jika
                      supplier memberikan Surat Jalan.
                    </p>
                    <Button
                      type="button"
                      onClick={submitSupplierDeliveryNote}
                      disabled={!deliveryNoteFile || isUploadingDeliveryNote}
                    >
                      {isUploadingDeliveryNote ? (
                        <Loader2
                          data-icon="inline-start"
                          className="animate-spin"
                        />
                      ) : (
                        <Upload data-icon="inline-start" />
                      )}
                      Unggah Surat Jalan Supplier
                    </Button>
                  </div>
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
        </>
      )}
    </div>
  );
}
