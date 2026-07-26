"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  createFinanceContractEntry,
  deleteFinanceContractEntry,
  renewFinanceContract,
  updateFinanceContractEntry,
  type FinanceContractEntryInput,
} from "@/actions/mektek/finance";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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

export type FinanceContractLineRow = {
  itemName: string;
  partNumber: string;
  quantity: string;
  unitPrice: string;
};

export type FinanceContractCrudRow = {
  id: string;
  contractNumber: string;
  customerName: string;
  type: string;
  status: string;
  version: number;
  supersedesNumber: string;
  hasSuccessor: boolean;
  projectName: string;
  siteName: string;
  startDate: string;
  endDate: string;
  contractValue: number;
  notes: string;
  lineCount: number;
  purchaseOrderCount: number;
  daysRemaining: number;
  lines: FinanceContractLineRow[];
};

const CONTRACT_TYPES = [
  { value: "SERVICE", label: "Jasa" },
  { value: "SPARE_PART", label: "Suku cadang" },
  { value: "RENTAL", label: "Sewa" },
  { value: "CONSIGNMENT", label: "Konsinyasi" },
  { value: "MIXED", label: "Campuran" },
  { value: "OTHER", label: "Lainnya" },
] as const;

const statusLabel: Record<string, string> = {
  DRAFT: "Draf",
  ACTIVE: "Aktif",
  TERMINATED: "Dihentikan",
};

const typeLabel = Object.fromEntries(
  CONTRACT_TYPES.map((type) => [type.value, type.label]),
) as Record<string, string>;

const idr = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

const formatDate = (value: string) =>
  value
    ? new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(
        new Date(`${value}T00:00:00.000Z`),
      )
    : "—";

const emptyLine: FinanceContractLineRow = {
  itemName: "",
  partNumber: "",
  quantity: "",
  unitPrice: "",
};

type ContractFormState = {
  customerName: string;
  contractNumber: string;
  type: string;
  projectName: string;
  siteName: string;
  startDate: string;
  endDate: string;
  contractValue: string;
  notes: string;
  lines: FinanceContractLineRow[];
};

const emptyForm: ContractFormState = {
  customerName: "",
  contractNumber: "",
  type: "SERVICE",
  projectName: "",
  siteName: "",
  startDate: new Date().toISOString().slice(0, 10),
  endDate: "",
  contractValue: "",
  notes: "",
  lines: [{ ...emptyLine }],
};

const formFromRow = (row: FinanceContractCrudRow): ContractFormState => ({
  customerName: row.customerName,
  contractNumber: row.contractNumber,
  type: row.type,
  projectName: row.projectName,
  siteName: row.siteName,
  startDate: row.startDate,
  endDate: row.endDate,
  contractValue: row.contractValue ? String(row.contractValue) : "",
  notes: row.notes,
  lines: row.lines.length
    ? row.lines.map((line) => ({ ...line }))
    : [{ ...emptyLine }],
});

/** The day after the contract ends, used to prefill the renewal period. */
const nextDay = (value: string) => {
  if (!value) return "";
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return "";
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
};

