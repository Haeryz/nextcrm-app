"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  createFinanceInvoiceEntry,
  deleteFinanceInvoiceEntry,
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

export default function InvoiceCrudManager({
  rows,
  customerNames,
}: {
  rows: FinanceInvoiceCrudRow[];
  customerNames: string[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<InvoiceFormState>(emptyForm);
  const totalPreview = useMemo(() => {
    const subtotal = Number(form.subtotal || 0);
    const rate = Number(form.taxRate || 0);
    return Number.isFinite(subtotal) && Number.isFinite(rate)
      ? subtotal * (1 + rate / 100)
      : 0;
  }, [form.subtotal, form.taxRate]);

  const set = (name: keyof InvoiceFormState, value: string) =>
    setForm((current) => ({ ...current, [name]: value }));

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (row: FinanceInvoiceCrudRow) => {
    setEditingId(row.id);
    setForm({
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
    setOpen(true);
  };

  const submit = () => {
    startTransition(async () => {
      const input: FinanceInvoiceEntryInput = {
        ...form,
        subtotal: form.subtotal,
        taxRate: form.taxRate,
      };
      const result = editingId
        ? await updateFinanceInvoiceEntry(editingId, input)
        : await createFinanceInvoiceEntry(input);
      if ("error" in result) {
        toast.error(result.error);
        return;
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
              <Input id="purchaseOrderNumber" value={fieldValue(form, "purchaseOrderNumber")} onChange={(event) => set("purchaseOrderNumber", event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="purchaseOrderDate">Tanggal PO</Label>
              <Input id="purchaseOrderDate" type="date" value={fieldValue(form, "purchaseOrderDate")} onChange={(event) => set("purchaseOrderDate", event.target.value)} />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="description">Jenis pengeluaran / deskripsi *</Label>
              <Textarea id="description" value={fieldValue(form, "description")} onChange={(event) => set("description", event.target.value)} placeholder="Jasa, spare part, rental, service, atau pekerjaan lain" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="subtotal">Nilai sebelum PPN (IDR) *</Label>
              <Input id="subtotal" type="number" min="0" step="0.01" value={form.subtotal} onChange={(event) => set("subtotal", event.target.value)} />
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
              <Label htmlFor="accountDestination">Rekening tujuan</Label>
              <Input id="accountDestination" value={fieldValue(form, "accountDestination")} onChange={(event) => set("accountDestination", event.target.value)} />
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
    </div>
  );
}
