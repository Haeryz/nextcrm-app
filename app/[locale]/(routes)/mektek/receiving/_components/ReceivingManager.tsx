"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Copy,
  Eye,
  Loader2,
  MessageCircle,
  PackageCheck,
  Pencil,
  Plus,
  Printer,
  ReceiptText,
  RefreshCw,
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
  updateMektekReceivingPurchaseOrder,
  type MektekReceivingPurchaseOrderInput,
  type MektekReceivingPurchaseOrderItemInput,
} from "@/actions/mektek/logistics";
import { sendMektekLogisticsDocumentWhatsApp } from "@/actions/mektek/logistics-document-whatsapp";
import { CatalogOrManualItemPicker } from "@/app/[locale]/(routes)/mektek/_components/CatalogOrManualItemPicker";
import SupplierNameCombobox from "@/app/[locale]/(routes)/mektek/_components/SupplierNameCombobox";
import { CreatePurchaseOrderDialog } from "./CreatePurchaseOrderDialog";
import { DetailPurchaseOrderDialog } from "./DetailPurchaseOrderDialog";
import { DetailPurchaseOrderReceivingDialog } from "./DetailPurchaseOrderReceivingDialog";
import { EditPurchaseOrderReceivingDialog } from "./EditPurchaseOrderReceivingDialog";
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
import { cn } from "@/lib/utils";

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

export type LogisticsPurchaseOrderRow = {
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
  hasMektekDeliveryNoteImage: boolean;
  mektekDeliveryNoteImageMimeType: string | null;
  mektekDeliveryNoteImageUpdatedAt: string | null;
  hasSupplierInvoiceImage: boolean;
  supplierInvoiceImageMimeType: string | null;
  supplierInvoiceImageUpdatedAt: string | null;
  hasSignedPoImage: boolean;
  signedPoImageMimeType: string | null;
  signedPoImageUpdatedAt: string | null;
  receivingDeliveryNoteSource: "SUPPLIER" | "MEKTEK" | null;
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
  initialPurchaseOrderId?: string;
  supplierNameSuggestions?: string[];
};