export default function ContractCrudManager({
  rows,
  customers,
}: {
  rows: FinanceContractCrudRow[];
  customers: string[];
}) {
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ContractFormState>(emptyForm);
  const [renewTarget, setRenewTarget] =
    useState<FinanceContractCrudRow | null>(null);
  const [renewForm, setRenewForm] = useState({
    contractNumber: "",
    startDate: "",
    endDate: "",
  });

  const linesTotal = useMemo(
    () =>
      form.lines.reduce((total, line) => {
        const quantity = Number(String(line.quantity).replace(",", ".")) || 0;
        const unitPrice = Number(String(line.unitPrice).replace(",", ".")) || 0;
        return total + quantity * unitPrice;
      }, 0),
    [form.lines],
  );

  const set = (name: keyof ContractFormState, value: string) =>
    setForm((current) => ({ ...current, [name]: value }));

  const setLine = (
    index: number,
    name: keyof FinanceContractLineRow,
    value: string,
  ) =>
    setForm((current) => ({
      ...current,
      lines: current.lines.map((line, position) =>
        position === index ? { ...line, [name]: value } : line,
      ),
    }));

  const addLine = () =>
    setForm((current) => ({
      ...current,
      lines: [...current.lines, { ...emptyLine }],
    }));

  const removeLine = (index: number) =>
    setForm((current) => {
      const lines = current.lines.filter((_, position) => position !== index);
      return { ...current, lines: lines.length ? lines : [{ ...emptyLine }] };
    });

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (row: FinanceContractCrudRow) => {
    setEditingId(row.id);
    setForm(formFromRow(row));
    setOpen(true);
  };

  const openRenew = (row: FinanceContractCrudRow) => {
    setRenewTarget(row);
    setRenewForm({
      contractNumber: row.contractNumber,
      startDate: nextDay(row.endDate),
      endDate: "",
    });
  };

  const submit = () => {
    startTransition(async () => {
      const input: FinanceContractEntryInput = {
        customerName: form.customerName,
        contractNumber: form.contractNumber,
        type: form.type as FinanceContractEntryInput["type"],
        projectName: form.projectName,
        siteName: form.siteName,
        startDate: form.startDate,
        endDate: form.endDate,
        contractValue: form.contractValue,
        notes: form.notes,
        lines: form.lines,
      };
      const result = editingId
        ? await updateFinanceContractEntry(editingId, input)
        : await createFinanceContractEntry(input);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(editingId ? "Kontrak diperbarui" : "Kontrak dibuat");
      setOpen(false);
      setEditingId(null);
      setForm(emptyForm);
    });
  };

  const submitRenewal = () => {
    if (!renewTarget) return;
    startTransition(async () => {
      const result = await renewFinanceContract(renewTarget.id, {
        contractNumber: renewForm.contractNumber,
        startDate: renewForm.startDate,
        endDate: renewForm.endDate,
      });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Kontrak lanjutan dibuat sebagai draf");
      setRenewTarget(null);
    });
  };

  const remove = (row: FinanceContractCrudRow) => {
    if (
      !window.confirm(`Hapus kontrak ${row.contractNumber}? Tindakan ini permanen.`)
    ) {
      return;
    }
    startTransition(async () => {
      const result = await deleteFinanceContractEntry(row.id);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Kontrak dihapus");
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button onClick={openCreate}>Tambah kontrak</Button>
      </div>

      {rows.length ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {rows.map((row) => (
            <Card
              key={row.id}
              className={
                row.status === "ACTIVE" &&
                row.daysRemaining >= 0 &&
                row.daysRemaining <= 7
                  ? "border-amber-400 bg-amber-50"
                  : undefined
              }
            >
              <CardContent className="p-5">
                <div className="flex justify-between gap-3">
                  <div>
                    <p className="font-semibold">
                      {row.contractNumber}
                      {row.version > 1 ? (
                        <span className="ml-2 text-xs text-muted-foreground">
                          revisi ke-{row.version}
                        </span>
                      ) : null}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {row.customerName} · {typeLabel[row.type] ?? row.type}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge variant="outline">
                      {statusLabel[row.status] ?? row.status}
                    </Badge>
                    {row.status === "ACTIVE" &&
                    row.daysRemaining >= 0 &&
                    row.daysRemaining <= 7 ? (
                      <Badge variant="destructive">
                        {row.daysRemaining === 0
                          ? "Berakhir hari ini"
                          : `${row.daysRemaining} hari lagi`}
                      </Badge>
                    ) : null}
                    {row.hasSuccessor ? (
                      <Badge variant="secondary">Sudah diperpanjang</Badge>
                    ) : null}
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground">Periode</p>
                    <p>
                      {formatDate(row.startDate)} – {formatDate(row.endDate)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Cakupan</p>
                    <p>
                      {row.lineCount} item · {row.purchaseOrderCount} PO
                    </p>
                  </div>
                  {row.contractValue ? (
                    <div>
                      <p className="text-muted-foreground">Nilai kontrak</p>
                      <p>{idr.format(row.contractValue)}</p>
                    </div>
                  ) : null}
                  {row.supersedesNumber ? (
                    <div>
                      <p className="text-muted-foreground">Lanjutan dari</p>
                      <p>{row.supersedesNumber}</p>
                    </div>
                  ) : null}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openEdit(row)}
                    disabled={pending}
                  >
                    Ubah
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openRenew(row)}
                    disabled={
                      pending || row.status === "DRAFT" || row.hasSuccessor
                    }
                  >
                    Buat kontrak lanjutan
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => remove(row)}
                    disabled={pending || row.purchaseOrderCount > 0}
                  >
                    Hapus
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          Belum ada kontrak. Gunakan tombol Tambah kontrak untuk membuat yang
          pertama.
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Ubah kontrak" : "Tambah kontrak"}
            </DialogTitle>
            <DialogDescription>
              Kontrak baru dibuat sebagai draf. Unggah dokumen bertanda tangan
              sebelum mengaktifkannya.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="contract-customer">Nama pelanggan *</Label>
              <Input
                id="contract-customer"
                list="finance-contract-customers"
                value={form.customerName}
                onChange={(event) => set("customerName", event.target.value)}
              />
              <datalist id="finance-contract-customers">
                {customers.map((customer) => (
                  <option key={customer} value={customer} />
                ))}
              </datalist>
            </div>
            <div className="space-y-2">
              <Label htmlFor="contract-number">Nomor kontrak *</Label>
              <Input
                id="contract-number"
                value={form.contractNumber}
                onChange={(event) => set("contractNumber", event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contract-type">Jenis kontrak</Label>
              <select
                id="contract-type"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                value={form.type}
                onChange={(event) => set("type", event.target.value)}
              >
                {CONTRACT_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="contract-value">Nilai kontrak (IDR)</Label>
              <Input
                id="contract-value"
                type="number"
                min="0"
                step="0.01"
                value={form.contractValue}
                onChange={(event) => set("contractValue", event.target.value)}
              />
              {linesTotal > 0 ? (
                <p className="text-xs text-muted-foreground">
                  Total rincian item: {idr.format(linesTotal)}
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="contract-project">Nama proyek</Label>
              <Input
                id="contract-project"
                value={form.projectName}
                onChange={(event) => set("projectName", event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contract-site">Site</Label>
              <Input
                id="contract-site"
                value={form.siteName}
                onChange={(event) => set("siteName", event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contract-start">Tanggal mulai *</Label>
              <Input
                id="contract-start"
                type="date"
                value={form.startDate}
                onChange={(event) => set("startDate", event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contract-end">Tanggal berakhir *</Label>
              <Input
                id="contract-end"
                type="date"
                value={form.endDate}
                onChange={(event) => set("endDate", event.target.value)}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <div className="flex items-center justify-between gap-2">
                <Label>Rincian item kontrak</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addLine}
                >
                  Tambah item
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Wajib diisi untuk kontrak Konsinyasi.
              </p>
              <div className="space-y-2">
                {form.lines.map((line, index) => (
                  <div
                    key={index}
                    className="grid gap-2 rounded-md border p-2 md:grid-cols-[minmax(0,3fr)_minmax(0,1.5fr)_minmax(0,0.8fr)_minmax(0,1.2fr)_auto] md:items-end"
                  >
                    <div className="space-y-1">
                      <Label className="text-xs" htmlFor={`contract-item-${index}`}>
                        Nama item
                      </Label>
                      <Input
                        id={`contract-item-${index}`}
                        value={line.itemName}
                        onChange={(event) =>
                          setLine(index, "itemName", event.target.value)
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label
                        className="text-xs"
                        htmlFor={`contract-part-${index}`}
                      >
                        Part number
                      </Label>
                      <Input
                        id={`contract-part-${index}`}
                        value={line.partNumber}
                        onChange={(event) =>
                          setLine(index, "partNumber", event.target.value)
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs" htmlFor={`contract-qty-${index}`}>
                        Qty
                      </Label>
                      <Input
                        id={`contract-qty-${index}`}
                        type="number"
                        min="0"
                        step="1"
                        value={line.quantity}
                        onChange={(event) =>
                          setLine(index, "quantity", event.target.value)
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label
                        className="text-xs"
                        htmlFor={`contract-price-${index}`}
                      >
                        Harga satuan
                      </Label>
                      <Input
                        id={`contract-price-${index}`}
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.unitPrice}
                        onChange={(event) =>
                          setLine(index, "unitPrice", event.target.value)
                        }
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeLine(index)}
                      disabled={form.lines.length === 1}
                    >
                      Hapus
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="contract-notes">Catatan</Label>
              <Textarea
                id="contract-notes"
                value={form.notes}
                onChange={(event) => set("notes", event.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button onClick={submit} disabled={pending}>
              {pending ? "Menyimpan…" : "Simpan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(renewTarget)}
        onOpenChange={(next) => (next ? null : setRenewTarget(null))}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Buat kontrak lanjutan</DialogTitle>
            <DialogDescription>
              Item dan nilai kontrak {renewTarget?.contractNumber} disalin ke
              kontrak baru berstatus draf. Kontrak lama ditutup.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="renew-number">Nomor kontrak lanjutan</Label>
              <Input
                id="renew-number"
                value={renewForm.contractNumber}
                onChange={(event) =>
                  setRenewForm((current) => ({
                    ...current,
                    contractNumber: event.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="renew-start">Tanggal mulai *</Label>
              <Input
                id="renew-start"
                type="date"
                value={renewForm.startDate}
                onChange={(event) =>
                  setRenewForm((current) => ({
                    ...current,
                    startDate: event.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="renew-end">Tanggal berakhir *</Label>
              <Input
                id="renew-end"
                type="date"
                value={renewForm.endDate}
                onChange={(event) =>
                  setRenewForm((current) => ({
                    ...current,
                    endDate: event.target.value,
                  }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRenewTarget(null)}>
              Batal
            </Button>
            <Button onClick={submitRenewal} disabled={pending}>
              {pending ? "Menyimpan…" : "Buat kontrak lanjutan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
