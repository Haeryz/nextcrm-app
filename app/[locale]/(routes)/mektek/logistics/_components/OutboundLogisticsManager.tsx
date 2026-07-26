"use client";

import {
  Camera,
  CheckCircle2,
  Clock3,
  Copy,
  Download,
  Eye,
  FileSpreadsheet,
  ImagePlus,
  Loader2,
  PackageMinus,
  Plus,
  Printer,
  ReceiptText,
  Trash2,
  Truck,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  createMektekOutboundPurchaseOrder,
  recordMektekOutboundPurchaseOrderDispatch,
  type MektekOutboundPurchaseOrderInput,
  type MektekOutboundPurchaseOrderItemInput,
} from "@/actions/mektek/logistics";
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
import { Textarea } from "@/components/ui/textarea";
import { getCatalogInventoryLocalDateKey } from "@/lib/mektek/catalog-inventory";
import {
  getLogisticsItemProgress,
  getLogisticsStatusLabel,
} from "@/lib/mektek/logistics";
import {
  getLogisticsPoExportRange,
  type LogisticsPoExportType,
} from "@/lib/mektek/logistics-export";

type CatalogOption = {
  id: string;
  description: string;
  partNumber: string | null;
  rearStock: number;
  frontStock: number;
};

type OutboundReceiptRow = {
  id: string;
  receivingReference: string;
  quantity: number;
  warehouse: "REAR" | "FRONT";
  receivedAt: string;
  note: string | null;
  imageMimeType: string | null;
  createdAt: string;
  pic: { id: string; name: string };
};

type OutboundPurchaseOrder = {
  id: string;
  poNumber: string;
  userName: string;
  projectName: string;
  inputDate: string;
  dueDate: string;
  poType: string;
  status: "OPEN" | "CLOSED";
  deliveryNoteNumber: string | null;
  deliveryDate: string | null;
  notes: string | null;
  hasCustomerPoImage: boolean;
  createdAt: string;
  updatedAt: string;
  items: Array<{
    id: string;
    catalogItemId: string | null;
    source: "CATALOG" | "MANUAL";
    position: number;
    partName: string;
    partNumber: string | null;
    orderedQuantity: number;
    receivedQuantity: number;
    warehouse: "REAR" | "FRONT" | null;
    note: string | null;
    status: "OPEN" | "CLOSED";
    receipts: OutboundReceiptRow[];
  }>;
};

type OutboundStats = {
  openPurchaseOrders: number;
  closedPurchaseOrders: number;
  overduePurchaseOrders: number;
  totalOrdered: number;
  totalReceived: number;
  totalRemaining: number;
};

type ItemDraft = {
  clientId: string;
  source: "CATALOG" | "MANUAL";
  catalogItemId: string;
  catalogQuery: string;
  partName: string;
  partNumber: string;
  orderedQuantity: string;
  note: string;
};

type OutboundDraft = Omit<MektekOutboundPurchaseOrderInput, "items"> & {
  items: ItemDraft[];
};

type OutboundLogisticsManagerProps = {
  pics: Array<{ id: string; name: string }>;
  purchaseOrders: OutboundPurchaseOrder[];
  catalogItems: CatalogOption[];
  stats: OutboundStats;
  mode: "overview" | "spreadsheet";
};

type DispatchItemDraft = {
  quantity: string;
  warehouse: "REAR" | "FRONT";
  note: string;
};

type OutboundBatchGroup = {
  dispatchReference: string;
  dispatchedAt: string;
  createdAt: string;
  pic: { id: string; name: string };
  lines: Array<{
    item: OutboundPurchaseOrder["items"][number];
    receipt: OutboundReceiptRow;
  }>;
};

