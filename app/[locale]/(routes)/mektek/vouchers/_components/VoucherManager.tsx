"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Edit, Loader2, Plus, TicketPercent, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  createMektekVoucher,
  deleteMektekVoucher,
  updateMektekVoucher,
  type MektekVoucherCustomerOption,
  type MektekVoucherInput,
} from "@/actions/mektek/vouchers";
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
  if (!value) return "No date";
  return new Intl.DateTimeFormat("en", {
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
    ? `${voucher.discountPercent ?? 0}% up to ${formatCurrency(voucher.maxDiscount)}`
    : `${voucher.discountPercent ?? 0}%`;
}

function targetLabel(voucher: VoucherRow) {
  if (voucher.scope === "CUSTOMER") {
    return voucher.customer
      ? `${voucher.customer.label} - ${voucher.customer.phone}`
      : "Specific customer";
  }
  if (voucher.scope === "CUSTOMER_TYPE") {
    return voucher.customerType === "B2B"
      ? "Perusahaan customers"
      : "Standard customers";
  }
  return "All customers";
}

function usageLabel(voucher: VoucherRow) {
  return voucher.usageLimit
    ? `${voucher.usedCount}/${voucher.usageLimit} used`
    : `${voucher.usedCount} used`;
}

function VoucherForm({
  value,
  customers,
  onChange,
  onSubmit,
  submitLabel,
  pending,
}: {
  value: MektekVoucherInput;
  customers: MektekVoucherCustomerOption[];
  onChange: (value: MektekVoucherInput) => void;
  onSubmit: () => void;
  submitLabel: string;
  pending: boolean;
}) {
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
          <Input
            value={value.code}
            onChange={(event) => update("code", event.target.value.toUpperCase())}
            disabled={pending}
            placeholder="MEKTEK-NEW"
            required
          />
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
              <SelectItem value="ALL">All customers</SelectItem>
              <SelectItem value="CUSTOMER_TYPE">Customer type</SelectItem>
              <SelectItem value="CUSTOMER">Specific customer</SelectItem>
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
                <SelectItem value="STANDARD">Standard customer</SelectItem>
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
                <SelectValue placeholder="Select customer" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_CUSTOMER} disabled>
                  Select customer
                </SelectItem>
                {customers.length === 0 && (
                  <SelectItem value="NO_CUSTOMERS_AVAILABLE" disabled>
                    No customers available
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
                placeholder="Optional"
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
            placeholder="Unlimited"
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
    </form>
  );
}

export default function VoucherManager({
  vouchers,
  customers,
}: VoucherManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [createOpen, setCreateOpen] = useState(false);
  const [editingVoucher, setEditingVoucher] = useState<VoucherRow | null>(null);
  const [createValue, setCreateValue] = useState<MektekVoucherInput>(blankVoucher);
  const [editValue, setEditValue] = useState<MektekVoucherInput>(blankVoucher);

  const countLabel = `${vouchers.length} voucher${vouchers.length === 1 ? "" : "s"} on this page`;

  const submitCreate = () => {
    startTransition(async () => {
      const result = await createMektekVoucher(createValue);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Voucher created");
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
      toast.success("Voucher updated");
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
      toast.success("Voucher deleted");
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">{countLabel}</p>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto">
              <Plus data-icon="inline-start" />
              Add voucher
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle>Add voucher</DialogTitle>
              <DialogDescription>
                Create a voucher code and choose who can redeem it.
              </DialogDescription>
            </DialogHeader>
            <VoucherForm
              value={createValue}
              customers={customers}
              onChange={setCreateValue}
              onSubmit={submitCreate}
              submitLabel="Create voucher"
              pending={isPending}
            />
          </DialogContent>
        </Dialog>
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
                  Min {voucher.minSubtotal > 0 ? formatCurrency(voucher.minSubtotal) : "none"}
                </p>
              </div>
              <div className="text-sm text-muted-foreground">
                <p>Starts: {formatDate(voucher.startsAt)}</p>
                <p>Ends: {formatDate(voucher.expiresAt)}</p>
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
                  aria-label={`Delete ${voucher.title}`}
                  className="shrink-0"
                >
                  <Trash2 />
                </Button>
              </div>
            </div>
          ))}
          {vouchers.length === 0 && (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              No vouchers match this filter.
            </div>
          )}
        </div>
      </div>

      <Dialog open={!!editingVoucher} onOpenChange={(open) => !open && setEditingVoucher(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Edit voucher</DialogTitle>
            <DialogDescription>
              Update the voucher code, discount, target, or availability.
            </DialogDescription>
          </DialogHeader>
          <VoucherForm
            value={editValue}
            customers={customers}
            onChange={setEditValue}
            onSubmit={submitEdit}
            submitLabel="Save changes"
            pending={isPending}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
