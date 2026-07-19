"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, Edit, Loader2, Plus, Shuffle, TicketPercent, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  createMektekVoucher,
  deleteMektekVoucher,
  updateMektekVoucher,
  type MektekVoucherCustomerOption,
  type MektekVoucherInput,
} from "@/actions/mektek/vouchers";
import {
  createMektekVoucherCodeDictionary,
  deleteMektekVoucherCodeDictionary,
  randomizeMektekVoucherCode,
} from "@/actions/mektek/voucher-code-dictionaries";
import { Badge } from "@/components/ui/badge";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { RupiahInput } from "@/components/mektek/RupiahInput";

const NO_CUSTOMER = "NO_CUSTOMER";

type VoucherRow = {
  id: string;
  code: string;
  title: string;
  description: string;
  minSubtotal: number;
  discountType: "FIXED" | "PERCENTAGE";
  discountAmount: number | null;
  discountPercent: number | null;
  maxDiscount: number | null;
  scope: "ALL" | "CUSTOMER_TYPE" | "CUSTOMER";
  customerType: "STANDARD" | "B2B" | null;
  customerId: string | null;
  isActive: boolean;
  startsAt: string | null;
  expiresAt: string | null;
  usageLimit: number | null;
  usedCount: number;
  createdAt: string;
  updatedAt: string;
  customer: MektekVoucherCustomerOption | null;
};

type VoucherManagerProps = {
  vouchers: VoucherRow[];
  customers: MektekVoucherCustomerOption[];
  dictionaries: VoucherCodeDictionary[];
};

type VoucherCodeDictionary = {
  id: string;
  name: string;
  entries: string[];
  createdAt: string;
  updatedAt: string;
};

const blankVoucher: MektekVoucherInput = {
  code: "",
  title: "",
  description: "",
  minSubtotal: "",
  discountType: "FIXED",
  discountAmount: "",
  discountPercent: "",
  maxDiscount: "",
  scope: "ALL",
  customerType: "STANDARD",
  customerId: "",
  isActive: true,
  startsAt: "",
  expiresAt: "",
  usageLimit: "",
};

function formatCurrency(amount: number) {
  return amount.toLocaleString("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  });
}

function formatDate(value: string | null) {
  if (!value) return "Tidak ada tanggal";
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
  }).format(new Date(value));
}

function toDateInputValue(value: string | null) {
  return value ? value.slice(0, 10) : "";
}