export type PurchaseOrderItemDraft = {
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

export type PurchaseOrderDraft = Omit<MektekReceivingPurchaseOrderInput, "items"> & {
  items: PurchaseOrderItemDraft[];
};

export type LogisticsReceiptItemDraft = {
  quantity: string;
  warehouse: "REAR" | "FRONT";
  note: string;
};

export type ReceiptItemPhotoDraft = {
  file: File | null;
  error: string | null;
};

export type LogisticsReceivingBatchGroup = {
  receivingReference: string;
  receivedAt: string;
  createdAt: string;
  pic: { id: string; name: string };
  lines: Array<{
    item: LogisticsPurchaseOrderItemRow;
    receipt: LogisticsReceiptRow;
  }>;
};

export type ReceivingEditItemDraft = {
  clientId: string;
  itemId: string | null;
  isNew: boolean;
  source: "CATALOG" | "MANUAL";
  catalogItemId: string;
  catalogQuery: string;
  partName: string;
  partNumber: string;
  machine: string;
  orderedQuantity: string;
  unitPrice: string;
  warehouse: "REAR" | "FRONT" | "";
  note: string;
  receivedQuantity: number;
};

export type ReceivingEditDraft = {
  poNumber: string;
  supplierName: string;
  projectName: string;
  inputDate: string;
  dueDate: string;
  poType: string;
  notes: string;
  items: ReceivingEditItemDraft[];
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

const RECEIVING_DRAFT_STORAGE_KEY = "mektek:receiving-po-draft";

function restoreReceivingDraft(): {
  draft: PurchaseOrderDraft;
  nextId: number;
} {
  const blank = blankPurchaseOrder();
  if (typeof window === "undefined") return { draft: blank, nextId: 2 };
  try {
    const stored = window.sessionStorage.getItem(RECEIVING_DRAFT_STORAGE_KEY);
    if (!stored) return { draft: blank, nextId: 2 };
    const parsed = JSON.parse(stored) as PurchaseOrderDraft;
    if (!parsed || !Array.isArray(parsed.items) || parsed.items.length === 0) {
      return { draft: blank, nextId: 2 };
    }
    const maxId = parsed.items.reduce((max, item) => {
      const match = item.clientId.match(/^item-(\d+)$/);
      return match ? Math.max(max, Number(match[1])) : max;
    }, 1);
    return { draft: parsed, nextId: maxId + 1 };
  } catch {
    return { draft: blank, nextId: 2 };
  }
}

const rupiahFormatter = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

function formatRupiah(value: number) {
  return rupiahFormatter.format(value);
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

async function uploadSupplierInvoiceImage(
  purchaseOrderId: string,
  file: File,
) {
  const response = await fetch(
    `/api/mektek/logistics/purchase-orders/${encodeURIComponent(purchaseOrderId)}/supplier-invoice-image`,
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
    throw new Error(payload?.error || "Gagal mengunggah Faktur supplier");
  }
}

async function uploadMektekDeliveryNoteImage(
  purchaseOrderId: string,
  file: File,
) {
  const response = await fetch(
    `/api/mektek/logistics/purchase-orders/${encodeURIComponent(purchaseOrderId)}/mektek-delivery-note-image`,
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
    throw new Error(
      payload?.error || "Gagal mengunggah foto Surat Jalan Mektek",
    );
  }
}

async function uploadSignedPoImage(
  purchaseOrderId: string,
  file: File,
) {
  const response = await fetch(
    `/api/mektek/logistics/purchase-orders/${encodeURIComponent(purchaseOrderId)}/signed-po-image`,
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
    throw new Error(
      payload?.error || "Gagal mengunggah PO yang ditandatangani",
    );
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
  initialPurchaseOrderId,
  supplierNameSuggestions = [],
}: ReceivingManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  // Restored once, via a lazy state initialiser. `useRef(restoreReceivingDraft().nextId)`
  // is NOT lazy — it re-ran the synchronous sessionStorage read + JSON.parse on every
  // render and discarded the result. Sharing one restore also removes the second call
  // that seeded `createValue` below.
  const [restoredDraft] = useState(restoreReceivingDraft);
  const nextItemId = useRef(restoredDraft.nextId);
  const supplierInvoiceInputRef = useRef<HTMLInputElement>(null);
  const deliveryNoteInputRef = useRef<HTMLInputElement>(null);
  const mektekDeliveryNoteInputRef = useRef<HTMLInputElement>(null);
  const signedPoInputRef = useRef<HTMLInputElement>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [isUploadingDeliveryNote, startUploadingDeliveryNote] = useTransition();
  const [isUploadingMektekDeliveryNote, startUploadingMektekDeliveryNote] =
    useTransition();
  const [isUploadingSignedPo, startUploadingSignedPo] = useTransition();
  const [isUploadingSupplierInvoice, startUploadingSupplierInvoice] =
    useTransition();
  const [isCreatingMektekDeliveryNote, startCreatingMektekDeliveryNote] =
    useTransition();
  const [isSelectingDeliveryNoteSource, startSelectingDeliveryNoteSource] =
    useTransition();
  const [createValue, setCreateValue] = useState<PurchaseOrderDraft>(
    restoredDraft.draft,
  );
  const [activeReceiptPurchaseOrder, setActiveReceiptPurchaseOrder] =
    useState<LogisticsPurchaseOrderRow | null>(
      () =>
        purchaseOrders.find(
          (purchaseOrder) => purchaseOrder.id === initialPurchaseOrderId,
        ) ?? null,
    );
  const [activePurchaseOrder, setActivePurchaseOrder] =
    useState<LogisticsPurchaseOrderRow | null>(null);
  const [editingPurchaseOrderId, setEditingPurchaseOrderId] = useState<
    string | null
  >(null);
  const [editDraft, setEditDraft] = useState<ReceivingEditDraft | null>(null);
  const [isSavingEdit, startSavingEdit] = useTransition();
  const nextEditItemId = useRef(1);
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

  useEffect(() => {
    if (typeof window === "undefined") return;
    const firstItem = createValue.items[0];
    const isBlank =
      createValue.items.length === 1 &&
      !createValue.poNumber &&
      !createValue.supplierName &&
      !createValue.projectName &&
      (!firstItem ||
        (!firstItem.catalogItemId && !firstItem.partName));
    if (isBlank) {
      window.sessionStorage.removeItem(RECEIVING_DRAFT_STORAGE_KEY);
    } else {
      try {
        window.sessionStorage.setItem(
          RECEIVING_DRAFT_STORAGE_KEY,
          JSON.stringify(createValue),
        );
      } catch {
        // storage full or unavailable
      }
    }
  }, [createValue]);

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
              unitPrice: "",
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
        poNumber: createValue.poNumber.trim(),
        supplierName: createValue.supplierName.trim(),
        projectName: createValue.projectName.trim(),
        inputDate: createValue.inputDate,
        dueDate: createValue.dueDate,
        poType: createValue.poType,
        notes: (createValue.notes ?? "").trim(),
        items: createValue.items.map((item) =>
          toReceivingPurchaseOrderItem({
            ...item,
            partName: item.partName.trim(),
            partNumber: item.partNumber.trim(),
            machine: item.machine.trim(),
          }),
        ),
      });
      if (!result || "error" in result) {
        toast.error(result?.error || "Gagal membuat Purchase Order");
        return;
      }
      toast.success(`Purchase Order ${result.data.poNumber} berhasil dibuat`);
      if (typeof window !== "undefined") {
        window.sessionStorage.removeItem(RECEIVING_DRAFT_STORAGE_KEY);
      }
      nextItemId.current = 2;
      setCreateValue(blankPurchaseOrder());
      setCreateOpen(false);
      router.refresh();
    });
  };

  const openReceipt = (purchaseOrder: LogisticsPurchaseOrderRow) => {
    setActiveReceiptPurchaseOrder(purchaseOrder);
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

  const duplicatePurchaseOrder = (purchaseOrder: LogisticsPurchaseOrderRow) => {
    const items = purchaseOrder.items.map((item, index) => ({
      clientId: `item-${index + 1}`,
      source: item.source,
      catalogItemId: item.catalogItemId ?? "",
      catalogQuery:
        item.source === "CATALOG" && item.catalogItemId
          ? `${item.partName} · ${item.partNumber || "Tanpa PN"}`
          : "",
      partName: item.partName,
      partNumber: item.partNumber ?? "",
      machine: item.machine ?? "",
      warehouse: item.warehouse ?? "REAR",
      orderedQuantity: String(item.orderedQuantity),
      unitPrice: item.agreedUnitPrice ?? "",
    }));
    nextItemId.current = items.length + 1;
    setCreateValue({
      poNumber: "",
      supplierName: purchaseOrder.supplierName,
      projectName: purchaseOrder.projectName,
      inputDate: getCatalogInventoryLocalDateKey(),
      dueDate: getCatalogInventoryLocalDateKey(),
      poType: purchaseOrder.poType,
      notes: purchaseOrder.notes ?? "",
      items,
    });
    setCreateOpen(true);
  };

  const openEditPurchaseOrder = (purchaseOrder: LogisticsPurchaseOrderRow) => {
    setEditDraft({
      poNumber: purchaseOrder.poNumber,
      supplierName: purchaseOrder.supplierName,
      projectName: purchaseOrder.projectName,
      inputDate: purchaseOrder.inputDate.slice(0, 10),
      dueDate: purchaseOrder.dueDate.slice(0, 10),
      poType: purchaseOrder.poType,
      notes: purchaseOrder.notes ?? "",
      items: [...purchaseOrder.items]
        .sort((left, right) => left.position - right.position)
        .map((item) => ({
          clientId: item.id,
          itemId: item.id,
          isNew: false,
          source: item.source,
          catalogItemId: item.catalogItemId ?? "",
          catalogQuery: "",
          partName: item.partName,
          partNumber: item.partNumber ?? "",
          machine: item.machine ?? "",
          orderedQuantity: String(item.orderedQuantity),
          unitPrice: item.agreedUnitPrice ?? "",
          warehouse: item.warehouse ?? "",
          note: item.note ?? "",
          receivedQuantity: item.receivedQuantity,
        })),
    });
    nextEditItemId.current = 1;
    setEditingPurchaseOrderId(purchaseOrder.id);
    setActiveReceiptPurchaseOrder(null);
  };

  const updateEditItem = <K extends keyof ReceivingEditItemDraft>(
    itemId: string,
    key: K,
    value: ReceivingEditItemDraft[K],
  ) => {
    setEditDraft((current) => {
      if (!current) return current;
      return {
        ...current,
        items: current.items.map((item) =>
          item.clientId === itemId ? { ...item, [key]: value } : item,
        ),
      };
    });
  };

  const addEditItem = () => {
    const clientId = `edit-item-${nextEditItemId.current}`;
    nextEditItemId.current += 1;
    setEditDraft((current) => {
      if (!current) return current;
      return {
        ...current,
        items: [
          ...current.items,
          {
            clientId,
            itemId: null,
            isNew: true,
            source: "CATALOG",
            catalogItemId: "",
            catalogQuery: "",
            partName: "",
            partNumber: "",
            machine: "",
            orderedQuantity: "",
            unitPrice: "",
            warehouse: "REAR",
            note: "",
            receivedQuantity: 0,
          },
        ],
      };
    });
  };

  const removeEditItem = (clientId: string) => {
    setEditDraft((current) => {
      if (!current) return current;
      return {
        ...current,
        items: current.items.filter((item) => item.clientId !== clientId),
      };
    });
  };

  const switchEditItemSource = (
    clientId: string,
    source: ReceivingEditItemDraft["source"],
  ) => {
    setEditDraft((current) => {
      if (!current) return current;
      return {
        ...current,
        items: current.items.map((item) =>
          item.clientId === clientId
            ? {
                ...item,
                source,
                catalogItemId: "",
                catalogQuery: "",
                partName: "",
                partNumber: "",
                machine: "",
                unitPrice: "",
                orderedQuantity: item.orderedQuantity,
              }
            : item,
        ),
      };
    });
  };

  const updateEditCatalogQuery = (clientId: string, catalogQuery: string) => {
    setEditDraft((current) => {
      if (!current) return current;
      return {
        ...current,
        items: current.items.map((item) =>
          item.clientId === clientId
            ? { ...item, catalogItemId: "", catalogQuery, unitPrice: "" }
            : item,
        ),
      };
    });
  };

  const selectEditCatalogItem = (
    clientId: string,
    catalogItem: {
      id: string;
      description: string;
      partNumber: string | null;
      price?: number | null;
    },
  ) => {
    setEditDraft((current) => {
      if (!current) return current;
      return {
        ...current,
        items: current.items.map((item) =>
          item.clientId === clientId
            ? {
                ...item,
                catalogItemId: catalogItem.id,
                catalogQuery: `${catalogItem.description} · ${catalogItem.partNumber || "Tanpa PN"}`,
                unitPrice: "",
              }
            : item,
        ),
      };
    });
  };

  const submitEditedPurchaseOrder = () => {
    if (!editingPurchaseOrderId || !editDraft) return;
    startSavingEdit(async () => {
      const result = await updateMektekReceivingPurchaseOrder({
        purchaseOrderId: editingPurchaseOrderId,
        poNumber: editDraft.poNumber.trim(),
        supplierName: editDraft.supplierName.trim(),
        projectName: editDraft.projectName.trim(),
        inputDate: editDraft.inputDate,
        dueDate: editDraft.dueDate,
        poType: editDraft.poType,
        notes: editDraft.notes.trim(),
        items: editDraft.items.map((item) => {
          if (item.itemId) {
            return {
              purchaseOrderItemId: item.itemId,
              orderedQuantity: item.orderedQuantity,
              unitPrice: item.unitPrice,
              warehouse:
                item.warehouse === "REAR" || item.warehouse === "FRONT"
                  ? item.warehouse
                  : undefined,
              note: item.note,
            };
          }
          return {
            source: item.source,
            catalogItemId: item.catalogItemId,
            partName: item.partName.trim(),
            partNumber: item.partNumber.trim(),
            machine: item.machine.trim(),
            orderedQuantity: item.orderedQuantity,
            unitPrice: item.unitPrice,
            warehouse:
              item.warehouse === "REAR" || item.warehouse === "FRONT"
                ? item.warehouse
                : "REAR",
            note: item.note,
          };
        }),
      });
      if (!result || "error" in result) {
        toast.error(result?.error || "Gagal memperbarui Purchase Order Receiving");
        return;
      }
      toast.success(
        `Purchase Order Receiving ${result.data.poNumber} berhasil diperbarui`,
      );
      setEditingPurchaseOrderId(null);
      setEditDraft(null);
      router.refresh();
    });
  };

  const selectSupplierDeliveryNote = (file: File | null) => {
    if (!activeReceiptPurchaseOrder || !file) return;
    startUploadingDeliveryNote(async () => {
      try {
        await uploadSupplierDeliveryNoteImage(
          activeReceiptPurchaseOrder.id,
          file,
        );
        toast.success("Surat Jalan supplier berhasil diunggah");
        setActiveReceiptPurchaseOrder({
          ...activeReceiptPurchaseOrder,
          hasDeliveryNoteImage: true,
          deliveryNoteImageMimeType: file.type,
          deliveryNoteImageUpdatedAt: new Date().toISOString(),
          receivingDeliveryNoteSource: "SUPPLIER",
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

  const selectSupplierInvoice = (file: File | null) => {
    if (!activeReceiptPurchaseOrder || !file) return;
    startUploadingSupplierInvoice(async () => {
      try {
        await uploadSupplierInvoiceImage(activeReceiptPurchaseOrder.id, file);
        toast.success("Faktur supplier berhasil diunggah");
        setActiveReceiptPurchaseOrder({
          ...activeReceiptPurchaseOrder,
          hasSupplierInvoiceImage: true,
          supplierInvoiceImageMimeType: file.type,
          supplierInvoiceImageUpdatedAt: new Date().toISOString(),
        });
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Gagal mengunggah Faktur supplier",
        );
      }
    });
  };

  const selectMektekDeliveryNoteImage = (file: File | null) => {
    if (!activeReceiptPurchaseOrder || !file) return;
    startUploadingMektekDeliveryNote(async () => {
      try {
        await uploadMektekDeliveryNoteImage(
          activeReceiptPurchaseOrder.id,
          file,
        );
        toast.success("Foto Surat Jalan Mektek berhasil diunggah");
        setActiveReceiptPurchaseOrder({
          ...activeReceiptPurchaseOrder,
          hasMektekDeliveryNoteImage: true,
          mektekDeliveryNoteImageMimeType: file.type,
          mektekDeliveryNoteImageUpdatedAt: new Date().toISOString(),
          receivingDeliveryNoteSource: "MEKTEK",
        });
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Gagal mengunggah foto Surat Jalan Mektek",
        );
      }
    });
  };

  const selectSignedPoImage = (file: File | null) => {
    if (!activeReceiptPurchaseOrder || !file) return;
    startUploadingSignedPo(async () => {
      try {
        await uploadSignedPoImage(activeReceiptPurchaseOrder.id, file);
        toast.success("PO yang ditandatangani berhasil diunggah");
        setActiveReceiptPurchaseOrder({
          ...activeReceiptPurchaseOrder,
          hasSignedPoImage: true,
          signedPoImageMimeType: file.type,
          signedPoImageUpdatedAt: new Date().toISOString(),
        });
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Gagal mengunggah PO yang ditandatangani",
        );
      }
    });
  };

  const createMektekDeliveryNote = () => {
    if (!activeReceiptPurchaseOrder) return;

    startCreatingMektekDeliveryNote(async () => {
      try {
        const response = await fetch(
          `/api/mektek/logistics/purchase-orders/${encodeURIComponent(activeReceiptPurchaseOrder.id)}/delivery-note?flow=receiving`,
          { method: "POST" },
        );
        const payload = (await response.json().catch(() => null)) as
          | { data?: { pdfPath?: string }; error?: string }
          | null;
        if (!response.ok) {
          throw new Error(payload?.error || "Gagal membuat Surat Jalan Mektek");
        }

        const pdfPath =
          payload?.data?.pdfPath ||
          `/api/mektek/logistics/purchase-orders/${encodeURIComponent(activeReceiptPurchaseOrder.id)}/delivery-note?flow=receiving`;
        setActiveReceiptPurchaseOrder({
          ...activeReceiptPurchaseOrder,
          receivingDeliveryNoteSource: "MEKTEK",
        });
        toast.success("Surat Jalan Mektek berhasil dibuat");
        window.open(pdfPath, "_blank", "noopener,noreferrer");
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Gagal membuat Surat Jalan Mektek",
        );
      }
    });
  };

  const selectExistingSupplierDeliveryNote = () => {
    if (!activeReceiptPurchaseOrder) return;
    startSelectingDeliveryNoteSource(async () => {
      try {
        const response = await fetch(
          `/api/mektek/logistics/purchase-orders/${encodeURIComponent(activeReceiptPurchaseOrder.id)}/delivery-note-image`,
          { method: "PATCH" },
        );
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        if (!response.ok) {
          throw new Error(
            payload?.error || "Gagal memilih Surat Jalan supplier",
          );
        }
        setActiveReceiptPurchaseOrder({
          ...activeReceiptPurchaseOrder,
          receivingDeliveryNoteSource: "SUPPLIER",
        });
        toast.success("Surat Jalan supplier dipilih sebagai dokumen aktif");
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Gagal memilih Surat Jalan supplier",
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
        !item.machine.trim() ||
        Number(item.unitPrice) <= 0,
  );
  const createPurchaseOrderTotal = createValue.items.reduce(
    (total, item) =>
      total +
      (Number(item.orderedQuantity) || 0) * (Number(item.unitPrice) || 0),
    0,
  );
  const selectedEditCatalogItemIds = useMemo(
    () =>
      new Set(
        (editDraft?.items ?? []).flatMap((item) =>
          item.isNew && item.source === "CATALOG" && item.catalogItemId
            ? [item.catalogItemId]
            : [],
        ),
      ),
    [editDraft?.items],
  );
  const hasInvalidEditItems = (editDraft?.items ?? []).some((item) =>
    item.isNew
      ? item.source === "CATALOG"
        ? !item.catalogItemId ||
          Number(item.orderedQuantity) <= 0 ||
          Number(item.unitPrice) < 0
        : !item.partName.trim() ||
          !item.machine.trim() ||
          Number(item.orderedQuantity) <= 0 ||
          Number(item.unitPrice) <= 0
      : Number(item.orderedQuantity) <= 0 || Number(item.unitPrice) < 0,
  );
  const editPurchaseOrderTotal = (editDraft?.items ?? []).reduce(
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

  const purchaseOrderRows = useMemo(
    () =>
      purchaseOrders.map((purchaseOrder) => {
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
            total + item.orderedQuantity * Number(item.agreedUnitPrice || 0),
          0,
        );
        return {
          id: purchaseOrder.id,
          progress,
          isOverdue,
          purchaseOrderTotal,
        };
      }),
    [purchaseOrders, today],
  );

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
              <CreatePurchaseOrderDialog
                open={createOpen}
                onOpenChange={setCreateOpen}
                createValue={createValue}
                setCreateValue={setCreateValue}
                updateCreateValue={updateCreateValue}
                submitPurchaseOrder={submitPurchaseOrder}
                supplierNameSuggestions={supplierNameSuggestions}
                isPending={isPending}
                catalogItems={catalogItems}
                selectedCatalogItemIds={selectedCatalogItemIds}
                removeItem={removeItem}
                switchItemSource={switchItemSource}
                updateCatalogQuery={updateCatalogQuery}
                selectCatalogItem={selectCatalogItem}
                updateItem={updateItem}
                addItem={addItem}
                createPurchaseOrderTotal={createPurchaseOrderTotal}
                hasInvalidCreateItems={hasInvalidCreateItems}
              />
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
                  {purchaseOrders.map((purchaseOrder, index) => {
                    const row = purchaseOrderRows[index];
                    const totalOrdered = row.progress.orderedQuantity;
                    const totalRemaining = row.progress.remainingQuantity;

                    return (
                      <div
                        key={purchaseOrder.id}
                        role="button"
                        tabIndex={0}
                        className="flex w-full cursor-pointer items-center gap-3 rounded-none px-4 py-4 text-left transition-colors hover:bg-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                        onClick={() => setActivePurchaseOrder(purchaseOrder)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            setActivePurchaseOrder(purchaseOrder);
                          }
                        }}
                        aria-label={`Lihat detail Purchase Order ${purchaseOrder.poNumber}`}
                      >
                        <div className="grid w-full gap-3 sm:grid-cols-[minmax(180px,1fr)_minmax(180px,1fr)_auto_auto_auto] sm:items-center">
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
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="shrink-0"
                            onClick={(event) => {
                              event.stopPropagation();
                              duplicatePurchaseOrder(purchaseOrder);
                            }}
                            aria-label={`Duplikat Purchase Order ${purchaseOrder.poNumber}`}
                            title="Duplikat PO"
                          >
                            <Copy data-icon="inline-start" />
                            <span className="hidden sm:inline">Duplikat</span>
                          </Button>
                          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 p-8 text-center">
                  <PackageCheck className="size-8 text-muted-foreground" aria-hidden="true" />
                  <div>
                    <p className="text-sm font-medium">Belum ada Purchase Order Logistics</p>
                    <p className="text-xs text-muted-foreground">
                      Buat PO pertama untuk mulai mencatat barang masuk dari supplier.
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setCreateOpen(true)}
                    disabled={isPending}
                  >
                    <Plus data-icon="inline-start" />
                    Buat Purchase Order
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <DetailPurchaseOrderDialog
            open={!!activePurchaseOrder}
            onOpenChange={(open) => !open && setActivePurchaseOrder(null)}
            activePurchaseOrder={activePurchaseOrder}
            documentPhone={documentPhone}
            setDocumentPhone={setDocumentPhone}
            isSendingDocument={isSendingDocument}
            sendDocument={sendDocument}
          />
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
                  <th className="min-w-40 border-b border-e px-3 py-3 text-left">
                    Supplier / Tujuan PO
                  </th>
                  <th className="min-w-36 border-b border-e px-3 py-3 text-left">
                    No PO
                  </th>
                  <th className="min-w-44 border-b border-e px-3 py-3 text-left">
                    Job Site
                  </th>
                  <th className="min-w-32 border-b border-e px-3 py-3 text-left">
                    Tanggal Create
                  </th>
                  <th className="min-w-32 border-b border-e px-3 py-3 text-left">Due Date</th>
                  <th className="min-w-28 border-b border-e px-3 py-3 text-left">PO Type</th>
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
                  const row = purchaseOrderRows[index];
                  const progress = row.progress;
                  const isOverdue = row.isOverdue;
                  const purchaseOrderTotal = row.purchaseOrderTotal;
                  return (
                    <tr
                      key={purchaseOrder.id}
                      className="border-b last:border-b-0 hover:bg-muted/20"
                    >
                      <td className="border-e px-3 py-3 text-center font-mono tabular-nums">
                        {index + 1}
                      </td>
                      <td className="border-e px-3 py-3">{purchaseOrder.supplierName}</td>
                      <td className="border-e px-3 py-3 font-mono font-medium">
                        {purchaseOrder.poNumber}
                      </td>
                      <td className="border-e px-3 py-3">{purchaseOrder.projectName}</td>
                      <td className="border-e px-3 py-3">{formatDate(purchaseOrder.inputDate)}</td>
                      <td className="border-e px-3 py-3">
                        <div className="flex flex-col items-start gap-1">
                          <span>{formatDate(purchaseOrder.dueDate)}</span>
                          {isOverdue && <Badge variant="destructive">Terlambat</Badge>}
                        </div>
                      </td>
                      <td className="border-e px-3 py-3">{purchaseOrder.poType}</td>
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

      <DetailPurchaseOrderReceivingDialog
        open={!!activeReceiptPurchaseOrder}
        onOpenChange={(open) => !open && setActiveReceiptPurchaseOrder(null)}
        activeReceiptPurchaseOrder={activeReceiptPurchaseOrder}
        activeProgress={activeProgress}
        activePurchaseOrderTotal={activePurchaseOrderTotal}
        activeReceivingBatches={activeReceivingBatches}
        hasSelectedReceiptItems={hasSelectedReceiptItems}
        receiptDraft={receiptDraft}
        setReceiptDraft={setReceiptDraft}
        receiptItemDrafts={receiptItemDrafts}
        receiptItemPhotos={receiptItemPhotos}
        pics={pics}
        isPending={isPending}
        isSavingEdit={isSavingEdit}
        isSelectingDeliveryNoteSource={isSelectingDeliveryNoteSource}
        isCreatingMektekDeliveryNote={isCreatingMektekDeliveryNote}
        isUploadingDeliveryNote={isUploadingDeliveryNote}
        isUploadingMektekDeliveryNote={isUploadingMektekDeliveryNote}
        isUploadingSignedPo={isUploadingSignedPo}
        isUploadingSupplierInvoice={isUploadingSupplierInvoice}
        openEditPurchaseOrder={openEditPurchaseOrder}
        submitReceipt={submitReceipt}
        updateReceiptItem={updateReceiptItem}
        selectExistingSupplierDeliveryNote={selectExistingSupplierDeliveryNote}
        selectSupplierDeliveryNote={selectSupplierDeliveryNote}
        selectSupplierInvoice={selectSupplierInvoice}
        selectMektekDeliveryNoteImage={selectMektekDeliveryNoteImage}
        selectSignedPoImage={selectSignedPoImage}
        selectReceiptItemPhoto={selectReceiptItemPhoto}
        createMektekDeliveryNote={createMektekDeliveryNote}
        supplierInvoiceInputRef={supplierInvoiceInputRef}
        deliveryNoteInputRef={deliveryNoteInputRef}
        mektekDeliveryNoteInputRef={mektekDeliveryNoteInputRef}
        signedPoInputRef={signedPoInputRef}
      />

      <EditPurchaseOrderReceivingDialog
        open={!!editingPurchaseOrderId && !!editDraft}
        onOpenChange={(open) => {
          if (!open && !isSavingEdit) {
            setEditingPurchaseOrderId(null);
            setEditDraft(null);
          }
        }}
        editDraft={editDraft}
        setEditDraft={setEditDraft}
        setEditingPurchaseOrderId={setEditingPurchaseOrderId}
        isSavingEdit={isSavingEdit}
        isPending={isPending}
        submitEditedPurchaseOrder={submitEditedPurchaseOrder}
        updateEditItem={updateEditItem}
        addEditItem={addEditItem}
        removeEditItem={removeEditItem}
        switchEditItemSource={switchEditItemSource}
        updateEditCatalogQuery={updateEditCatalogQuery}
        selectEditCatalogItem={selectEditCatalogItem}
        editPurchaseOrderTotal={editPurchaseOrderTotal}
        hasInvalidEditItems={hasInvalidEditItems}
        selectedEditCatalogItemIds={selectedEditCatalogItemIds}
        catalogItems={catalogItems}
        supplierNameSuggestions={supplierNameSuggestions}
      />
        </>
      )}
    </div>
  );
}
