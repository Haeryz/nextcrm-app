"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";

import {
  createSupplierDebtEntry,
  updateSupplierDebtEntry,
} from "@/actions/mektek/supplier-debt-report";
import { Button } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";
import type { SupplierDebtEntryInput } from "@/lib/mektek/supplier-debt-entry";
import type { SupplierDebtDetailEntry } from "@/lib/mektek/supplier-debt-report";

type Draft = {
  number: string;
  purchaseOrderDate: string;
  purchaseOrderNumber: string;
  goodsReceiptDate: string;
  receivedBy: string;
  deliveryNoteNumber: string;
  invoiceDate: string;
  invoiceNumber: string;
  taxInvoiceNumber: string;
  dueDate: string;
  partNumber: string;
  description: string;
  quantity: string;
  unitPrice: string;
  amount: string;
  ppnAmount: string;
  grandTotal: string;
  partsEntryDate: string;
  paymentDate: string;
  paymentAmount: string;
  pbkDate: string;
  accountCode: string;
};

type DraftKey = keyof Draft;

const blankDraft = (): Draft => ({
  number: "",
  purchaseOrderDate: "",
  purchaseOrderNumber: "",
  goodsReceiptDate: "",
  receivedBy: "",
  deliveryNoteNumber: "",
  invoiceDate: "",
  invoiceNumber: "",
  taxInvoiceNumber: "",
  dueDate: "",
  partNumber: "",
  description: "",
  quantity: "",
  unitPrice: "",
  amount: "",
  ppnAmount: "",
  grandTotal: "",
  partsEntryDate: "",
  paymentDate: "",
  paymentAmount: "",
  pbkDate: "",
  accountCode: "",
});

const draftFromEntry = (entry?: SupplierDebtDetailEntry): Draft => {
  if (!entry) return blankDraft();
  const value = (input: string | number | null | undefined) =>
    input === null || input === undefined || input === 0 ? "" : String(input);
  return {
    number: value(entry.number),
    purchaseOrderDate: value(entry.purchaseOrderDate),
    purchaseOrderNumber: value(entry.purchaseOrderNumber),
    goodsReceiptDate: value(entry.goodsReceiptDate),
    receivedBy: value(entry.receivedBy),
    deliveryNoteNumber: value(entry.deliveryNoteNumber),
    invoiceDate: value(entry.invoiceDate),
    invoiceNumber: value(entry.invoiceNumber),
    taxInvoiceNumber: value(entry.taxInvoiceNumber),
    dueDate: value(entry.dueDate),
    partNumber: value(entry.partNumber),
    description: value(entry.description),
    quantity: value(entry.quantity),
    unitPrice: value(entry.unitPrice),
    amount: value(entry.amount),
    ppnAmount: value(entry.ppnAmount),
    grandTotal: value(entry.grandTotal),
    partsEntryDate: value(entry.partsEntryDate),
    paymentDate: value(entry.paymentDate),
    paymentAmount: value(entry.paymentAmount),
    pbkDate: value(entry.pbkDate),
    accountCode: value(entry.accountCode),
  };
};

