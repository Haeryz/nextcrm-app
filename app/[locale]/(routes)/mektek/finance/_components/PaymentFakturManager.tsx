"use client";

import { FormEvent, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Loader2, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  createPaymentFakturEntry,
  deletePaymentFakturEntry,
  updatePaymentFakturEntry,
  type PaymentFakturEntryInput,
} from "@/actions/mektek/payment-faktur";
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
  selectedCustomerId,
  selectedSheetKey,
  rows,
  summary,
  search,
  page,
  pageCount,
  totalRows,
}: {
  customers: PaymentFakturCustomerOption[];
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
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PaymentFakturRow | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [searchValue, setSearchValue] = useState(search);
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
    setDialogOpen(true);
  };
  const openEdit = (row: PaymentFakturRow) => {
    setEditing(row);
    setForm({
      receiptNumber: row.receiptNumber ?? "",
      invoiceNumber: row.invoiceNumber,
      invoiceDate: row.invoiceDate ?? "",
      purchaseOrderNumber: row.purchaseOrderNumber ?? "",
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
      <div className="mx-4 rounded-lg border border-dashed p-8 text-center sm:mx-6">
        <h2 className="text-lg font-semibold">Data Payment Faktur belum diimpor</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Jalankan impor workbook PAYMENT FAKTUR 2026 setelah migrasi database.
        </p>
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
            Tambah invoice
          </Button>
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

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
            <tr>
              {["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"].map((month) => (
                <th key={month} className="px-3 py-2 text-right">{month}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              {summary.monthlyTotals.map((amount, index) => (
                <td key={index} className="whitespace-nowrap px-3 py-3 text-right font-medium">{rupiah.format(amount)}</td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          setQuery({ q: searchValue.trim() || null, page: null });
        }}
      >
        <div className="relative max-w-xl flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
            placeholder="Cari invoice, kwitansi, PO, faktur pajak, atau deskripsi"
          />
        </div>
        <Button type="submit" variant="outline" disabled={pending}>Cari</Button>
      </form>

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
                  <td className="px-3 py-3 text-muted-foreground">{row.sourceRow ? row.sourceRow - 14 : (page - 1) * 50 + index + 1}</td>
                  <td className="px-3 py-3">{row.receiptNumber || "—"}</td>
                  <td className="px-3 py-3 font-medium">{row.invoiceNumber}</td>
                  <td className="px-3 py-3">{dateLabel(row.invoiceDate)}</td>
                  <td className="max-w-52 px-3 py-3">{row.purchaseOrderNumber || "—"}</td>
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
                <tr><td colSpan={19} className="px-4 py-12 text-center text-muted-foreground">Tidak ada data yang cocok.</td></tr>
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
              <DialogTitle>{editing ? "Edit Payment Faktur" : "Tambah Payment Faktur"}</DialogTitle>
              <DialogDescription>
                Kolom mengikuti sheet {selectedSheetKey}. Grand total, hutang dibayar, sisa hutang, status, dan bulan dihitung otomatis.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-5 sm:grid-cols-2 lg:grid-cols-3">
              {[
                ["Nomor kwitansi", "receiptNumber", "text"],
                ["Nomor invoice *", "invoiceNumber", "text"],
                ["Tanggal invoice", "invoiceDate", "date"],
                ["Nomor PO", "purchaseOrderNumber", "text"],
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
