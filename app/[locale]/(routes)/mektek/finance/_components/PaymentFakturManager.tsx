"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Filter,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import {
  createPaymentFakturEntry,
  deletePaymentFakturEntry,
  updatePaymentFakturEntry,
  type PaymentFakturEntryInput,
} from "@/actions/mektek/payment-faktur";
import { searchFinancePurchaseOrders } from "@/actions/mektek/finance";
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
import {
  shouldSearchFinancePurchaseOrders,
  type FinancePurchaseOrderSuggestion,
} from "@/lib/mektek/finance-po";
import { FINANCE_DESTINATION_BANK_OPTIONS } from "@/lib/mektek/finance-bank-accounts";
import { buildPaymentFakturPurchaseOrderAutofill } from "@/lib/mektek/payment-faktur-po";
import {
  paymentFakturDisplayNumber,
  type PaymentFakturSortDirection,
  type PaymentFakturSortKey,
  type PaymentFakturStatusFilter,
} from "@/lib/mektek/payment-faktur-table";

import PaymentFakturTrendChart from "./PaymentFakturTrendChart";

export type PaymentFakturCustomerOption = {
  id: string;
  sheetKey: string;
  customerName: string;
  taxLabelPercent: number;
  entryCount: number;
};

export type PaymentFakturRow = {
  id: string;
  sourceRow: number | null;
  receiptNumber: string | null;
  invoiceNumber: string;
  invoiceDate: string | null;
  purchaseOrderNumber: string | null;
  destinationBank: string | null;
  deliveryDate: string | null;
  description: string;
  subtotal: number;
  taxAmount: number;
  grandTotal: number;
  transferDate: string | null;
  taxInvoiceNumber: string | null;
  installment1: number;
  installment2: number;
  installment3: number;
  paidAmount: number;
  remainingAmount: number;
  status: "BELUM_BAYAR" | "CICILAN" | "LUNAS";
};

type FormState = {
  receiptNumber: string;
  invoiceNumber: string;
  invoiceDate: string;
  purchaseOrderNumber: string;
  destinationBank: string;
  deliveryDate: string;
  description: string;
  subtotal: string;
  taxAmount: string;
  transferDate: string;
  taxInvoiceNumber: string;
  installment1: string;
  installment2: string;
  installment3: string;
};

const emptyForm: FormState = {
  receiptNumber: "",
  invoiceNumber: "",
  invoiceDate: "",
  purchaseOrderNumber: "",
  destinationBank: "",
  deliveryDate: "",
  description: "",
  subtotal: "",
  taxAmount: "",
  transferDate: "",
  taxInvoiceNumber: "",
  installment1: "",
  installment2: "",
  installment3: "",
};

const rupiah = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 2,
});
const dateLabel = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      }).format(new Date(`${value}T00:00:00.000Z`))
    : "—";