const fields: Array<{
  key: DraftKey;
  label: string;
  type?: "date" | "number" | "text";
  placeholder?: string;
  readOnlyOnEdit?: boolean;
}> = [
  { key: "number", label: "No. baris", placeholder: "Otomatis jika kosong" },
  { key: "purchaseOrderDate", label: "Tanggal PO", type: "date" },
  { key: "purchaseOrderNumber", label: "Nomor PO", placeholder: "Contoh: PO-2026-001", readOnlyOnEdit: true },
  { key: "goodsReceiptDate", label: "Tanggal terima barang", type: "date" },
  { key: "receivedBy", label: "Diterima oleh" },
  { key: "deliveryNoteNumber", label: "Nomor SJ", placeholder: "Nomor surat jalan", readOnlyOnEdit: true },
  { key: "invoiceDate", label: "Tanggal invoice", type: "date" },
  { key: "invoiceNumber", label: "Nomor invoice" },
  { key: "taxInvoiceNumber", label: "Nomor faktur pajak" },
  { key: "dueDate", label: "Jatuh tempo", type: "date" },
  { key: "quantity", label: "Qty", type: "number", readOnlyOnEdit: true },
  { key: "unitPrice", label: "Harga satuan", type: "number", readOnlyOnEdit: true },
  { key: "amount", label: "Jumlah", type: "number", placeholder: "Qty × harga jika kosong", readOnlyOnEdit: true },
  { key: "ppnAmount", label: "PPN", type: "number", placeholder: "0 jika tidak ada PPN" },
  { key: "grandTotal", label: "Grand total", type: "number", placeholder: "Jumlah jika kosong", readOnlyOnEdit: true },
  { key: "partsEntryDate", label: "Date in part", type: "date" },
  { key: "paymentDate", label: "Tanggal bayar", type: "date" },
  { key: "paymentAmount", label: "Nominal bayar", type: "number" },
  { key: "pbkDate", label: "Tanggal PBK", type: "date" },
  { key: "accountCode", label: "Kode akun" },
];

export default function SupplierDebtEntryDialog({
  sheetKey,
  supplierName,
  entry,
}: {
  sheetKey: string;
  supplierName: string;
  entry?: SupplierDebtDetailEntry;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState(() => draftFromEntry(entry));
  const isEdit = Boolean(entry);

  const update = (key: DraftKey, value: string) => {
    if (key === "ppnAmount") {
      const amount = Number(draft.amount) || 0;
      const ppn = Number(value) || 0;
      setDraft((current) => ({
        ...current,
        ppnAmount: value,
        grandTotal: String(amount + ppn),
      }));
      return;
    }
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen) setDraft(draftFromEntry(entry));
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const input: SupplierDebtEntryInput = { sheetKey, ...draft };
    startTransition(async () => {
      const result =
        isEdit && entry
          ? await updateSupplierDebtEntry(entry.id, entry.sourceRow, input)
          : await createSupplierDebtEntry(input);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(isEdit ? "Baris berhasil diperbarui" : "Baris baru berhasil ditambahkan");
      setOpen(false);
      setDraft(blankDraft());
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {isEdit ? (
          <Button type="button" variant="ghost" size="icon" aria-label="Edit baris">
            <Pencil className="h-4 w-4" />
          </Button>
        ) : (
          <Button type="button">
            <Plus className="h-4 w-4" />
            Tambah baris
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit baris hutang" : "Tambah baris hutang"}</DialogTitle>
          <DialogDescription>
            {supplierName} · isi minimal Nomor PO, Nomor SJ, atau Nomor invoice.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-5">
          {isEdit && (
            <p className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
              Qty, Harga satuan, Jumlah, Nomor PO, Nomor SJ, dan Grand total terkunci
              karena mengikuti data Receiving / Logistik. PPN dan kolom lainnya
              masih dapat diperbarui.
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {fields.map((field) => {
              const isReadOnly = isEdit && field.readOnlyOnEdit;
              return (
                <div key={field.key} className="space-y-1.5">
                  <Label htmlFor={`supplier-debt-${field.key}`}>{field.label}</Label>
                  <Input
                    id={`supplier-debt-${field.key}`}
                    type={field.type ?? "text"}
                    min={field.type === "number" ? "0" : undefined}
                    step={field.key === "quantity" ? "0.001" : field.type === "number" ? "0.01" : undefined}
                    value={draft[field.key]}
                    placeholder={field.placeholder}
                    onChange={(event) => update(field.key, event.target.value)}
                    readOnly={isReadOnly}
                    className={isReadOnly ? "cursor-not-allowed bg-muted/50 text-muted-foreground" : undefined}
                  />
                </div>
              );
            })}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="supplier-debt-description">Deskripsi</Label>
            <Textarea
              id="supplier-debt-description"
              value={draft.description}
              onChange={(event) => update("description", event.target.value)}
              placeholder="Nama barang, jasa, atau keterangan tagihan"
              rows={3}
              required
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEdit ? "Simpan perubahan" : "Simpan baris"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