const dateFormatter = new Intl.DateTimeFormat("id-ID", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

function formatDate(value: string | null) {
  return value ? dateFormatter.format(new Date(value)) : "-";
}

async function uploadOutboundConditionImage(receiptId: string, file: File) {
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

async function uploadCustomerPoImage(purchaseOrderId: string, file: File) {
  const response = await fetch(
    `/api/mektek/logistics/purchase-orders/${encodeURIComponent(purchaseOrderId)}/customer-po-image`,
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
    throw new Error(payload?.error || "Gagal mengunggah PO Customer");
  }
}

function blankItemDraft(clientId: string): ItemDraft {
  return {
    clientId,
    source: "CATALOG",
    catalogItemId: "",
    catalogQuery: "",
    partName: "",
    partNumber: "",
    orderedQuantity: "",
    note: "",
  };
}

function toOutboundPurchaseOrderItem(
  item: ItemDraft,
): MektekOutboundPurchaseOrderItemInput {
  if (item.source === "MANUAL") {
    return {
      source: "MANUAL",
      partName: item.partName,
      partNumber: item.partNumber,
      orderedQuantity: item.orderedQuantity,
      note: item.note,
    };
  }
  return {
    source: "CATALOG",
    catalogItemId: item.catalogItemId,
    orderedQuantity: item.orderedQuantity,
    note: item.note,
  };
}

function blankDraft(): OutboundDraft {
  const today = getCatalogInventoryLocalDateKey();
  return {
    poNumber: "",
    userName: "",
    projectName: "",
    inputDate: today,
    dueDate: today,
    poType: "Manual",
    notes: "",
    items: [blankItemDraft("outbound-item-1")],
  };
}

const OUTBOUND_DRAFT_STORAGE_KEY = "mektek:outbound-po-draft";

function restoreOutboundDraft(): {
  draft: OutboundDraft;
  nextId: number;
} {
  const blank = blankDraft();
  if (typeof window === "undefined") return { draft: blank, nextId: 2 };
  try {
    const stored = window.sessionStorage.getItem(OUTBOUND_DRAFT_STORAGE_KEY);
    if (!stored) return { draft: blank, nextId: 2 };
    const parsed = JSON.parse(stored) as OutboundDraft;
    if (!parsed || !Array.isArray(parsed.items) || parsed.items.length === 0) {
      return { draft: blank, nextId: 2 };
    }
    const maxId = parsed.items.reduce((max, item) => {
      const match = item.clientId.match(/^outbound-item-(\d+)$/);
      return match ? Math.max(max, Number(match[1])) : max;
    }, 1);
    return { draft: parsed, nextId: maxId + 1 };
  } catch {
    return { draft: blank, nextId: 2 };
  }
}

export default function OutboundLogisticsManager({
  pics,
  purchaseOrders,
  catalogItems,
  stats,
  mode,
}: OutboundLogisticsManagerProps) {
  const router = useRouter();
  // Restored once, via a lazy state initialiser. `useRef(restoreOutboundDraft().nextId)`
  // is NOT lazy — it re-ran the synchronous sessionStorage read + JSON.parse on every
  // render and discarded the result. Sharing one restore also removes the second call
  // that seeded `draft` below.
  const [restoredDraft] = useState(restoreOutboundDraft);
  const nextItemId = useRef(restoredDraft.nextId);
  const conditionCameraInputRef = useRef<HTMLInputElement>(null);
  const conditionGalleryInputRef = useRef<HTMLInputElement>(null);
  const customerPoInputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [createOpen, setCreateOpen] = useState(false);
  const [draft, setDraft] = useState<OutboundDraft>(restoredDraft.draft);
  const [customerPoFile, setCustomerPoFile] = useState<File | null>(null);
  const [customerPoError, setCustomerPoError] = useState<string | null>(null);
  const [activePurchaseOrder, setActivePurchaseOrder] =
    useState<OutboundPurchaseOrder | null>(null);
  const [dispatchDraft, setDispatchDraft] = useState({
    picId: pics[0]?.id ?? "",
    dispatchedAt: getCatalogInventoryLocalDateKey(),
  });
  const [dispatchItemDrafts, setDispatchItemDrafts] = useState<
    Record<string, DispatchItemDraft>
  >({});
  const [dispatchImage, setDispatchImage] = useState<File | null>(null);
  const [dispatchImageError, setDispatchImageError] = useState<string | null>(null);
  const currentMonth = getCatalogInventoryLocalDateKey().slice(0, 7);
  const [exportMonth, setExportMonth] = useState(currentMonth);
  const [exportType, setExportType] =
    useState<LogisticsPoExportType>("delivery-note");

  const selectedCatalogItemIds = useMemo(
    () =>
      new Set(
        draft.items.flatMap((item) =>
          item.source === "CATALOG" && item.catalogItemId
            ? [item.catalogItemId]
            : [],
        ),
      ),
    [draft.items],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const firstItem = draft.items[0];
    const isBlank =
      draft.items.length === 1 &&
      !draft.poNumber &&
      !draft.userName &&
      !draft.projectName &&
      (!firstItem || (!firstItem.catalogItemId && !firstItem.partName));
    if (isBlank) {
      window.sessionStorage.removeItem(OUTBOUND_DRAFT_STORAGE_KEY);
    } else {
      try {
        window.sessionStorage.setItem(
          OUTBOUND_DRAFT_STORAGE_KEY,
          JSON.stringify(draft),
        );
      } catch {
        // storage full or unavailable
      }
    }
  }, [draft]);
  let exportRangeError: string | null = null;
  try {
    getLogisticsPoExportRange(exportMonth, exportMonth);
  } catch (error) {
    exportRangeError =
      error instanceof Error ? error.message : "Bulan export tidak valid";
  }
  const exportHref = `/api/mektek/logistics/purchase-orders/export?type=${encodeURIComponent(exportType)}&month=${encodeURIComponent(exportMonth)}`;

  const updateDraft = <K extends keyof OutboundDraft>(
    key: K,
    value: OutboundDraft[K],
  ) => setDraft((current) => ({ ...current, [key]: value }));

  const updateItem = <K extends Exclude<keyof ItemDraft, "clientId">>(
    clientId: string,
    key: K,
    value: ItemDraft[K],
  ) => {
    setDraft((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.clientId === clientId ? { ...item, [key]: value } : item,
      ),
    }));
  };

  const switchItemSource = (
    clientId: string,
    source: ItemDraft["source"],
  ) => {
    setDraft((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.clientId === clientId
          ? {
              ...blankItemDraft(clientId),
              source,
              orderedQuantity: item.orderedQuantity,
              note: item.note,
            }
          : item,
      ),
    }));
  };

  const updateCatalogQuery = (clientId: string, catalogQuery: string) => {
    setDraft((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.clientId === clientId
          ? { ...item, catalogItemId: "", catalogQuery }
          : item,
      ),
    }));
  };

  const selectCatalogItem = (
    clientId: string,
    catalogItem: Pick<CatalogOption, "id" | "description" | "partNumber">,
  ) => {
    setDraft((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.clientId === clientId
          ? {
              ...item,
              catalogItemId: catalogItem.id,
              catalogQuery: `${catalogItem.description} · ${catalogItem.partNumber || "Tanpa PN"}`,
            }
          : item,
      ),
    }));
  };

  const addItem = () => {
    const clientId = `outbound-item-${nextItemId.current++}`;
    setDraft((current) => ({
      ...current,
      items: [...current.items, blankItemDraft(clientId)],
    }));
  };

  const selectCustomerPoFile = (file: File | null) => {
    if (!file) {
      setCustomerPoFile(null);
      setCustomerPoError(null);
      return;
    }
    if (
      !["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(
        file.type,
      )
    ) {
      setCustomerPoFile(null);
      setCustomerPoError("Pilih PO Customer berformat JPEG, PNG, WebP, atau PDF");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setCustomerPoFile(null);
      setCustomerPoError("Ukuran PO Customer maksimal 5 MB");
      return;
    }
    setCustomerPoFile(file);
    setCustomerPoError(null);
  };

  const submitPurchaseOrder = () => {
    if (!customerPoFile) {
      setCustomerPoError("Unggah PO dari Customer wajib dilakukan");
      customerPoInputRef.current?.focus();
      return;
    }
    startTransition(async () => {
      const result = await createMektekOutboundPurchaseOrder({
        poNumber: draft.poNumber.trim(),
        userName: draft.userName.trim(),
        projectName: draft.projectName.trim(),
        inputDate: draft.inputDate,
        dueDate: draft.dueDate,
        poType: draft.poType,
        notes: (draft.notes ?? "").trim(),
        items: draft.items.map((item) =>
          toOutboundPurchaseOrderItem({
            ...item,
            partName: item.partName.trim(),
            partNumber: item.partNumber.trim(),
            note: item.note.trim(),
          }),
        ),
      });
      if (!result || "error" in result) {
        toast.error(result?.error || "Gagal membuat Monitoring PO");
        return;
      }
      try {
        await uploadCustomerPoImage(result.data.id, customerPoFile);
      } catch (error) {
        toast.warning(
          `Monitoring PO tersimpan, tetapi ${
            error instanceof Error
              ? error.message
              : "gagal mengunggah PO Customer"
          }`,
        );
      }
      toast.success(`Monitoring PO ${result.data.poNumber} berhasil dibuat`);
      if (typeof window !== "undefined") {
        window.sessionStorage.removeItem(OUTBOUND_DRAFT_STORAGE_KEY);
      }
      nextItemId.current = 2;
      setDraft(blankDraft());
      setCustomerPoFile(null);
      setCustomerPoError(null);
      setCreateOpen(false);
      router.refresh();
    });
  };

  const openPurchaseOrder = (purchaseOrder: OutboundPurchaseOrder) => {
    setActivePurchaseOrder(purchaseOrder);
    setDispatchDraft({
      picId: pics[0]?.id ?? "",
      dispatchedAt: getCatalogInventoryLocalDateKey(),
    });
    setDispatchItemDrafts(
      Object.fromEntries(
        purchaseOrder.items.map((item) => [
          item.id,
          { quantity: "", warehouse: "REAR", note: "" },
        ]),
      ),
    );
    setDispatchImage(null);
    setDispatchImageError(null);
  };

  const duplicatePurchaseOrder = (purchaseOrder: OutboundPurchaseOrder) => {
    const items = purchaseOrder.items.map((item, index) => ({
      clientId: `outbound-item-${index + 1}`,
      source: item.source,
      catalogItemId: item.catalogItemId ?? "",
      catalogQuery:
        item.source === "CATALOG" && item.catalogItemId
          ? `${item.partName} · ${item.partNumber || "Tanpa PN"}`
          : "",
      partName: item.partName,
      partNumber: item.partNumber ?? "",
      orderedQuantity: String(item.orderedQuantity),
      note: item.note ?? "",
    }));
    nextItemId.current = items.length + 1;
    setDraft({
      poNumber: "",
      userName: purchaseOrder.userName,
      projectName: purchaseOrder.projectName,
      inputDate: getCatalogInventoryLocalDateKey(),
      dueDate: getCatalogInventoryLocalDateKey(),
      poType:
        purchaseOrder.poType.toLowerCase() === "consignment"
          ? "Consignment"
          : "Manual",
      notes: purchaseOrder.notes ?? "",
      items,
    });
    setCustomerPoFile(null);
    setCustomerPoError(null);
    setCreateOpen(true);
  };

  const updateDispatchItem = <K extends keyof DispatchItemDraft>(
    itemId: string,
    key: K,
    value: DispatchItemDraft[K],
  ) => {
    setDispatchItemDrafts((current) => ({
      ...current,
      [itemId]: {
        quantity: current[itemId]?.quantity ?? "",
        warehouse: current[itemId]?.warehouse ?? "REAR",
        note: current[itemId]?.note ?? "",
        [key]: value,
      },
    }));
  };

  const selectDispatchImage = (file: File | null) => {
    if (!file) {
      setDispatchImage(null);
      setDispatchImageError(null);
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setDispatchImage(null);
      setDispatchImageError(
        "Pilih foto kondisi barang berformat JPEG, PNG, atau WebP",
      );
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setDispatchImage(null);
      setDispatchImageError("Ukuran foto kondisi barang maksimal 5 MB");
      return;
    }
    setDispatchImage(file);
    setDispatchImageError(null);
  };

  const submitDispatch = () => {
    if (!activePurchaseOrder) return;
    const items = activePurchaseOrder.items
      .map((item) => ({
        purchaseOrderItemId: item.id,
        quantity: dispatchItemDrafts[item.id]?.quantity ?? "",
        warehouse: dispatchItemDrafts[item.id]?.warehouse ?? "REAR",
        note: dispatchItemDrafts[item.id]?.note ?? "",
      }))
      .filter((item) => Number(item.quantity) > 0);
    startTransition(async () => {
      const result = await recordMektekOutboundPurchaseOrderDispatch({
        purchaseOrderId: activePurchaseOrder.id,
        picId: dispatchDraft.picId,
        dispatchedAt: dispatchDraft.dispatchedAt,
        items,
      });
      if (!result || "error" in result) {
        toast.error(result?.error || "Gagal mencatat Barang Keluar");
        return;
      }
      let imageUploadError: string | null = null;
      const primaryReceipt = result.data.receipts[0];
      if (dispatchImage && primaryReceipt) {
        try {
          await uploadOutboundConditionImage(primaryReceipt.id, dispatchImage);
        } catch (error) {
          imageUploadError =
            error instanceof Error
              ? error.message
              : "Gagal mengunggah foto kondisi barang";
        }
      }
      if (imageUploadError) {
        toast.warning(`Barang Keluar tersimpan, tetapi ${imageUploadError}`);
      } else {
        toast.success(
          result.data.purchaseOrderStatus === "CLOSED"
            ? `Surat Jalan ${result.data.dispatchReference} tersimpan dan Monitoring PO otomatis Closed`
            : `Surat Jalan ${result.data.dispatchReference} tersimpan untuk ${result.data.receipts.length} item`,
        );
      }
      setActivePurchaseOrder(null);
      router.refresh();
    });
  };

  const statsCards = [
    {
      label: "PO Open",
      value: stats.openPurchaseOrders,
      icon: Clock3,
    },
    {
      label: "PO Closed",
      value: stats.closedPurchaseOrders,
      icon: CheckCircle2,
    },
    {
      label: "QTY Keluar",
      value: stats.totalReceived,
      icon: PackageMinus,
    },
    {
      label: "QTY Sisa",
      value: stats.totalRemaining,
      icon: Truck,
    },
  ];
  const hasInvalidCreateItems = draft.items.some((item) => {
    const quantity = Number(item.orderedQuantity);
    if (!Number.isSafeInteger(quantity) || quantity <= 0) return true;
    return item.source === "CATALOG"
      ? !item.catalogItemId
      : !item.partName.trim() || !item.partNumber.trim();
  });
  const activeProgress = activePurchaseOrder
    ? activePurchaseOrder.items.reduce(
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
  const hasSelectedDispatchItems =
    activePurchaseOrder?.items.some(
      (item) => Number(dispatchItemDrafts[item.id]?.quantity) > 0,
    ) ?? false;
  const activeOutboundBatches = useMemo(() => {
    if (!activePurchaseOrder) return [];
    const lines = activePurchaseOrder.items
      .flatMap((item) => item.receipts.map((receipt) => ({ item, receipt })))
      .sort((left, right) =>
        right.receipt.createdAt.localeCompare(left.receipt.createdAt),
      );
    const groups = new Map<string, OutboundBatchGroup>();
    for (const line of lines) {
      const current = groups.get(line.receipt.receivingReference);
      if (current) {
        current.lines.push(line);
        continue;
      }
      groups.set(line.receipt.receivingReference, {
        dispatchReference: line.receipt.receivingReference,
        dispatchedAt: line.receipt.receivedAt,
        createdAt: line.receipt.createdAt,
        pic: line.receipt.pic,
        lines: [line],
      });
    }
    return Array.from(groups.values());
  }, [activePurchaseOrder]);

  return (
    <div className="space-y-6">
      {mode === "overview" && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {statsCards.map(({ label, value, icon: Icon }) => (
              <Card key={label}>
                <CardContent className="flex items-center gap-3 p-4">
                  <Icon className="size-5 text-primary" aria-hidden="true" />
                  <div>
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="font-mono text-xl font-semibold tabular-nums">
                      {value}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Monitoring PO Pengiriman</h2>
              <p className="text-sm text-muted-foreground">
                Catat kebutuhan User, lalu proses Barang Keluar secara bertahap.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Dialog>
                <DialogTrigger asChild>
                  <Button type="button" variant="outline">
                    <FileSpreadsheet data-icon="inline-start" />
                    Export Excel
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Export Excel Monitoring PO</DialogTitle>
                    <DialogDescription>
                      Pilih jenis recap dan bulan yang ingin dimasukkan ke file
                      Excel.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="po-export-type">Jenis recap</Label>
                      <Select
                        value={exportType}
                        onValueChange={(value: LogisticsPoExportType) =>
                          setExportType(value)
                        }
                      >
                        <SelectTrigger id="po-export-type" className="w-full">
                          <SelectValue placeholder="Pilih jenis recap" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="delivery-note">
                            Recap Bulanan (SJ)
                          </SelectItem>
                          <SelectItem value="purchase-order">
                            Recap PO Bulanan (PO/User)
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="po-export-month">Bulan</Label>
                      <Input
                        id="po-export-month"
                        type="month"
                        max={currentMonth}
                        value={exportMonth}
                        onChange={(event) => setExportMonth(event.target.value)}
                      />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {exportRangeError ??
                      (exportType === "delivery-note"
                        ? "Recap dikelompokkan berdasarkan nomor SJ; satu SJ dapat berisi beberapa baris item."
                        : "Recap dikelompokkan berdasarkan nomor PO; nomor urut tetap sama untuk seluruh item dalam satu PO.")}
                  </p>
                  <div className="flex justify-end">
                    {exportRangeError ? (
                      <Button type="button" disabled>
                        <Download data-icon="inline-start" /> Download Excel
                      </Button>
                    ) : (
                      <Button asChild type="button">
                        <a href={exportHref}>
                          <Download data-icon="inline-start" /> Download Excel
                        </a>
                      </Button>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
              <Dialog open={createOpen} onOpenChange={setCreateOpen}>
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
                        <Input
                          id="outbound-user"
                          value={draft.userName}
                          onChange={(event) => updateDraft("userName", event.target.value)}
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
                        <Label htmlFor="outbound-po-type">Supply mode</Label>
                        <Select
                          value={draft.poType}
                          onValueChange={(value) => updateDraft("poType", value)}
                          disabled={isPending}
                        >
                          <SelectTrigger id="outbound-po-type">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Manual">Manual · one-off PO</SelectItem>
                            <SelectItem value="Consignment">Consignment · contract supply</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="outbound-input-date">Tanggal Pengiriman</Label>
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
                              dueDate: next,
                            }));
                          }}
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
                        <span className="font-normal text-destructive">(wajib)</span>
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Unggah PDF atau gambar PO yang diterima dari Customer.
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
                        required
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
            </div>
          </div>
        </>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {mode === "overview" ? "Riwayat Monitoring PO" : "Spreadsheet PO"}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1120px] text-sm">
              <thead className="border-y bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left">PO / Batch</th>
                  <th className="px-4 py-3 text-left">Nomor Surat Jalan</th>
                  <th className="px-4 py-3 text-left">User / Project</th>
                  <th className="px-4 py-3 text-left">Tanggal</th>
                  <th className="px-4 py-3 text-right">Item</th>
                  <th className="px-4 py-3 text-right">QTY Order</th>
                  <th className="px-4 py-3 text-right">QTY Keluar</th>
                  <th className="px-4 py-3 text-right">QTY Sisa</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {purchaseOrders.map((purchaseOrder) => (
                  <tr key={purchaseOrder.id} className="hover:bg-muted/20">
                    <td className="px-4 py-3">
                      <p className="font-mono font-medium">{purchaseOrder.poNumber}</p>
                      <p className="font-mono text-xs text-muted-foreground">
                        {
                          new Set(
                            purchaseOrder.items.flatMap((item) =>
                              item.receipts.map(
                                (receipt) => receipt.receivingReference,
                              ),
                            ),
                          ).size
                        }{" "}
                        batch Barang Keluar
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      {Array.from(
                        new Set(
                          purchaseOrder.items.flatMap((item) =>
                            item.receipts.map(
                              (receipt) => receipt.receivingReference,
                            ),
                          ),
                        ),
                      ).length > 0 ? (
                        <div className="space-y-1">
                          {Array.from(
                            new Set(
                              purchaseOrder.items.flatMap((item) =>
                                item.receipts.map(
                                  (receipt) => receipt.receivingReference,
                                ),
                              ),
                            ),
                          ).map((reference) => (
                            <p key={reference} className="font-mono text-xs">
                              {reference}
                            </p>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          Belum ada pengiriman
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{purchaseOrder.userName}</p>
                      <p className="text-xs text-muted-foreground">{purchaseOrder.projectName}</p>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDate(purchaseOrder.deliveryDate || purchaseOrder.inputDate)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">
                      {purchaseOrder.items.length}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold tabular-nums">
                      {purchaseOrder.items.reduce(
                        (sum, item) => sum + item.orderedQuantity,
                        0,
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold tabular-nums">
                      {purchaseOrder.items.reduce(
                        (sum, item) => sum + item.receivedQuantity,
                        0,
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold tabular-nums">
                      {purchaseOrder.items.reduce(
                        (sum, item) =>
                          sum + Math.max(item.orderedQuantity - item.receivedQuantity, 0),
                        0,
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={purchaseOrder.status === "CLOSED" ? "secondary" : "outline"}>
                        {getLogisticsStatusLabel(purchaseOrder.status)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap justify-end gap-2">
                        {purchaseOrder.hasCustomerPoImage && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            asChild
                            aria-label={`Lihat PO Customer ${purchaseOrder.poNumber}`}
                            title="Lihat PO Customer"
                          >
                            <a
                              href={`/api/mektek/logistics/purchase-orders/${encodeURIComponent(purchaseOrder.id)}/customer-po-image`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <Eye data-icon="inline-start" /> PO Customer
                            </a>
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => duplicatePurchaseOrder(purchaseOrder)}
                          aria-label={`Duplikat ${purchaseOrder.poNumber}`}
                          title="Duplikat PO"
                        >
                          <Copy data-icon="inline-start" />
                          <span className="hidden sm:inline">Duplikat</span>
                        </Button>
                        <Button type="button" variant="outline" size="sm" onClick={() => openPurchaseOrder(purchaseOrder)}>
                          <ReceiptText data-icon="inline-start" /> Detail
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {purchaseOrders.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-4 py-12 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <Truck className="size-8 text-muted-foreground" aria-hidden="true" />
                        <div>
                          <p className="text-sm font-medium">Belum ada Monitoring PO</p>
                          <p className="text-xs text-muted-foreground">
                            Buat PO pengiriman pertama untuk mulai mencatat Barang Keluar.
                          </p>
                        </div>
                        {mode === "overview" && (
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => setCreateOpen(true)}
                            disabled={isPending}
                          >
                            <Plus data-icon="inline-start" />
                            Buat PO Pengiriman
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={!!activePurchaseOrder}
        onOpenChange={(open) => !open && setActivePurchaseOrder(null)}
      >
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Detail Purchase Order Monitoring</DialogTitle>
            <DialogDescription>
              {activePurchaseOrder?.poNumber} · {activePurchaseOrder?.userName}
            </DialogDescription>
          </DialogHeader>

          {activePurchaseOrder && activeProgress && (
            <div className="space-y-5">
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
                            </div>
                          </div>
                          <div className="mt-3 divide-y rounded-md border">
                            {[...batch.lines]
                              .sort(
                                (left, right) =>
                                  left.item.position - right.item.position,
                              )
                              .map(({ item, receipt }) => (
                                <div key={receipt.id} className="p-3 text-sm">
                                  <div className="flex items-start justify-between gap-3">
                                    <div>
                                      <p className="font-medium">{item.partName}</p>
                                      <p className="text-xs text-muted-foreground">
                                        {item.partNumber || "Tanpa Part Number"} ·{" "}
                                        {receipt.warehouse === "FRONT"
                                          ? "Gudang Depan"
                                          : "Gudang Belakang"}
                                      </p>
                                    </div>
                                    <span className="font-mono font-semibold tabular-nums text-destructive">
                                      -{receipt.quantity}
                                    </span>
                                  </div>
                                  {receipt.note && (
                                    <p className="mt-2 text-xs text-muted-foreground">
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
                    Belum ada Barang Keluar untuk Monitoring PO ini.
                  </p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
