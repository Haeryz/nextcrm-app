"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import {
  Download,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import {
  createFinanceInvoiceEntry,
  deleteFinanceInvoiceEntry,
  searchFinancePurchaseOrders,
  updateFinanceInvoiceEntry,
  type FinanceInvoiceEntryInput,
} from "@/actions/mektek/finance";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { classifyFinanceRevenueLine } from "@/lib/mektek/finance";
import { FINANCE_DESTINATION_BANK_OPTIONS } from "@/lib/mektek/finance-bank-accounts";
import {
  FINANCE_INVOICE_SIGNERS,
  type FinanceInvoiceSigner,
} from "@/lib/mektek/finance-invoice-signers";
import {
  shouldSearchFinancePurchaseOrders,
  type FinancePurchaseOrderSuggestion,
} from "@/lib/mektek/finance-po";

export type FinanceInvoiceSourceRow = {
  id: string;
  purchaseOrderId: string;
  purchaseOrderNumber: string;
  purchaseOrderMode: "MANUAL" | "CONSIGNMENT";
  customerName: string;
  projectName: string;
  purchaseOrderDate: string;
  dueDate: string;
  deliveryNoteNumber: string;
  deliveryNoteDate: string;
  description: string;
  subtotal: string;
  pricingComplete: boolean;
};

export type FinanceInvoiceCrudRow = {
  id: string;
  invoiceNumber: string;
  displayNumber: string;
  customerName: string;
  status: string;
  invoiceDate: string;
  dueDate: string;
  deliveryNoteNumber: string;
  deliveryNoteDate: string;
  receiptNumber: string;
  purchaseOrderNumber: string;
  purchaseOrderDate: string;
  description: string;
  subtotal: number;
  taxRate: number;
  taxInvoiceNumber: string;
  accountDestination: string;
  notes: string;
  total: number;
  balance: number;
  hasPayment: boolean;
  classificationIssue: boolean;
  classificationDescriptions: string[];
  sources: FinanceInvoiceSourceRow[];
};

type InvoiceFormState = Omit<FinanceInvoiceEntryInput, "subtotal" | "taxRate"> & {
  subtotal: string;
  taxRate: string;
};

const emptyForm: InvoiceFormState = {
  customerName: "",
  deliveryNoteNumber: "",
  deliveryNoteDate: "",
  receiptNumber: "",
  invoiceNumber: "",
  invoiceDate: new Date().toISOString().slice(0, 10),
  dueDate: "",
  purchaseOrderNumber: "",
  purchaseOrderDate: "",
  description: "",
  subtotal: "",
  taxRate: "11",
  taxInvoiceNumber: "",
  accountDestination: "",
  notes: "",
};

const idr = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

const statusLabel: Record<string, string> = {
  DRAFT: "Draf",
  PENDING_APPROVAL: "Menunggu persetujuan",
  ISSUED: "Terbit",
  PARTIALLY_PAID: "Dibayar sebagian",
  PAID: "Lunas",
  VOID: "Dibatalkan",
};

function fieldValue(form: InvoiceFormState, name: keyof InvoiceFormState) {
  return String(form[name] ?? "");
}

const invoiceFormFromRow = (
  row: FinanceInvoiceCrudRow,
): InvoiceFormState => ({
  customerName: row.customerName,
  deliveryNoteNumber: row.deliveryNoteNumber,
  deliveryNoteDate: row.deliveryNoteDate,
  receiptNumber: row.receiptNumber,
  invoiceNumber: row.invoiceNumber,
  invoiceDate: row.invoiceDate,
  dueDate: row.dueDate,
  purchaseOrderNumber: row.purchaseOrderNumber,
  purchaseOrderDate: row.purchaseOrderDate,
  description: row.description,
  subtotal: String(row.subtotal),
  taxRate: String(row.taxRate),
  taxInvoiceNumber: row.taxInvoiceNumber,
  accountDestination: row.accountDestination,
  notes: row.notes,
});

