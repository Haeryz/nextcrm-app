"use client";

import {
  Camera,
  CheckCircle2,
  Clock3,
  Copy,
  Eye,
  ImagePlus,
  Loader2,
  PackageMinus,
  Pencil,
  Plus,
  Printer,
  ReceiptText,
  Save,
  Trash2,
  Truck,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  createMektekOutboundPurchaseOrder,
  recordMektekOutboundPurchaseOrderDispatch,
  updateMektekOutboundDispatch,
  updateMektekOutboundPurchaseOrder,
  type MektekOutboundPurchaseOrderInput,
  type MektekOutboundPurchaseOrderItemInput,
} from "@/actions/mektek/logistics";
import { CatalogOrManualItemPicker } from "@/app/[locale]/(routes)/mektek/_components/CatalogOrManualItemPicker";
import SupplierNameCombobox from "@/app/[locale]/(routes)/mektek/_components/SupplierNameCombobox";
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

import { ExportExcelMonitoringPoDialog } from "./ExportExcelMonitoringPoDialog";
import { EditOutboundPurchaseOrderDialog } from "./EditOutboundPurchaseOrderDialog";
import { CreateOutboundPurchaseOrderDialog } from "./CreateOutboundPurchaseOrderDialog";
import { DetailOutboundPurchaseOrderDialog } from "./DetailOutboundPurchaseOrderDialog";

export type CatalogOption = {
  id: string;
  description: string;
  partNumber: string | null;
  rearStock: number;
  frontStock: number;
};