function voucherToInput(voucher: VoucherRow): MektekVoucherInput {
  return {
    code: voucher.code,
    title: voucher.title,
    description: voucher.description,
    minSubtotal: String(voucher.minSubtotal || ""),
    discountType: voucher.discountType,
    discountAmount: voucher.discountAmount ? String(voucher.discountAmount) : "",
    discountPercent: voucher.discountPercent ? String(voucher.discountPercent) : "",
    maxDiscount: voucher.maxDiscount ? String(voucher.maxDiscount) : "",
    scope: voucher.scope,
    customerType: voucher.customerType ?? "STANDARD",
    customerId: voucher.customerId ?? "",
    isActive: voucher.isActive,
    startsAt: toDateInputValue(voucher.startsAt),
    expiresAt: toDateInputValue(voucher.expiresAt),
    usageLimit: voucher.usageLimit ? String(voucher.usageLimit) : "",
  };
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function discountLabel(voucher: VoucherRow) {
  if (voucher.discountType === "FIXED") {
    return formatCurrency(voucher.discountAmount ?? 0);
  }

  return voucher.maxDiscount
    ? `${voucher.discountPercent ?? 0}% hingga ${formatCurrency(voucher.maxDiscount)}`
    : `${voucher.discountPercent ?? 0}%`;
}

function targetLabel(voucher: VoucherRow) {
  if (voucher.scope === "CUSTOMER") {
    return voucher.customer
      ? `${voucher.customer.label} - ${voucher.customer.phone}`
      : "Customer tertentu";
  }
  if (voucher.scope === "CUSTOMER_TYPE") {
    return voucher.customerType === "B2B"
      ? "Customer perusahaan"
      : "Customer standard";
  }
  return "Semua Customer";
}

function usageLabel(voucher: VoucherRow) {
  return voucher.usageLimit
    ? `${voucher.usedCount}/${voucher.usageLimit} digunakan`
    : `${voucher.usedCount} digunakan`;
}

function VoucherForm({
  value,
  customers,
  dictionaries,
  onChange,
  onSubmit,
  submitLabel,
  pending,
}: {
  value: MektekVoucherInput;
  customers: MektekVoucherCustomerOption[];
  dictionaries: VoucherCodeDictionary[];
  onChange: (value: MektekVoucherInput) => void;
  onSubmit: () => void;
  submitLabel: string;
  pending: boolean;
}) {
  const [randomizeOpen, setRandomizeOpen] = useState(false);
  const [randomizeMode, setRandomizeMode] = useState<"PURE_RANDOM" | "DICTIONARY">(
    "PURE_RANDOM"
  );
  const [dictionaryId, setDictionaryId] = useState("");
  const [isRandomizing, startRandomizing] = useTransition();
  const update = (key: keyof MektekVoucherInput, nextValue: string | boolean) => {
    const next = { ...value, [key]: nextValue };
    if (key === "scope" && nextValue === "ALL") {
      next.customerType = "STANDARD";
      next.customerId = "";
    }
    if (key === "scope" && nextValue === "CUSTOMER_TYPE") {
      next.customerId = "";
    }
    if (key === "scope" && nextValue === "CUSTOMER") {
      next.customerType = "STANDARD";
    }
    if (key === "discountType" && nextValue === "FIXED") {
      next.discountPercent = "";
      next.maxDiscount = "";
    }
    if (key === "discountType" && nextValue === "PERCENTAGE") {
      next.discountAmount = "";
    }
    onChange(next);
  };

  const isPercentage = value.discountType === "PERCENTAGE";
  const isCustomerTypeScope = value.scope === "CUSTOMER_TYPE";
  const isCustomerScope = value.scope === "CUSTOMER";

  const randomizeCode = () => {
    startRandomizing(async () => {
      const result = await randomizeMektekVoucherCode(
        randomizeMode === "DICTIONARY"
          ? { mode: "DICTIONARY", dictionaryId }
          : { mode: "PURE_RANDOM" }
      );
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      update("code", result.data.code);
      setRandomizeOpen(false);
      toast.success("Voucher code randomized");
    });
  };

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Code">
          <div className="flex gap-2">
            <Input
              value={value.code}
              onChange={(event) => update("code", event.target.value.toUpperCase())}
              disabled={pending || isRandomizing}
              placeholder="MEKTEK-NEW"
              required
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => setRandomizeOpen(true)}
              disabled={pending || isRandomizing}
            >
              <Shuffle data-icon="inline-start" />
              Randomize
            </Button>
          </div>
        </Field>
        <Field label="Status">
          <Select
            value={value.isActive === false ? "INACTIVE" : "ACTIVE"}
            onValueChange={(nextValue) => update("isActive", nextValue === "ACTIVE")}
            disabled={pending}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="INACTIVE">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Title">
          <Input
            value={value.title}
            onChange={(event) => update("title", event.target.value)}
            disabled={pending}
            required
          />
        </Field>
        <Field label="Target">
          <Select
            value={value.scope}
            onValueChange={(nextValue) => update("scope", nextValue)}
            disabled={pending}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Semua Customer</SelectItem>
              <SelectItem value="CUSTOMER_TYPE">Customer type</SelectItem>
              <SelectItem value="CUSTOMER">Customer tertentu</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        {isCustomerTypeScope && (
          <Field label="Customer type">
            <Select
              value={value.customerType || "STANDARD"}
              onValueChange={(nextValue) => update("customerType", nextValue)}
              disabled={pending}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="STANDARD">Customer standard</SelectItem>
                <SelectItem value="B2B">Perusahaan</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        )}
        {isCustomerScope && (
          <Field label="Customer">
            <Select
              value={value.customerId || NO_CUSTOMER}
              onValueChange={(nextValue) =>
                update("customerId", nextValue === NO_CUSTOMER ? "" : nextValue)
              }
              disabled={pending || customers.length === 0}
            >
              <SelectTrigger>
                <SelectValue placeholder="Pilih Customer" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_CUSTOMER} disabled>
                  Pilih Customer
                </SelectItem>
                {customers.length === 0 && (
                  <SelectItem value="NO_CUSTOMERS_AVAILABLE" disabled>
                    Customer belum tersedia
                  </SelectItem>
                )}
                {customers.map((customer) => (
                  <SelectItem key={customer.id} value={customer.id}>
                    {customer.label} - {customer.phone}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}
        <Field label="Discount type">
          <Select
            value={value.discountType}
            onValueChange={(nextValue) => update("discountType", nextValue)}
            disabled={pending}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="FIXED">Fixed amount</SelectItem>
              <SelectItem value="PERCENTAGE">Percentage</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        {isPercentage ? (
          <>
            <Field label="Discount percent">
              <Input
                type="number"
                min="1"
                max="100"
                value={value.discountPercent ?? ""}
                onChange={(event) => update("discountPercent", event.target.value)}
                disabled={pending}
                required
              />
            </Field>
            <Field label="Max discount">
              <RupiahInput
                aria-label="Maximum discount in Rupiah"
                value={value.maxDiscount ?? ""}
                onValueChange={(nextValue) => update("maxDiscount", nextValue)}
                disabled={pending}
                placeholder="Opsional"
              />
            </Field>
          </>
        ) : (
          <Field label="Discount amount">
            <RupiahInput
              aria-label="Discount amount in Rupiah"
              value={value.discountAmount ?? ""}
              onValueChange={(nextValue) => update("discountAmount", nextValue)}
              disabled={pending}
              required
            />
          </Field>
        )}
        <Field label="Minimum subtotal">
          <RupiahInput
            aria-label="Minimum subtotal in Rupiah"
            value={value.minSubtotal ?? ""}
            onValueChange={(nextValue) => update("minSubtotal", nextValue)}
            disabled={pending}
            placeholder="0"
          />
        </Field>
        <Field label="Usage limit">
          <Input
            type="number"
            min="1"
            value={value.usageLimit ?? ""}
            onChange={(event) => update("usageLimit", event.target.value)}
            disabled={pending}
            placeholder="Tanpa batas"
          />
        </Field>
        <Field label="Start date">
          <Input
            type="date"
            value={value.startsAt ?? ""}
            onChange={(event) => update("startsAt", event.target.value)}
            disabled={pending}
          />
        </Field>
        <Field label="Expiry date">
          <Input
            type="date"
            value={value.expiresAt ?? ""}
            onChange={(event) => update("expiresAt", event.target.value)}
            disabled={pending}
          />
        </Field>
        <div className="md:col-span-2">
          <Field label="Description">
            <Textarea
              value={value.description ?? ""}
              onChange={(event) => update("description", event.target.value)}
              disabled={pending}
              required
            />
          </Field>
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 data-icon="inline-start" className="animate-spin" />}
          {submitLabel}
        </Button>
      </div>

      <Dialog open={randomizeOpen} onOpenChange={setRandomizeOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Randomize voucher code</DialogTitle>
            <DialogDescription>
              Generate a unique random code or choose an unused code from a dictionary.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <Field label="Source">
              <Select
                value={randomizeMode}
                onValueChange={(next) =>
                  setRandomizeMode(next as "PURE_RANDOM" | "DICTIONARY")
                }
                disabled={isRandomizing}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PURE_RANDOM">Pure random</SelectItem>
                  <SelectItem value="DICTIONARY">Code dictionary</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            {randomizeMode === "DICTIONARY" && (
              <Field label="Dictionary">
                <Select
                  value={dictionaryId}
                  onValueChange={setDictionaryId}
                  disabled={isRandomizing || dictionaries.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a dictionary" />
                  </SelectTrigger>
                  <SelectContent>
                    {dictionaries.map((dictionary) => (
                      <SelectItem key={dictionary.id} value={dictionary.id}>
                        {dictionary.name} ({dictionary.entries.length})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {dictionaries.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Create a code dictionary from the voucher page first.
                  </p>
                )}
              </Field>
            )}
            <div className="flex justify-end">
              <Button
                type="button"
                onClick={randomizeCode}
                disabled={
                  isRandomizing || (randomizeMode === "DICTIONARY" && !dictionaryId)
                }
              >
                {isRandomizing ? (
                  <Loader2 data-icon="inline-start" className="animate-spin" />
                ) : (
                  <Shuffle data-icon="inline-start" />
                )}
                Randomize
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </form>
  );
}

function DictionaryManager({ dictionaries }: { dictionaries: VoucherCodeDictionary[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [entries, setEntries] = useState("");
  const [pending, startTransition] = useTransition();

  const createDictionary = () => {
    startTransition(async () => {
      const result = await createMektekVoucherCodeDictionary({ name, entries });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      setName("");
      setEntries("");
      toast.success("Code dictionary created");
      router.refresh();
    });
  };

  const deleteDictionary = (id: string) => {
    startTransition(async () => {
      const result = await deleteMektekVoucherCodeDictionary(id);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Code dictionary deleted");
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" className="w-full sm:w-auto">
          <BookOpen data-icon="inline-start" />
          Code dictionaries
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Code dictionaries</DialogTitle>
          <DialogDescription>
            Create reusable pools of voucher codes. Add one code per line or separate them with commas.
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-3 rounded-lg border p-4"
          onSubmit={(event) => {
            event.preventDefault();
            createDictionary();
          }}
        >
          <Field label="Dictionary name">
            <Input value={name} onChange={(event) => setName(event.target.value)} disabled={pending} required />
          </Field>
          <Field label="Voucher codes">
            <Textarea
              value={entries}
              onChange={(event) => setEntries(event.target.value)}
              disabled={pending}
              placeholder={"SUMMER-25\nWELCOME-50\nVIP-SERVICE"}
              rows={5}
              required
            />
          </Field>
          <div className="flex justify-end">
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 data-icon="inline-start" className="animate-spin" />}
              Create dictionary
            </Button>
          </div>
        </form>
        <div className="divide-y rounded-lg border">
          {dictionaries.map((dictionary) => (
            <div key={dictionary.id} className="flex items-center justify-between gap-3 p-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{dictionary.name}</p>
                <p className="text-xs text-muted-foreground">
                  {dictionary.entries.length} code{dictionary.entries.length === 1 ? "" : "s"}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => deleteDictionary(dictionary.id)}
                disabled={pending}
                aria-label={`Delete ${dictionary.name}`}
              >
                <Trash2 />
              </Button>
            </div>
          ))}
          {dictionaries.length === 0 && (
            <p className="p-4 text-center text-sm text-muted-foreground">
              No code dictionaries yet.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function VoucherManager({
  vouchers,
  customers,
  dictionaries,
}: VoucherManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [createOpen, setCreateOpen] = useState(false);
  const [editingVoucher, setEditingVoucher] = useState<VoucherRow | null>(null);
  const [createValue, setCreateValue] = useState<MektekVoucherInput>(blankVoucher);
  const [editValue, setEditValue] = useState<MektekVoucherInput>(blankVoucher);

  const countLabel = `${vouchers.length} Voucher di halaman ini`;

  const submitCreate = () => {
    startTransition(async () => {
      const result = await createMektekVoucher(createValue);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Voucher berhasil dibuat");
      setCreateValue(blankVoucher);
      setCreateOpen(false);
      router.refresh();
    });
  };

  const openEdit = (voucher: VoucherRow) => {
    setEditingVoucher(voucher);
    setEditValue(voucherToInput(voucher));
  };

  const submitEdit = () => {
    if (!editingVoucher) return;
    startTransition(async () => {
      const result = await updateMektekVoucher(editingVoucher.id, editValue);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Voucher berhasil diperbarui");
      setEditingVoucher(null);
      router.refresh();
    });
  };

  const deleteVoucher = (voucher: VoucherRow) => {
    startTransition(async () => {
      const result = await deleteMektekVoucher(voucher.id);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Voucher berhasil dihapus");
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">{countLabel}</p>
        <div className="grid gap-2 sm:flex">
        <DictionaryManager dictionaries={dictionaries} />
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto">
              <Plus data-icon="inline-start" />
              Tambah Voucher
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle>Tambah Voucher</DialogTitle>
              <DialogDescription>
                Buat Voucher Code dan pilih siapa yang dapat menggunakannya.
              </DialogDescription>
            </DialogHeader>
            <VoucherForm
              value={createValue}
              customers={customers}
              dictionaries={dictionaries}
              onChange={setCreateValue}
              onSubmit={submitCreate}
              submitLabel="Buat Voucher"
              pending={isPending}
            />
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border">
        <div className="hidden grid-cols-[minmax(0,1.2fr)_minmax(160px,0.9fr)_minmax(140px,0.6fr)_minmax(180px,0.8fr)_128px] gap-4 border-b bg-muted/30 px-4 py-3 text-xs font-medium uppercase text-muted-foreground lg:grid">
          <span>Voucher</span>
          <span>Target</span>
          <span>Discount</span>
          <span>Validity</span>
          <span className="text-right">Actions</span>
        </div>
        <div className="divide-y">
          {vouchers.map((voucher) => (
            <div
              key={voucher.id}
              className="grid gap-3 px-4 py-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(160px,0.9fr)_minmax(140px,0.6fr)_minmax(180px,0.8fr)_128px] lg:items-center lg:gap-4"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <TicketPercent className="size-4 text-muted-foreground" />
                  <p className="truncate font-medium">{voucher.title}</p>
                  <Badge variant={voucher.isActive ? "default" : "secondary"}>
                    {voucher.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <p className="mt-1 font-mono text-sm">{voucher.code}</p>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                  {voucher.description}
                </p>
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm">{targetLabel(voucher)}</p>
                <p className="mt-1 text-xs text-muted-foreground">{usageLabel(voucher)}</p>
              </div>
              <div className="text-sm">
                <p className="font-medium">{discountLabel(voucher)}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Min {voucher.minSubtotal > 0 ? formatCurrency(voucher.minSubtotal) : "tidak ada"}
                </p>
              </div>
              <div className="text-sm text-muted-foreground">
                <p>Start Date: {formatDate(voucher.startsAt)}</p>
                <p>Expiry Date: {formatDate(voucher.expiresAt)}</p>
              </div>
              <div className="flex flex-wrap justify-start gap-2 lg:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => openEdit(voucher)}
                  disabled={isPending}
                  className="flex-1 sm:flex-none"
                >
                  <Edit data-icon="inline-start" />
                  Edit
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => deleteVoucher(voucher)}
                  disabled={isPending || voucher.usedCount > 0}
                  aria-label={`Hapus ${voucher.title}`}
                  className="shrink-0"
                >
                  <Trash2 />
                </Button>
              </div>
            </div>
          ))}
          {vouchers.length === 0 && (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              Tidak ada Voucher yang cocok dengan Filter ini.
            </div>
          )}
        </div>
      </div>

      <Dialog open={!!editingVoucher} onOpenChange={(open) => !open && setEditingVoucher(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Edit Voucher</DialogTitle>
            <DialogDescription>
              Perbarui Voucher Code, Discount, Target, atau ketersediaannya.
            </DialogDescription>
          </DialogHeader>
          <VoucherForm
            value={editValue}
            customers={customers}
            dictionaries={dictionaries}
            onChange={setEditValue}
            onSubmit={submitEdit}
            submitLabel="Simpan perubahan"
            pending={isPending}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