export default function InvoiceCrudManager({
  rows,
  customerNames,
  initialInvoiceId,
}: {
  rows: FinanceInvoiceCrudRow[];
  customerNames: string[];
  initialInvoiceId?: string;
}) {
  const initialInvoice = rows.find((row) => row.id === initialInvoiceId);
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(Boolean(initialInvoice));
  const [editingId, setEditingId] = useState<string | null>(
    initialInvoice?.id ?? null,
  );
  const [downloadTarget, setDownloadTarget] = useState<{
    id: string;
    displayNumber: string;
  } | null>(null);
  const [authorizedSigner, setAuthorizedSigner] =
    useState<FinanceInvoiceSigner>("SUYADI");
  const [form, setForm] = useState<InvoiceFormState>(() =>
    initialInvoice ? invoiceFormFromRow(initialInvoice) : emptyForm,
  );
  const [purchaseOrderOptions, setPurchaseOrderOptions] = useState<
    FinancePurchaseOrderSuggestion[]
  >([]);
  const [purchaseOrderSearchOpen, setPurchaseOrderSearchOpen] = useState(false);
  const [purchaseOrderSearching, setPurchaseOrderSearching] = useState(false);
  const [activePurchaseOrderIndex, setActivePurchaseOrderIndex] = useState(0);
  const [purchaseOrderQuery, setPurchaseOrderQuery] = useState(
    initialInvoice?.sources.length
      ? ""
      : initialInvoice?.purchaseOrderNumber ?? "",
  );
  const [selectedInvoiceSources, setSelectedInvoiceSources] = useState<
    FinanceInvoiceSourceRow[]
  >(initialInvoice?.sources ?? []);
  const [purchaseOrderPricingWarning, setPurchaseOrderPricingWarning] =
    useState("");
  const purchaseOrderRequestId = useRef(0);
  const totalPreview = useMemo(() => {
    const subtotal = Number(form.subtotal || 0);
    const rate = Number(form.taxRate || 0);
    return Number.isFinite(subtotal) && Number.isFinite(rate)
      ? subtotal * (1 + rate / 100)
      : 0;
  }, [form.subtotal, form.taxRate]);
  const revenueCategory = useMemo(
    () =>
      classifyFinanceRevenueLine({
        kind: "MANUAL",
        description: form.description,
      }),
    [form.description],
  );
  const editingInvoice = rows.find((row) => row.id === editingId);

  const set = (name: keyof InvoiceFormState, value: string) =>
    setForm((current) => ({ ...current, [name]: value }));

  const resetPurchaseOrderSearch = () => {
    purchaseOrderRequestId.current += 1;
    setPurchaseOrderOptions([]);
    setPurchaseOrderSearchOpen(false);
    setPurchaseOrderSearching(false);
    setActivePurchaseOrderIndex(0);
    setPurchaseOrderQuery("");
    setSelectedInvoiceSources([]);
    setPurchaseOrderPricingWarning("");
  };

  const applySourceAggregate = useCallback(
    (sources: FinanceInvoiceSourceRow[]) => {
      if (!sources.length) {
        setForm((current) => ({
          ...current,
          customerName: "",
          deliveryNoteNumber: "",
          deliveryNoteDate: "",
          dueDate: "",
          purchaseOrderNumber: "",
          purchaseOrderDate: "",
          description: "",
          subtotal: "",
        }));
        setPurchaseOrderPricingWarning("");
        return;
      }
      const unique = (values: string[]) => [...new Set(values.filter(Boolean))];
      const purchaseOrderNumbers = unique(
        sources.map((source) => source.purchaseOrderNumber),
      );
      const deliveryNoteNumbers = unique(
        sources.map((source) => source.deliveryNoteNumber),
      );
      const purchaseOrderDates = unique(
        sources.map((source) => source.purchaseOrderDate),
      );
      const deliveryNoteDates = unique(
        sources.map((source) => source.deliveryNoteDate),
      );
      const dueDates = unique(sources.map((source) => source.dueDate));
      const pricingComplete = sources.every(
        (source) => source.pricingComplete,
      );
      const subtotal = pricingComplete
        ? sources.reduce(
            (sum, source) => sum + Number(source.subtotal || 0),
            0,
          )
        : null;
      const description = sources
        .map(
          (source) =>
            `[PO ${source.purchaseOrderNumber} · SJ ${source.deliveryNoteNumber}]\n${source.description}`,
        )
        .join("\n\n");

      setForm((current) => ({
        ...current,
        customerName: sources[0].customerName,
        deliveryNoteNumber: deliveryNoteNumbers.join(", "),
        deliveryNoteDate:
          deliveryNoteDates.length === 1 ? deliveryNoteDates[0] : "",
        dueDate: dueDates.length === 1 ? dueDates[0] : current.dueDate,
        purchaseOrderNumber: purchaseOrderNumbers.join(", "),
        purchaseOrderDate:
          purchaseOrderDates.length === 1 ? purchaseOrderDates[0] : "",
        description,
        subtotal:
          subtotal != null && Number.isFinite(subtotal) ? String(subtotal) : "",
      }));
      setPurchaseOrderPricingWarning(
        pricingComplete
          ? ""
          : "Harga yang disetujui belum lengkap pada salah satu Surat Jalan. Isi nilai sebelum PPN secara manual.",
      );
    },
    [],
  );

  const applyPurchaseOrder = useCallback(
    (option: FinancePurchaseOrderSuggestion) => {
      if (
        option.totalDeliveryNoteCount > 0 &&
        option.deliveryNotes.length === 0
      ) {
        toast.error(
          "Semua Surat Jalan pada PO ini sudah ditagihkan ke invoice lain",
        );
        return;
      }
      if (option.deliveryNotes.length) {
        if (
          selectedInvoiceSources.length &&
          selectedInvoiceSources[0].customerName !== option.customerName
        ) {
          toast.error(
            "Satu invoice hanya dapat memuat PO dan Surat Jalan dari pelanggan yang sama",
          );
          return;
        }
        const additions: FinanceInvoiceSourceRow[] =
          option.deliveryNotes.map((deliveryNote) => ({
            id: deliveryNote.id,
            purchaseOrderId: option.id,
            purchaseOrderNumber: option.poNumber,
            purchaseOrderMode: option.poMode,
            customerName: option.customerName,
            projectName: option.projectName,
            purchaseOrderDate: option.purchaseOrderDate,
            dueDate: option.dueDate,
            deliveryNoteNumber: deliveryNote.number,
            deliveryNoteDate: deliveryNote.date,
            description: deliveryNote.description,
            subtotal: deliveryNote.subtotal,
            pricingComplete: deliveryNote.pricingComplete,
          }));
        const byId = new Map(
          [...selectedInvoiceSources, ...additions].map((source) => [
            source.id,
            source,
          ]),
        );
        const merged = [...byId.values()];
        setSelectedInvoiceSources(merged);
        applySourceAggregate(merged);
        setPurchaseOrderQuery("");
        setPurchaseOrderSearchOpen(false);
        setActivePurchaseOrderIndex(0);
        return;
      }
      setForm((current) => ({
        ...current,
        purchaseOrderNumber: option.poNumber,
        customerName: option.customerName,
        deliveryNoteNumber: option.deliveryNoteNumber,
        deliveryNoteDate: option.deliveryNoteDate,
        dueDate: option.dueDate,
        purchaseOrderDate: option.purchaseOrderDate,
        description: option.description,
        subtotal: option.subtotal,
      }));
      setPurchaseOrderPricingWarning(
        option.pricingComplete
          ? ""
          : "Harga yang disetujui belum lengkap pada PO ini. Isi nilai sebelum PPN secara manual.",
      );
      setPurchaseOrderQuery(option.poNumber);
      setPurchaseOrderSearchOpen(false);
      setActivePurchaseOrderIndex(0);
    },
    [applySourceAggregate, selectedInvoiceSources],
  );

  useEffect(() => {
    if (!open) return;
    const query = purchaseOrderQuery.trim();
    if (!shouldSearchFinancePurchaseOrders(query)) return;

    const requestId = ++purchaseOrderRequestId.current;
    const timer = window.setTimeout(async () => {
      setPurchaseOrderSearching(true);
      const result = await searchFinancePurchaseOrders({
        query,
        invoiceId: editingId ?? undefined,
      });
      if (requestId !== purchaseOrderRequestId.current) return;
      setPurchaseOrderSearching(false);
      if ("error" in result) {
        setPurchaseOrderOptions([]);
        setPurchaseOrderSearchOpen(false);
        toast.error(result.error);
        return;
      }
      setPurchaseOrderOptions(result.data);
      setActivePurchaseOrderIndex(0);
      const normalizedQuery = query.toLocaleLowerCase("id-ID");
      const exact = result.data.find(
        (option) =>
          option.poNumber.toLocaleLowerCase("id-ID") === normalizedQuery,
      );
      if (exact) {
        if (
          exact.deliveryNotes.length > 0 ||
          exact.totalDeliveryNoteCount === 0
        ) {
          applyPurchaseOrder(exact);
          return;
        }
      }
      setPurchaseOrderSearchOpen(true);
    }, 250);

    return () => window.clearTimeout(timer);
  }, [
    applyPurchaseOrder,
    editingId,
    open,
    purchaseOrderQuery,
  ]);

  const changePurchaseOrderNumber = (value: string) => {
    setPurchaseOrderPricingWarning("");
    setPurchaseOrderQuery(value);
    if (!shouldSearchFinancePurchaseOrders(value)) {
      purchaseOrderRequestId.current += 1;
      setPurchaseOrderOptions([]);
      setPurchaseOrderSearchOpen(false);
      setPurchaseOrderSearching(false);
    }
    if (!selectedInvoiceSources.length) {
      set("purchaseOrderNumber", value);
    }
  };

  const removeInvoiceSource = (sourceId: string) => {
    const remaining = selectedInvoiceSources.filter(
      (source) => source.id !== sourceId,
    );
    setSelectedInvoiceSources(remaining);
    applySourceAggregate(remaining);
  };

  const handlePurchaseOrderKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (!purchaseOrderSearchOpen || purchaseOrderOptions.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActivePurchaseOrderIndex(
        (current) => (current + 1) % purchaseOrderOptions.length,
      );
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActivePurchaseOrderIndex(
        (current) =>
          (current - 1 + purchaseOrderOptions.length) %
          purchaseOrderOptions.length,
      );
    } else if (event.key === "Enter") {
      event.preventDefault();
      applyPurchaseOrder(purchaseOrderOptions[activePurchaseOrderIndex]);
    } else if (event.key === "Escape") {
      setPurchaseOrderSearchOpen(false);
    }
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    resetPurchaseOrderSearch();
    setOpen(true);
  };

  const openDownload = (row: Pick<FinanceInvoiceCrudRow, "id" | "displayNumber">) => {
    setAuthorizedSigner("SUYADI");
    setDownloadTarget(row);
  };

  const downloadInvoice = () => {
    if (!downloadTarget) return;
    const link = document.createElement("a");
    const params = new URLSearchParams({ signer: authorizedSigner });
    link.href = `/api/mektek/finance/invoices/${encodeURIComponent(downloadTarget.id)}/pdf?${params.toString()}`;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.click();
    setDownloadTarget(null);
  };

  const openEdit = (row: FinanceInvoiceCrudRow) => {
    setEditingId(row.id);
    resetPurchaseOrderSearch();
    setForm(invoiceFormFromRow(row));
    setSelectedInvoiceSources(row.sources);
    setPurchaseOrderQuery(row.sources.length ? "" : row.purchaseOrderNumber);
    setOpen(true);
  };

  const submit = () => {
    startTransition(async () => {
      const input: FinanceInvoiceEntryInput = {
        ...form,
        subtotal: form.subtotal,
        taxRate: form.taxRate,
        sourceIds: selectedInvoiceSources.map((source) => source.id),
      };
      const result = editingId
        ? await updateFinanceInvoiceEntry(editingId, input)
        : await createFinanceInvoiceEntry(input);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      if (
        !editingId &&
        "data" in result &&
        result.data &&
        "id" in result.data
      ) {
        openDownload({
          id: result.data.id,
          displayNumber: form.invoiceNumber || "Invoice baru",
        });
      }
      toast.success(editingId ? "Invoice berhasil diperbarui" : "Invoice berhasil ditambahkan");
      setOpen(false);
      router.refresh();
    });
  };

  const remove = (row: FinanceInvoiceCrudRow) => {
    if (!window.confirm(`Hapus invoice ${row.displayNumber}? Tindakan ini tidak dapat dibatalkan.`)) {
      return;
    }
    startTransition(async () => {
      const result = await deleteFinanceInvoiceEntry(row.id);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Invoice berhasil dihapus");
      router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-medium">Input rekap invoice</p>
          <p className="text-sm text-muted-foreground">
            Masukkan nomor SJ, kwitansi, invoice, PO, nilai, PPN, dan faktur pajak di sini.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Tambah invoice
        </Button>
      </div>

      {rows.length ? (
        <div className="overflow-hidden rounded-xl border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="p-3">Invoice</th>
                  <th className="p-3">Pelanggan</th>
                  <th className="p-3">SJ / PO</th>
                  <th className="p-3">Tanggal</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Total</th>
                  <th className="p-3 text-right">Sisa</th>
                  <th className="p-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t align-top">
                    <td className="p-3">
                      <p className="font-medium">{row.displayNumber}</p>
                      <p className="text-xs text-muted-foreground">
                        {row.taxInvoiceNumber ? `Faktur ${row.taxInvoiceNumber}` : "Tanpa nomor faktur pajak"}
                      </p>
                    </td>
                    <td className="p-3">{row.customerName}</td>
                    <td className="p-3">
                      <p>SJ: {row.deliveryNoteNumber || "—"}</p>
                      <p className="text-xs text-muted-foreground">PO: {row.purchaseOrderNumber || "—"}</p>
                    </td>
                    <td className="p-3">
                      <p>{row.invoiceDate || "—"}</p>
                      <p className="text-xs text-muted-foreground">Jatuh tempo {row.dueDate || "—"}</p>
                    </td>
                    <td className="p-3"><Badge variant="outline">{statusLabel[row.status] ?? row.status}</Badge></td>
                    <td className="p-3 text-right font-medium">{idr.format(row.total)}</td>
                    <td className="p-3 text-right font-medium">{idr.format(row.balance)}</td>
                    <td className="p-3">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="icon"
                          variant="outline"
                          onClick={() => openDownload(row)}
                          aria-label={`Unduh PDF ${row.displayNumber}`}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="outline"
                          onClick={() => openEdit(row)}
                          disabled={isPending || row.status === "PAID" || row.status === "VOID"}
                          aria-label={`Edit ${row.displayNumber}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="destructive"
                          onClick={() => remove(row)}
                          disabled={isPending || row.hasPayment}
                          aria-label={`Hapus ${row.displayNumber}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed p-10 text-center">
          <p className="font-medium">Belum ada invoice</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Klik Tambah invoice untuk mulai memasukkan data accounting.
          </p>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit invoice" : "Tambah invoice"}</DialogTitle>
            <DialogDescription>
              Formulir mengikuti alur rekap invoice: SJ, kwitansi, invoice, PO, nilai, PPN, dan faktur pajak.
            </DialogDescription>
          </DialogHeader>

          <datalist id="finance-customers">
            {customerNames.map((name) => <option key={name} value={name} />)}
          </datalist>

          <div className="grid gap-4 py-2 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="customerName">Pelanggan *</Label>
              <Input
                id="customerName"
                list="finance-customers"
                value={fieldValue(form, "customerName")}
                onChange={(event) => set("customerName", event.target.value)}
                placeholder="Nama perusahaan"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="deliveryNoteNumber">Nomor surat jalan / BA</Label>
              <Input id="deliveryNoteNumber" value={fieldValue(form, "deliveryNoteNumber")} onChange={(event) => set("deliveryNoteNumber", event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="deliveryNoteDate">Tanggal surat jalan</Label>
              <Input id="deliveryNoteDate" type="date" value={fieldValue(form, "deliveryNoteDate")} onChange={(event) => set("deliveryNoteDate", event.target.value)} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="receiptNumber">Nomor kwitansi</Label>
              <Input id="receiptNumber" value={fieldValue(form, "receiptNumber")} onChange={(event) => set("receiptNumber", event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invoiceNumber">Nomor invoice *</Label>
              <Input id="invoiceNumber" value={fieldValue(form, "invoiceNumber")} onChange={(event) => set("invoiceNumber", event.target.value)} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="invoiceDate">Tanggal invoice *</Label>
              <Input id="invoiceDate" type="date" value={fieldValue(form, "invoiceDate")} onChange={(event) => set("invoiceDate", event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dueDate">Jatuh tempo</Label>
              <Input id="dueDate" type="date" value={fieldValue(form, "dueDate")} onChange={(event) => set("dueDate", event.target.value)} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="purchaseOrderNumber">Nomor PO</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="purchaseOrderNumber"
                  className="pl-9 pr-9"
                  role="combobox"
                  aria-autocomplete="list"
                  aria-expanded={purchaseOrderSearchOpen}
                  aria-controls="finance-purchase-order-options"
                  aria-activedescendant={
                    purchaseOrderSearchOpen && purchaseOrderOptions.length
                      ? `finance-purchase-order-option-${purchaseOrderOptions[activePurchaseOrderIndex]?.id}`
                      : undefined
                  }
                  autoComplete="off"
                  value={purchaseOrderQuery}
                  onChange={(event) =>
                    changePurchaseOrderNumber(event.target.value)
                  }
                  onFocus={() => {
                    if (
                      shouldSearchFinancePurchaseOrders(purchaseOrderQuery) &&
                      purchaseOrderOptions.length
                    ) {
                      setPurchaseOrderSearchOpen(true);
                    }
                  }}
                  onBlur={() =>
                    window.setTimeout(
                      () => setPurchaseOrderSearchOpen(false),
                      100,
                    )
                  }
                  onKeyDown={handlePurchaseOrderKeyDown}
                  placeholder="Ketik nomor PO Logistics"
                />
                {purchaseOrderSearching && (
                  <Loader2 className="pointer-events-none absolute right-3 top-3 h-4 w-4 animate-spin text-muted-foreground" />
                )}
                {purchaseOrderSearchOpen && (
                  <div
                    id="finance-purchase-order-options"
                    role="listbox"
                    className="absolute z-50 mt-1 max-h-72 w-full overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
                  >
                    {purchaseOrderOptions.length ? (
                      purchaseOrderOptions.map((option, index) => (
                        <button
                          key={option.id}
                          id={`finance-purchase-order-option-${option.id}`}
                          type="button"
                          role="option"
                          aria-selected={index === activePurchaseOrderIndex}
                          disabled={
                            option.totalDeliveryNoteCount > 0 &&
                            option.deliveryNotes.length === 0
                          }
                          className={`flex w-full items-start justify-between gap-3 rounded-sm px-3 py-2 text-left text-sm ${
                            index === activePurchaseOrderIndex
                              ? "bg-accent text-accent-foreground"
                              : "hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50"
                          }`}
                          onMouseDown={(event) => event.preventDefault()}
                          onMouseEnter={() =>
                            setActivePurchaseOrderIndex(index)
                          }
                          onClick={() => applyPurchaseOrder(option)}
                        >
                          <span>
                            <span className="block font-mono font-medium">
                              {option.poNumber}
                            </span>
                            <span className="block text-xs text-muted-foreground">
                              {option.customerName}
                              {option.projectName
                                ? ` · ${option.projectName}`
                                : ""}
                              {option.deliveryNotes.length
                                ? ` · ${option.deliveryNotes.length} Surat Jalan`
                                : option.totalDeliveryNoteCount
                                  ? " · Sudah ditagihkan"
                                  : " · Belum ada Surat Jalan"}
                            </span>
                          </span>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {option.purchaseOrderDate}
                          </span>
                        </button>
                      ))
                    ) : (
                      <p className="px-3 py-2 text-sm text-muted-foreground">
                        Nomor PO Logistics tidak ditemukan
                      </p>
                    )}
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Ketik minimal 3 karakter lalu pilih rekomendasi. Semua Surat Jalan
                yang belum ditagih dari PO tersebut akan ditambahkan dan dapat
                dihapus satu per satu.
              </p>
              {selectedInvoiceSources.length > 0 && (
                <div className="space-y-2 rounded-md border bg-muted/20 p-3">
                  <p className="text-xs font-medium">
                    Surat Jalan terpilih ({selectedInvoiceSources.length})
                  </p>
                  <div className="space-y-2">
                    {selectedInvoiceSources.map((source) => (
                      <div
                        key={source.id}
                        className="flex items-start justify-between gap-3 rounded-md bg-background px-3 py-2 text-xs"
                      >
                        <span>
                          <span className="block font-medium">
                            {source.deliveryNoteNumber}
                          </span>
                          <span className="block text-muted-foreground">
                            PO {source.purchaseOrderNumber}
                            {source.purchaseOrderMode === "CONSIGNMENT"
                              ? " · Konsinyasi"
                              : ""}
                            {source.deliveryNoteDate
                              ? ` · ${source.deliveryNoteDate}`
                              : ""}
                          </span>
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2"
                          onClick={() => removeInvoiceSource(source.id)}
                        >
                          Hapus
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="purchaseOrderDate">Tanggal PO</Label>
              <Input id="purchaseOrderDate" type="date" value={fieldValue(form, "purchaseOrderDate")} onChange={(event) => set("purchaseOrderDate", event.target.value)} />
            </div>

            <div className="space-y-2 md:col-span-2">
              {editingInvoice?.classificationIssue ? (
                <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
                  <p className="font-medium">
                    Baris invoice yang perlu diperiksa
                  </p>
                  <p className="mt-1">
                    {editingInvoice.classificationDescriptions.join("; ") ||
                      "Tidak ada deskripsi"}
                  </p>
                </div>
              ) : null}
              <Label htmlFor="description">Jenis pengeluaran / deskripsi *</Label>
              <Textarea id="description" value={fieldValue(form, "description")} onChange={(event) => set("description", event.target.value)} placeholder="Jasa, spare part, rental, service, atau pekerjaan lain" />
              <p
                className={
                  revenueCategory === "unclassified"
                    ? "text-xs text-amber-700"
                    : "text-xs text-muted-foreground"
                }
              >
                {revenueCategory === "service"
                  ? "Terdeteksi otomatis: Pendapatan jasa"
                  : revenueCategory === "sparepart"
                    ? "Terdeteksi otomatis: Pendapatan spare part"
                    : "Belum dapat dipisahkan otomatis. Gunakan deskripsi jasa atau spare part yang jelas; invoice campuran harus memiliki baris terpisah."}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="subtotal">Nilai sebelum PPN (IDR) *</Label>
              <Input id="subtotal" type="number" min="0" step="0.01" value={form.subtotal} onChange={(event) => set("subtotal", event.target.value)} />
              {purchaseOrderPricingWarning && (
                <p className="text-xs text-amber-700">
                  {purchaseOrderPricingWarning}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="taxRate">PPN (%)</Label>
              <Input id="taxRate" type="number" min="0" max="100" step="0.01" value={form.taxRate} onChange={(event) => set("taxRate", event.target.value)} />
              <p className="text-xs text-muted-foreground">Total akhir: {idr.format(totalPreview)}</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="taxInvoiceNumber">Nomor faktur pajak</Label>
              <Input id="taxInvoiceNumber" value={fieldValue(form, "taxInvoiceNumber")} onChange={(event) => set("taxInvoiceNumber", event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="accountDestination">Bank / rekening tujuan</Label>
              <select
                id="accountDestination"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                value={fieldValue(form, "accountDestination")}
                onChange={(event) =>
                  set("accountDestination", event.target.value)
                }
              >
                <option value="">Pilih rekening tujuan</option>
                {FINANCE_DESTINATION_BANK_OPTIONS.map((bank) => (
                  <option key={bank} value={bank}>
                    {bank}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="notes">Catatan</Label>
              <Textarea id="notes" value={fieldValue(form, "notes")} onChange={(event) => set("notes", event.target.value)} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>Batal</Button>
            <Button onClick={submit} disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Simpan invoice
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(downloadTarget)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setDownloadTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Pilih penandatangan invoice</DialogTitle>
            <DialogDescription>
              Pilih nama yang akan tampil sebagai pihak berwenang pada{" "}
              {downloadTarget?.displayNumber ?? "invoice"} sebelum PDF dibuka.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="authorizedSigner">Penandatangan</Label>
            <select
              id="authorizedSigner"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              value={authorizedSigner}
              onChange={(event) =>
                setAuthorizedSigner(event.target.value as FinanceInvoiceSigner)
              }
            >
              {FINANCE_INVOICE_SIGNERS.map((signer) => (
                <option key={signer} value={signer}>
                  {signer}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              Nama terpilih akan dicetak pada bagian Authorized Person.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDownloadTarget(null)}>
              Batal
            </Button>
            <Button onClick={downloadInvoice}>
              <Download className="mr-2 h-4 w-4" />
              Unduh PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