export type OutboundReceiptRow = {
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

export type OutboundPurchaseOrder = {
  id: string;
  sourceServiceOrderId: string | null;
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

export type ItemDraft = {
  clientId: string;
  source: "CATALOG" | "MANUAL";
  catalogItemId: string;
  catalogQuery: string;
  partName: string;
  partNumber: string;
  orderedQuantity: string;
  note: string;
};

export type OutboundDraft = Omit<MektekOutboundPurchaseOrderInput, "items"> & {
  items: ItemDraft[];
};

type OutboundLogisticsManagerProps = {
  pics: Array<{ id: string; name: string }>;
  purchaseOrders: OutboundPurchaseOrder[];
  catalogItems: CatalogOption[];
  stats: OutboundStats;
  mode: "overview" | "spreadsheet";
  supplierNameSuggestions?: string[];
};

export type DispatchItemDraft = {
  quantity: string;
  warehouse: "REAR" | "FRONT";
  note: string;
};

export type OutboundBatchGroup = {
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
  supplierNameSuggestions = [],
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
  const detailCustomerPoInputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [createOpen, setCreateOpen] = useState(false);
  const [draft, setDraft] = useState<OutboundDraft>(restoredDraft.draft);
  const [customerPoFile, setCustomerPoFile] = useState<File | null>(null);
  const [customerPoError, setCustomerPoError] = useState<string | null>(null);
  const [activePurchaseOrder, setActivePurchaseOrder] =
    useState<OutboundPurchaseOrder | null>(null);
  const [editingPurchaseOrderId, setEditingPurchaseOrderId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<OutboundDraft | null>(null);
  const [dispatchDraft, setDispatchDraft] = useState({
    picId: pics[0]?.id ?? "",
    dispatchedAt: getCatalogInventoryLocalDateKey(),
  });
  const [dispatchItemDrafts, setDispatchItemDrafts] = useState<
    Record<string, DispatchItemDraft>
  >({});
  const [dispatchImage, setDispatchImage] = useState<File | null>(null);
  const [dispatchImageError, setDispatchImageError] = useState<string | null>(null);
  const [editingDispatchReference, setEditingDispatchReference] = useState<
    string | null
  >(null);
  const [dispatchRevisionDrafts, setDispatchRevisionDrafts] = useState<
    Record<string, DispatchItemDraft>
  >({});
  const [dispatchRevisionHeader, setDispatchRevisionHeader] = useState({
    picId: pics[0]?.id ?? "",
    dispatchedAt: getCatalogInventoryLocalDateKey(),
  });
  const [isSavingDispatchRevision, startSavingDispatchRevision] =
    useTransition();
  const [detailCustomerPoFile, setDetailCustomerPoFile] = useState<File | null>(null);
  const [detailCustomerPoError, setDetailCustomerPoError] = useState<string | null>(null);
  const [isUploadingDetailPo, startUploadingDetailPo] = useTransition();

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

  const selectDetailCustomerPoFile = (file: File | null) => {
    if (!file) {
      setDetailCustomerPoFile(null);
      setDetailCustomerPoError(null);
      return;
    }
    if (
      !["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(
        file.type,
      )
    ) {
      setDetailCustomerPoFile(null);
      setDetailCustomerPoError("Pilih PO Customer berformat JPEG, PNG, WebP, atau PDF");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setDetailCustomerPoFile(null);
      setDetailCustomerPoError("Ukuran PO Customer maksimal 5 MB");
      return;
    }
    setDetailCustomerPoFile(file);
    setDetailCustomerPoError(null);
  };

  const submitDetailCustomerPoImage = () => {
    if (!activePurchaseOrder || !detailCustomerPoFile) return;
    const purchaseOrderId = activePurchaseOrder.id;
    const file = detailCustomerPoFile;
    startUploadingDetailPo(async () => {
      try {
        await uploadCustomerPoImage(purchaseOrderId, file);
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Gagal mengunggah PO Customer",
        );
        return;
      }
      toast.success("PO Customer berhasil diperbarui");
      setDetailCustomerPoFile(null);
      setDetailCustomerPoError(null);
      if (detailCustomerPoInputRef.current) {
        detailCustomerPoInputRef.current.value = "";
      }
      setActivePurchaseOrder((current) =>
        current ? { ...current, hasCustomerPoImage: true } : current,
      );
      router.refresh();
    });
  };

  const submitPurchaseOrder = () => {
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
      if (customerPoFile) {
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
    setDetailCustomerPoFile(null);
    setDetailCustomerPoError(null);
    if (detailCustomerPoInputRef.current) {
      detailCustomerPoInputRef.current.value = "";
    }
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

  const openEditPurchaseOrder = (purchaseOrder: OutboundPurchaseOrder) => {
    setEditingPurchaseOrderId(purchaseOrder.id);
    setEditDraft({
      poNumber: purchaseOrder.poNumber,
      userName: purchaseOrder.userName,
      projectName: purchaseOrder.projectName,
      inputDate: purchaseOrder.inputDate.slice(0, 10),
      dueDate: purchaseOrder.dueDate.slice(0, 10),
      poType: purchaseOrder.poType,
      notes: purchaseOrder.notes ?? "",
      items: [...purchaseOrder.items]
        .sort((left, right) => left.position - right.position)
        .map((item) => ({
          clientId: item.id,
          source: item.source,
          catalogItemId: item.catalogItemId ?? "",
          catalogQuery: "",
          partName: item.partName,
          partNumber: item.partNumber ?? "",
          orderedQuantity: String(item.orderedQuantity),
          note: item.note ?? "",
        })),
    });
    setActivePurchaseOrder(null);
  };

  const submitEditedPurchaseOrder = () => {
    if (!editingPurchaseOrderId || !editDraft) return;
    startTransition(async () => {
      const result = await updateMektekOutboundPurchaseOrder({
        purchaseOrderId: editingPurchaseOrderId,
        poNumber: editDraft.poNumber.trim(),
        userName: editDraft.userName.trim(),
        projectName: editDraft.projectName.trim(),
        inputDate: editDraft.inputDate,
        dueDate: editDraft.dueDate,
        poType: editDraft.poType,
        notes: (editDraft.notes ?? "").trim(),
        items: editDraft.items.map((item) => ({
          purchaseOrderItemId: item.clientId,
          orderedQuantity: item.orderedQuantity,
          note: item.note.trim(),
        })),
      });
      if (!result || "error" in result) {
        toast.error(result?.error || "Gagal memperbarui Monitoring PO");
        return;
      }
      toast.success(`Monitoring PO ${result.data.poNumber} berhasil diperbarui`);
      setEditingPurchaseOrderId(null);
      setEditDraft(null);
      router.refresh();
    });
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

  const startEditDispatch = (batch: OutboundBatchGroup) => {
    const drafts: Record<string, DispatchItemDraft> = {};
    for (const { receipt } of batch.lines) {
      drafts[receipt.id] = {
        quantity: String(receipt.quantity),
        warehouse: receipt.warehouse,
        note: receipt.note ?? "",
      };
    }
    setDispatchRevisionDrafts(drafts);
    setDispatchRevisionHeader({
      picId: batch.pic.id,
      dispatchedAt: batch.dispatchedAt.slice(0, 10),
    });
    setEditingDispatchReference(batch.dispatchReference);
  };

  const cancelEditDispatch = () => {
    setEditingDispatchReference(null);
  };

  const updateDispatchRevisionDraft = <K extends keyof DispatchItemDraft>(
    receiptId: string,
    key: K,
    value: DispatchItemDraft[K],
  ) => {
    setDispatchRevisionDrafts((current) => ({
      ...current,
      [receiptId]: {
        quantity: current[receiptId]?.quantity ?? "",
        warehouse: current[receiptId]?.warehouse ?? "REAR",
        note: current[receiptId]?.note ?? "",
        [key]: value,
      },
    }));
  };

  const saveDispatchRevision = (batch: OutboundBatchGroup) => {
    if (!activePurchaseOrder) return;
    const items = batch.lines.map(({ receipt }) => {
      const draft = dispatchRevisionDrafts[receipt.id] ?? {
        quantity: String(receipt.quantity),
        warehouse: receipt.warehouse,
        note: receipt.note ?? "",
      };
      const raw = draft.quantity.trim();
      const quantity = Number(raw);
      if (!raw || !Number.isSafeInteger(quantity) || quantity <= 0) {
        throw new Error("QTY Surat Jalan harus berupa angka bulat lebih dari 0");
      }
      return {
        receiptId: receipt.id,
        quantity,
        warehouse: draft.warehouse,
        note: draft.note.trim(),
      };
    });
    startSavingDispatchRevision(async () => {
      try {
        const result = await updateMektekOutboundDispatch({
          purchaseOrderId: activePurchaseOrder.id,
          dispatchReference: batch.dispatchReference,
          picId: dispatchRevisionHeader.picId,
          dispatchedAt: dispatchRevisionHeader.dispatchedAt,
          items,
        });
        if (!result || "error" in result) {
          toast.error(result?.error || "Gagal memperbarui Surat Jalan");
          return;
        }
        const deltas = new Map(
          batch.lines.map(({ receipt }) => [
            receipt.id,
            Number(dispatchRevisionDrafts[receipt.id]?.quantity ?? receipt.quantity) -
              receipt.quantity,
          ]),
        );
        setActivePurchaseOrder((current) => {
          if (!current) return current;
          return {
            ...current,
            status: result.data.purchaseOrderStatus,
            items: current.items.map((item) => {
              const match = batch.lines.find((line) => line.item.id === item.id);
              if (!match) return item;
              const delta = deltas.get(match.receipt.id) ?? 0;
              const revision = dispatchRevisionDrafts[match.receipt.id];
              const receivedQuantity = item.receivedQuantity + delta;
              return {
                ...item,
                receivedQuantity,
                status:
                  receivedQuantity === item.orderedQuantity ? "CLOSED" : "OPEN",
                receipts: item.receipts.map((receipt) =>
                  receipt.id === match.receipt.id
                    ? {
                        ...receipt,
                        quantity: Number(
                          revision?.quantity ?? receipt.quantity,
                        ),
                        warehouse: revision?.warehouse ?? receipt.warehouse,
                        note: revision?.note.trim() || null,
                        receivedAt: result.data.dispatchedAt.toISOString(),
                        pic: result.data.pic,
                      }
                    : receipt,
                ),
              };
            }),
          };
        });
        setEditingDispatchReference(null);
        toast.success(
          `Surat Jalan ${result.data.dispatchReference} berhasil direvisi`,
        );
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Gagal merevisi quantity Surat Jalan",
        );
      }
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
  const editingPurchaseOrder = editingPurchaseOrderId
    ? purchaseOrders.find((purchaseOrder) => purchaseOrder.id === editingPurchaseOrderId) ?? null
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

  const outboundBatchReferences = useMemo(
    () =>
      purchaseOrders.map((purchaseOrder) =>
        Array.from(
          new Set(
            purchaseOrder.items.flatMap((item) =>
              item.receipts.map((receipt) => receipt.receivingReference),
            ),
          ),
        ),
      ),
    [purchaseOrders],
  );

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
              <ExportExcelMonitoringPoDialog />
              <CreateOutboundPurchaseOrderDialog
                open={createOpen}
                onOpenChange={setCreateOpen}
                draft={draft}
                setDraft={setDraft}
                updateDraft={updateDraft}
                submitPurchaseOrder={submitPurchaseOrder}
                supplierNameSuggestions={supplierNameSuggestions}
                catalogItems={catalogItems}
                selectedCatalogItemIds={selectedCatalogItemIds}
                isPending={isPending}
                switchItemSource={switchItemSource}
                updateCatalogQuery={updateCatalogQuery}
                selectCatalogItem={selectCatalogItem}
                updateItem={updateItem}
                addItem={addItem}
                hasInvalidCreateItems={hasInvalidCreateItems}
                customerPoFile={customerPoFile}
                customerPoError={customerPoError}
                selectCustomerPoFile={selectCustomerPoFile}
              />
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
            <table className="w-full min-w-[1220px] text-sm">
              <thead className="border-y bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left">PO / Batch</th>
                  <th className="px-4 py-3 text-left">Nomor Surat Jalan</th>
                  <th className="px-4 py-3 text-left">User / Project</th>
                  <th className="px-4 py-3 text-left">Tanggal</th>
                  <th className="px-4 py-3 text-left">Due Date</th>
                  <th className="px-4 py-3 text-right">Item</th>
                  <th className="px-4 py-3 text-right">QTY Order</th>
                  <th className="px-4 py-3 text-right">QTY Keluar</th>
                  <th className="px-4 py-3 text-right">QTY Sisa</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {purchaseOrders.map((purchaseOrder, index) => (
                  <tr
                    key={purchaseOrder.id}
                    className={
                      purchaseOrder.sourceServiceOrderId
                        ? "bg-orange-300/70 hover:bg-orange-400/70 dark:bg-orange-700/40 dark:hover:bg-orange-600/40"
                        : "hover:bg-muted/20"
                    }
                  >
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-mono font-medium">
                          {purchaseOrder.poNumber}
                        </p>
                        {purchaseOrder.sourceServiceOrderId ? (
                          <Badge className="border-orange-500 bg-orange-500 text-white hover:bg-orange-500 dark:border-orange-400 dark:bg-orange-500 dark:text-white">
                            Pesanan CS
                          </Badge>
                        ) : null}
                      </div>
                      <p className="font-mono text-xs text-muted-foreground">
                        {outboundBatchReferences[index].length} batch Barang Keluar
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      {outboundBatchReferences[index].length > 0 ? (
                        <div className="space-y-1">
                          {outboundBatchReferences[index].map((reference) => (
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
                      <p className="text-xs text-muted-foreground">
                        {purchaseOrder.projectName || "Tanpa jobsite"}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDate(purchaseOrder.deliveryDate || purchaseOrder.inputDate)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDate(purchaseOrder.dueDate)}
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

      <EditOutboundPurchaseOrderDialog
        open={!!editingPurchaseOrderId && !!editDraft}
        onOpenChange={(open) => {
          if (!open && !isPending) {
            setEditingPurchaseOrderId(null);
            setEditDraft(null);
          }
        }}
        editDraft={editDraft}
        setEditDraft={setEditDraft}
        setEditingPurchaseOrderId={setEditingPurchaseOrderId}
        isPending={isPending}
        submitEditedPurchaseOrder={submitEditedPurchaseOrder}
        editingPurchaseOrder={editingPurchaseOrder}
      />

      <DetailOutboundPurchaseOrderDialog
        open={!!activePurchaseOrder}
        onOpenChange={(open) => !open && setActivePurchaseOrder(null)}
        activePurchaseOrder={activePurchaseOrder}
        activeProgress={activeProgress}
        activeOutboundBatches={activeOutboundBatches}
        dispatchDraft={dispatchDraft}
        setDispatchDraft={setDispatchDraft}
        dispatchItemDrafts={dispatchItemDrafts}
        dispatchImage={dispatchImage}
        dispatchImageError={dispatchImageError}
        editingDispatchReference={editingDispatchReference}
        setEditingDispatchReference={setEditingDispatchReference}
        dispatchRevisionDrafts={dispatchRevisionDrafts}
        dispatchRevisionHeader={dispatchRevisionHeader}
        setDispatchRevisionHeader={setDispatchRevisionHeader}
        isSavingDispatchRevision={isSavingDispatchRevision}
        isUploadingDetailPo={isUploadingDetailPo}
        detailCustomerPoFile={detailCustomerPoFile}
        detailCustomerPoError={detailCustomerPoError}
        hasSelectedDispatchItems={hasSelectedDispatchItems}
        isPending={isPending}
        pics={pics}
        openEditPurchaseOrder={openEditPurchaseOrder}
        submitDispatch={submitDispatch}
        updateDispatchItem={updateDispatchItem}
        selectDispatchImage={selectDispatchImage}
        selectDetailCustomerPoFile={selectDetailCustomerPoFile}
        submitDetailCustomerPoImage={submitDetailCustomerPoImage}
        updateDispatchRevisionDraft={updateDispatchRevisionDraft}
        startEditDispatch={startEditDispatch}
        saveDispatchRevision={saveDispatchRevision}
        cancelEditDispatch={cancelEditDispatch}
        conditionCameraInputRef={conditionCameraInputRef}
        conditionGalleryInputRef={conditionGalleryInputRef}
        detailCustomerPoInputRef={detailCustomerPoInputRef}
      />
    </div>
  );
}