export default function PaymentFakturManager({
  customers,
  sheetSearch,
  hasMoreCustomerMatches,
  selectedCustomerId,
  selectedSheetKey,
  rows,
  summary,
  search,
  page,
  pageCount,
  totalRows,
  statusFilter,
  sort,
  direction,
}: {
  customers: PaymentFakturCustomerOption[];
  sheetSearch: string;
  hasMoreCustomerMatches: boolean;
  selectedCustomerId: string | null;
  selectedSheetKey: string | null;
  rows: PaymentFakturRow[];
  summary: {
    total: number;
    paid: number;
    remaining: number;
    LUNAS: number;
    CICILAN: number;
    BELUM_BAYAR: number;
    monthlyTotals: number[];
  };
  search: string;
  page: number;
  pageCount: number;
  totalRows: number;
  statusFilter: PaymentFakturStatusFilter;
  sort: PaymentFakturSortKey;
  direction: PaymentFakturSortDirection;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PaymentFakturRow | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [searchValue, setSearchValue] = useState(search);
  const [sheetSearchValue, setSheetSearchValue] = useState(sheetSearch);
  const [purchaseOrderOptions, setPurchaseOrderOptions] = useState<
    FinancePurchaseOrderSuggestion[]
  >([]);
  const [purchaseOrderSearchOpen, setPurchaseOrderSearchOpen] = useState(false);
  const [purchaseOrderSearching, setPurchaseOrderSearching] = useState(false);
  const [activePurchaseOrderIndex, setActivePurchaseOrderIndex] = useState(0);
  const purchaseOrderRequestId = useRef(0);
  const skipPurchaseOrderSearch = useRef("");
  const selectedCustomer = customers.find((row) => row.id === selectedCustomerId);
  const calculatedTotal =
    (Number(form.subtotal) || 0) + (Number(form.taxAmount) || 0);
  const calculatedPaid = form.transferDate
    ? calculatedTotal
    : Math.min(
        calculatedTotal,
        (Number(form.installment1) || 0) +
          (Number(form.installment2) || 0) +
          (Number(form.installment3) || 0),
      );
  const calculatedRemaining = Math.max(0, calculatedTotal - calculatedPaid);

  const setQuery = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    startTransition(() => router.push(`${pathname}?${params.toString()}`));
  };
  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setPurchaseOrderOptions([]);
    setPurchaseOrderSearchOpen(false);
    setDialogOpen(true);
  };
  const openEdit = (row: PaymentFakturRow) => {
    setEditing(row);
    setPurchaseOrderOptions([]);
    setPurchaseOrderSearchOpen(false);
    setForm({
      receiptNumber: row.receiptNumber ?? "",
      invoiceNumber: row.invoiceNumber,
      invoiceDate: row.invoiceDate ?? "",
      purchaseOrderNumber: row.purchaseOrderNumber ?? "",
      destinationBank: row.destinationBank ?? "",
      deliveryDate: row.deliveryDate ?? "",
      description: row.description,
      subtotal: String(row.subtotal),
      taxAmount: String(row.taxAmount),
      transferDate: row.transferDate ?? "",
      taxInvoiceNumber: row.taxInvoiceNumber ?? "",
      installment1: row.installment1 ? String(row.installment1) : "",
      installment2: row.installment2 ? String(row.installment2) : "",
      installment3: row.installment3 ? String(row.installment3) : "",
    });
    setDialogOpen(true);
  };
  const applyPurchaseOrder = useCallback(
    (option: FinancePurchaseOrderSuggestion) => {
      const autofill = buildPaymentFakturPurchaseOrderAutofill(
        option,
        selectedCustomer?.taxLabelPercent ?? 0,
      );
      skipPurchaseOrderSearch.current = option.poNumber;
      setForm((current) => ({
        ...current,
        purchaseOrderNumber: autofill.purchaseOrderNumber,
        deliveryDate: autofill.deliveryDate || current.deliveryDate,
        description: autofill.description || current.description,
        subtotal: autofill.subtotal ?? current.subtotal,
        taxAmount: autofill.taxAmount ?? current.taxAmount,
      }));
      setPurchaseOrderSearchOpen(false);
      setActivePurchaseOrderIndex(0);
      if (!option.pricingComplete) {
        toast.warning(
          "Harga PO belum lengkap. Total dan PPN perlu diisi manual.",
        );
      }
    },
    [selectedCustomer?.taxLabelPercent],
  );

  useEffect(() => {
    if (!dialogOpen) return;
    const query = form.purchaseOrderNumber.trim();
    if (skipPurchaseOrderSearch.current === query) {
      skipPurchaseOrderSearch.current = "";
      return;
    }
    if (!shouldSearchFinancePurchaseOrders(query)) return;

    const requestId = ++purchaseOrderRequestId.current;
    const timer = window.setTimeout(async () => {
      setPurchaseOrderSearching(true);
      const result = await searchFinancePurchaseOrders({ query });
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
      setPurchaseOrderSearchOpen(true);
    }, 250);

    return () => window.clearTimeout(timer);
  }, [dialogOpen, form.purchaseOrderNumber]);

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
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!selectedCustomerId) return;
    const input: PaymentFakturEntryInput = {
      customerId: selectedCustomerId,
      ...form,
    };
    startTransition(async () => {
      const result = editing
        ? await updatePaymentFakturEntry(editing.id, input)
        : await createPaymentFakturEntry(input);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(editing ? "Payment Faktur diperbarui" : "Payment Faktur ditambahkan");
      setDialogOpen(false);
      router.refresh();
    });
  };
  const remove = (row: PaymentFakturRow) => {
    if (!window.confirm(`Hapus invoice ${row.invoiceNumber}?`)) return;
    startTransition(async () => {
      const result = await deletePaymentFakturEntry(row.id);
      if ("error" in result) toast.error(result.error);
      else {
        toast.success("Payment Faktur dihapus");
        router.refresh();
      }
    });
  };
  const statusBadge = useMemo(
    () => ({
      LUNAS: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100",
      CICILAN: "bg-amber-100 text-amber-800 hover:bg-amber-100",
      BELUM_BAYAR: "bg-rose-100 text-rose-800 hover:bg-rose-100",
    }),
    [],
  );

  if (!customers.length) {
    return (
      <div className="mx-4 space-y-4 rounded-lg border border-dashed p-8 text-center sm:mx-6">
        <h2 className="text-lg font-semibold">
          {sheetSearch ? "Sheet customer tidak ditemukan" : "Data Payment Faktur belum diimpor"}
        </h2>
        {sheetSearch ? (
          <Button onClick={() => setQuery({ sheetQ: null, customer: null })}>
            Tampilkan semua sheet
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground">
            Jalankan impor workbook PAYMENT FAKTUR 2026 setelah migrasi database.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5 px-4 pb-8 sm:px-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Rekapitulasi invoice 2026</p>
          <h2 className="text-xl font-semibold">{selectedCustomer?.customerName}</h2>
          <p className="text-xs text-muted-foreground">
            Sheet {selectedSheetKey} · Label workbook PPN {selectedCustomer?.taxLabelPercent}%
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <select
            className="h-10 min-w-64 rounded-md border bg-background px-3 text-sm"
            value={selectedSheetKey ?? ""}
            onChange={(event) => setQuery({ customer: event.target.value, page: null })}
            disabled={pending}
          >
            {customers.map((customer) => (
              <option key={customer.id} value={customer.sheetKey}>
                {customer.sheetKey} — {customer.customerName} ({customer.entryCount})
              </option>
            ))}
          </select>
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Tambah invoice {selectedSheetKey}
          </Button>
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        <div className="flex flex-col gap-2 border-b p-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {hasMoreCustomerMatches ? "50+ sheet cocok" : `${customers.length} sheet customer`}
          </p>
          <form
            className="flex w-full gap-2 sm:w-auto"
            onSubmit={(event) => {
              event.preventDefault();
              setQuery({
                sheetQ: sheetSearchValue.trim() || null,
                customer: null,
                page: null,
              });
            }}
          >
            <Input
              className="h-8 w-full sm:w-64"
              value={sheetSearchValue}
              onChange={(event) => setSheetSearchValue(event.target.value)}
              placeholder="Cari kode atau nama customer"
            />
            <Button type="submit" size="sm" variant="outline" disabled={pending}>
              Cari sheet
            </Button>
          </form>
        </div>
        {hasMoreCustomerMatches && (
          <p className="border-b bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Hanya 50 hasil pertama dimuat. Persempit pencarian untuk menemukan sheet lainnya.
          </p>
        )}
        <div className="overflow-x-auto">
          <div className="flex min-w-max gap-1 p-2">
            {customers.map((customer) => {
              const active = customer.sheetKey === selectedSheetKey;
              return (
                <button
                  key={customer.id}
                  type="button"
                  title={customer.customerName}
                  aria-current={active ? "page" : undefined}
                  className={
                    active
                      ? "rounded-md bg-primary px-3 py-2 text-left text-primary-foreground shadow-sm"
                      : "rounded-md border bg-background px-3 py-2 text-left hover:bg-muted"
                  }
                  onClick={() =>
                    setQuery({ customer: customer.sheetKey, page: null })
                  }
                  disabled={pending}
                >
                  <span className="block text-sm font-semibold">
                    {customer.sheetKey}
                  </span>
                  <span
                    className={
                      active
                        ? "block text-[11px] text-primary-foreground/80"
                        : "block text-[11px] text-muted-foreground"
                    }
                  >
                    {customer.entryCount} invoice
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Total invoice", rupiah.format(summary.total)],
          ["Hutang dibayar", rupiah.format(summary.paid)],
          ["Belum dibayar", rupiah.format(summary.remaining)],
          ["Status", `${summary.LUNAS} lunas · ${summary.CICILAN} cicilan · ${summary.BELUM_BAYAR} pending`],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border bg-card p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className="mt-1 text-lg font-semibold">{value}</p>
          </div>
        ))}
      </div>

      <PaymentFakturTrendChart values={summary.monthlyTotals} />

      <div className="rounded-xl border bg-card p-3 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <Filter className="h-4 w-4 text-primary" />
          <div>
            <p className="text-sm font-semibold">Filter dan urutkan tabel</p>
            <p className="text-xs text-muted-foreground">
              Kontrol hanya berlaku pada invoice di sheet {selectedSheetKey}.
            </p>
          </div>
        </div>
        <div className="grid gap-2 lg:grid-cols-[minmax(280px,1fr)_190px_210px_auto_auto]">
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              setQuery({ q: searchValue.trim() || null, page: null });
            }}
          >
            <div className="relative min-w-0 flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                placeholder="Cari invoice, kwitansi, PO, faktur pajak, atau deskripsi"
              />
            </div>
            <Button type="submit" variant="outline" disabled={pending}>
              Cari
            </Button>
          </form>
          <select
            className="h-10 rounded-md border bg-background px-3 text-sm"
            value={statusFilter}
            onChange={(event) =>
              setQuery({ status: event.target.value, page: null })
            }
            aria-label="Filter status pembayaran"
            disabled={pending}
          >
            <option value="SEMUA">Semua status</option>
            <option value="BELUM_BAYAR">Belum dibayar</option>
            <option value="CICILAN">Cicilan</option>
            <option value="LUNAS">Lunas</option>
          </select>
          <select
            className="h-10 rounded-md border bg-background px-3 text-sm"
            value={sort}
            onChange={(event) =>
              setQuery({ sort: event.target.value, page: null })
            }
            aria-label="Urutkan tabel berdasarkan"
            disabled={pending}
          >
            <option value="number">Nomor urut</option>
            <option value="invoiceDate">Tanggal invoice</option>
            <option value="invoiceNumber">Nomor invoice</option>
            <option value="grandTotal">Grand total</option>
            <option value="paidAmount">Jumlah dibayar</option>
            <option value="remainingAmount">Sisa pembayaran</option>
            <option value="status">Status</option>
          </select>
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              setQuery({
                direction: direction === "asc" ? "desc" : "asc",
                page: null,
              })
            }
            disabled={pending}
            aria-label={
              direction === "asc"
                ? "Ubah menjadi urutan menurun"
                : "Ubah menjadi urutan menaik"
            }
          >
            {direction === "asc" ? (
              <ArrowUp className="mr-2 h-4 w-4" />
            ) : (
              <ArrowDown className="mr-2 h-4 w-4" />
            )}
            {direction === "asc" ? "Menaik" : "Menurun"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setSearchValue("");
              setQuery({
                q: null,
                status: null,
                sort: null,
                direction: null,
                page: null,
              });
            }}
            disabled={pending}
          >
            Reset
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1800px] text-sm">
            <thead className="bg-muted/60 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-3">No.</th>
                <th className="px-3 py-3">Kwitansi</th>
                <th className="px-3 py-3">Invoice</th>
                <th className="px-3 py-3">Tanggal invoice</th>
                <th className="px-3 py-3">No. PO</th>
                <th className="px-3 py-3">Bank tujuan</th>
                <th className="px-3 py-3">Tanggal pengiriman</th>
                <th className="px-3 py-3">Deskripsi</th>
                <th className="px-3 py-3 text-right">Total</th>
                <th className="px-3 py-3 text-right">PPN</th>
                <th className="px-3 py-3 text-right">Grand total</th>
                <th className="px-3 py-3">Transfer</th>
                <th className="px-3 py-3">Faktur pajak</th>
                <th className="px-3 py-3 text-right">Dibayar</th>
                <th className="px-3 py-3 text-right">Cicilan 1</th>
                <th className="px-3 py-3 text-right">Cicilan 2</th>
                <th className="px-3 py-3 text-right">Cicilan 3</th>
                <th className="px-3 py-3 text-right">Sisa</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((row, index) => (
                <tr key={row.id} className="align-top hover:bg-muted/30">
                  <td className="px-3 py-3 text-muted-foreground">
                    {paymentFakturDisplayNumber(
                      row.sourceRow,
                      index,
                      (page - 1) * 50,
                    )}
                  </td>
                  <td className="px-3 py-3">{row.receiptNumber || "—"}</td>
                  <td className="px-3 py-3 font-medium">{row.invoiceNumber}</td>
                  <td className="px-3 py-3">{dateLabel(row.invoiceDate)}</td>
                  <td className="max-w-52 px-3 py-3">{row.purchaseOrderNumber || "—"}</td>
                  <td className="max-w-56 px-3 py-3">{row.destinationBank || "—"}</td>
                  <td className="px-3 py-3">{dateLabel(row.deliveryDate)}</td>
                  <td className="max-w-72 px-3 py-3">{row.description}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-right">{rupiah.format(row.subtotal)}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-right">{rupiah.format(row.taxAmount)}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-right font-medium">{rupiah.format(row.grandTotal)}</td>
                  <td className="px-3 py-3">{dateLabel(row.transferDate)}</td>
                  <td className="max-w-48 break-all px-3 py-3">{row.taxInvoiceNumber || "—"}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-right">{rupiah.format(row.paidAmount)}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-right">{row.installment1 ? rupiah.format(row.installment1) : "—"}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-right">{row.installment2 ? rupiah.format(row.installment2) : "—"}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-right">{row.installment3 ? rupiah.format(row.installment3) : "—"}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-right">{rupiah.format(row.remainingAmount)}</td>
                  <td className="px-3 py-3"><Badge className={statusBadge[row.status]}>{row.status.replace("_", " ")}</Badge></td>
                  <td className="px-3 py-3">
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(row)} aria-label={`Edit ${row.invoiceNumber}`}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => remove(row)} aria-label={`Hapus ${row.invoiceNumber}`}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {!rows.length && (
                <tr><td colSpan={20} className="px-4 py-12 text-center text-muted-foreground">Tidak ada data yang cocok.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{totalRows} baris · halaman {page} dari {pageCount}</span>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" disabled={page <= 1 || pending} onClick={() => setQuery({ page: String(page - 1) })}>
            <ChevronLeft className="mr-1 h-4 w-4" /> Sebelumnya
          </Button>
          <Button size="sm" variant="outline" disabled={page >= pageCount || pending} onClick={() => setQuery({ page: String(page + 1) })}>
            Berikutnya <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
          <form onSubmit={submit}>
            <DialogHeader>
              <DialogTitle>
                {editing
                  ? `Edit invoice ${editing.invoiceNumber}`
                  : `Tambah invoice ${selectedSheetKey} nomor ${(selectedCustomer?.entryCount ?? 0) + 1}`}
              </DialogTitle>
              <DialogDescription>
                Data disimpan di dalam sheet {selectedSheetKey}, bukan sebagai
                customer baru. Grand total, jumlah dibayar, sisa, status, dan
                grafik bulanan dihitung otomatis.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-5 sm:grid-cols-2 lg:grid-cols-3">
              {[
                ["Nomor kwitansi", "receiptNumber", "text"],
                ["Nomor invoice *", "invoiceNumber", "text"],
                ["Tanggal invoice", "invoiceDate", "date"],
                ["Tanggal pengiriman", "deliveryDate", "date"],
                ["Nomor faktur pajak", "taxInvoiceNumber", "text"],
                ["Total sebelum PPN *", "subtotal", "number"],
                ["Nilai PPN *", "taxAmount", "number"],
                ["Tanggal transfer", "transferDate", "date"],
                ["Cicilan 1", "installment1", "number"],
                ["Cicilan 2", "installment2", "number"],
                ["Cicilan 3", "installment3", "number"],
              ].map(([label, name, type]) => (
                <div className="space-y-2" key={name}>
                  <Label htmlFor={name}>{label}</Label>
                  <Input
                    id={name}
                    type={type}
                    step={type === "number" ? "0.01" : undefined}
                    min={type === "number" ? "0" : undefined}
                    value={form[name as keyof FormState]}
                    onChange={(event) => setForm((current) => ({ ...current, [name]: event.target.value }))}
                    disabled={name.startsWith("installment") && Boolean(form.transferDate)}
                  />
                </div>
              ))}
              <div className="space-y-2">
                <Label htmlFor="paymentFakturDestinationBank">
                  Rekening tujuan
                </Label>
                <select
                  id="paymentFakturDestinationBank"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  value={form.destinationBank}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      destinationBank: event.target.value,
                    }))
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
              <div className="space-y-2">
                <Label htmlFor="paymentFakturPurchaseOrderNumber">
                  Nomor PO Logistics
                </Label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="paymentFakturPurchaseOrderNumber"
                    className="pl-9 pr-9"
                    role="combobox"
                    aria-autocomplete="list"
                    aria-expanded={purchaseOrderSearchOpen}
                    aria-controls="payment-faktur-purchase-order-options"
                    aria-activedescendant={
                      purchaseOrderSearchOpen && purchaseOrderOptions.length
                        ? `payment-faktur-purchase-order-option-${purchaseOrderOptions[activePurchaseOrderIndex]?.id}`
                        : undefined
                    }
                    autoComplete="off"
                    value={form.purchaseOrderNumber}
                    onChange={(event) => {
                      skipPurchaseOrderSearch.current = "";
                      if (
                        !shouldSearchFinancePurchaseOrders(event.target.value)
                      ) {
                        purchaseOrderRequestId.current += 1;
                        setPurchaseOrderOptions([]);
                        setPurchaseOrderSearchOpen(false);
                        setPurchaseOrderSearching(false);
                      }
                      setForm((current) => ({
                        ...current,
                        purchaseOrderNumber: event.target.value,
                      }));
                    }}
                    onFocus={() => {
                      if (
                        shouldSearchFinancePurchaseOrders(
                          form.purchaseOrderNumber,
                        ) &&
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
                    placeholder="Ketik minimal 3 karakter nomor PO"
                  />
                  {purchaseOrderSearching && (
                    <Loader2 className="pointer-events-none absolute right-3 top-3 h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                  {purchaseOrderSearchOpen && (
                    <div
                      id="payment-faktur-purchase-order-options"
                      role="listbox"
                      className="absolute z-50 mt-1 max-h-72 w-full min-w-80 overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
                    >
                      {purchaseOrderOptions.length ? (
                        purchaseOrderOptions.map((option, index) => (
                          <button
                            key={option.id}
                            id={`payment-faktur-purchase-order-option-${option.id}`}
                            type="button"
                            role="option"
                            aria-selected={index === activePurchaseOrderIndex}
                            className={`flex w-full items-start justify-between gap-3 rounded-sm px-3 py-2 text-left text-sm ${
                              index === activePurchaseOrderIndex
                                ? "bg-accent text-accent-foreground"
                                : "hover:bg-accent hover:text-accent-foreground"
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
                              </span>
                            </span>
                            <span className="shrink-0 text-xs text-muted-foreground">
                              {option.pricingComplete
                                ? rupiah.format(Number(option.subtotal))
                                : "Harga belum lengkap"}
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
                  Pilih rekomendasi untuk mengisi tanggal pengiriman, deskripsi,
                  total, dan PPN secara otomatis.
                </p>
              </div>
              <div className="space-y-2 sm:col-span-2 lg:col-span-3">
                <Label htmlFor="description">Deskripsi *</Label>
                <Textarea id="description" value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} rows={3} />
              </div>
              <div className="rounded-md bg-muted p-3"><p className="text-xs text-muted-foreground">Grand total</p><p className="font-semibold">{rupiah.format(calculatedTotal)}</p></div>
              <div className="rounded-md bg-muted p-3"><p className="text-xs text-muted-foreground">Hutang dibayar</p><p className="font-semibold">{rupiah.format(calculatedPaid)}</p></div>
              <div className="rounded-md bg-muted p-3"><p className="text-xs text-muted-foreground">Sisa hutang</p><p className="font-semibold">{rupiah.format(calculatedRemaining)}</p></div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Batal</Button>
              <Button type="submit" disabled={pending}>
                {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Simpan
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
