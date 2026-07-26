"use client";

import { useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronRight,
  Edit,
  Eye,
  EyeOff,
  Loader2,
  Mail,
  Plus,
  Shuffle,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import {
  createMektekCustomerUser,
  deleteMektekCustomerUser,
  updateMektekCustomerUser,
  type CustomerUserInput,
} from "@/actions/mektek/customers";
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
import { Switch } from "@/components/ui/switch";
import { generateRandomCustomerPassword } from "@/lib/mektek/customer-password-generator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type CustomerUserRow = {
  id: string;
  username: string;
  phone: string;
  phoneNormalized: string;
  customerType: "STANDARD" | "B2B";
  createdAt: string;
  updatedAt: string;
  serviceCount: number;
  whatsappOptedOutAt: string | null;
  whatsappOptedOutSource: string | null;
  user: {
    id: string;
    name: string | null;
    email: string;
    emailIsPlaceholder: boolean;
    isAdmin: boolean;
    mektekRole: "CS" | "TECHNICIAN" | null;
    lastLoginAt: string | null;
  } | null;
};

type CustomerUserManagerProps = {
  customers: CustomerUserRow[];
  locale: string;
};

const blankCustomer: CustomerUserInput = {
  name: "",
  phone: "",
  customerType: "STANDARD",
  email: "",
  password: "",
  whatsappOptedOut: false,
};

function customerToInput(customer: CustomerUserRow): CustomerUserInput {
  return {
    name: customer.user?.name || customer.username,
    phone: customer.phone,
    customerType: customer.customerType,
    // Never show the synthesized <digits>@phone.nextcrm.local address as if it
    // were a real one — staff must see an empty field they can actually fill.
    email: customer.user?.emailIsPlaceholder ? "" : customer.user?.email ?? "",
    password: "",
    whatsappOptedOut: customer.whatsappOptedOutAt !== null,
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

function formatDate(value: string | null) {
  if (!value) return "Belum pernah";
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function roleLabel(customer: CustomerUserRow) {
  if (!customer.user) return "Belum ada Login";
  if (customer.user.isAdmin) return "Admin";
  if (customer.user.mektekRole === "CS") return "CS";
  if (customer.user.mektekRole === "TECHNICIAN") return "Technician";
  return "Customer";
}

function typeLabel(customerType: CustomerUserRow["customerType"]) {
  return customerType === "B2B" ? "Perusahaan" : "Standard";
}

function CustomerUserForm({
  value,
  onChange,
  onSubmit,
  submitLabel,
  pending,
  isEdit,
  optOutSource,
}: {
  value: CustomerUserInput;
  onChange: (value: CustomerUserInput) => void;
  onSubmit: () => void;
  submitLabel: string;
  pending: boolean;
  isEdit?: boolean;
  optOutSource?: string | null;
}) {
  const [showPassword, setShowPassword] = useState(false);
  const hasRealEmail = (value.email ?? "").trim().length > 0;
  const update = (key: keyof CustomerUserInput, nextValue: string | boolean) => {
    onChange({ ...value, [key]: nextValue });
  };

  const randomizePassword = () => {
    update("password", generateRandomCustomerPassword());
    setShowPassword(true);
    toast.success("Password acak dibuat");
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
        <Field label="Customer name">
          <Input
            value={value.name}
            onChange={(event) => update("name", event.target.value)}
            disabled={pending}
            required
          />
        </Field>
        <Field label="Phone">
          <Input
            value={value.phone}
            onChange={(event) => update("phone", event.target.value)}
            disabled={pending}
            required
          />
        </Field>
        <Field label="Customer type">
          <Select
            value={value.customerType ?? "STANDARD"}
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
        <Field label={isEdit ? "New password" : "Password"}>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Input
                type={showPassword ? "text" : "password"}
                value={value.password ?? ""}
                onChange={(event) => update("password", event.target.value)}
                disabled={pending}
                autoComplete="new-password"
                className="pr-10 font-mono"
                placeholder={
                  isEdit
                    ? "Kosongkan untuk mempertahankan Password saat ini"
                    : "Opsional"
                }
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0"
                onClick={() => setShowPassword((current) => !current)}
                disabled={pending || !value.password}
                aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
              >
                {showPassword ? <EyeOff /> : <Eye />}
              </Button>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={randomizePassword}
              disabled={pending}
            >
              <Shuffle data-icon="inline-start" />
              Randomize
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Password acak berisi huruf besar, huruf kecil, angka, dan simbol.
          </p>
        </Field>
      </div>

      <div className="flex flex-col gap-4 rounded-lg border border-amber-300/70 bg-amber-50/60 p-4 dark:border-amber-500/30 dark:bg-amber-500/5">
        <div className="flex flex-col gap-1.5">
          <Label
            htmlFor="customer-email"
            className="flex items-center gap-2 text-sm font-semibold"
          >
            <Mail className="size-4" />
            Email Customer
          </Label>
          <Input
            id="customer-email"
            type="email"
            value={value.email ?? ""}
            onChange={(event) => update("email", event.target.value)}
            disabled={pending}
            placeholder="nama@domain.com"
            className="bg-background"
          />
          <p className="text-xs text-muted-foreground">
            Isi email asli Customer. Tanpa email asli, sistem hanya membuat alamat
            internal dari nomor telepon, sehingga Customer <strong>tidak dapat
            menerima promosi, penawaran, maupun email apa pun</strong> dari Mektek.
            Minta izin Customer terlebih dahulu sebelum mengisinya.
          </p>
          {isEdit && !hasRealEmail && (
            <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
              Customer ini belum punya email asli dan belum dapat dihubungi lewat
              email.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2 border-t border-amber-300/50 pt-3 dark:border-amber-500/20">
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              <Label htmlFor="customer-wa-optout" className="text-sm font-semibold">
                Jangan hubungi via WhatsApp
              </Label>
              <p className="text-xs text-muted-foreground">
                Aktifkan bila Customer meminta berhenti menerima pesan WhatsApp.
                Notifikasi WhatsApp tidak akan dikirim ke nomor ini.
              </p>
            </div>
            <Switch
              id="customer-wa-optout"
              checked={value.whatsappOptedOut === true}
              onCheckedChange={(checked) => update("whatsappOptedOut", checked)}
              disabled={pending}
              aria-label="Jangan hubungi via WhatsApp"
            />
          </div>
          {optOutSource === "customer" && value.whatsappOptedOut && (
            <p className="text-xs text-muted-foreground">
              Penolakan ini diminta langsung oleh Customer.
            </p>
          )}
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

export default function CustomerUserManager({
  customers,
  locale,
}: CustomerUserManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [createOpen, setCreateOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<CustomerUserRow | null>(null);
  const [createValue, setCreateValue] = useState<CustomerUserInput>(blankCustomer);
  const [editValue, setEditValue] = useState<CustomerUserInput>(blankCustomer);

  const countLabel = `${customers.length} Customer di halaman ini`;

  const submitCreate = () => {
    startTransition(async () => {
      const result = await createMektekCustomerUser(createValue);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Customer berhasil dibuat");
      setCreateValue(blankCustomer);
      setCreateOpen(false);
      router.refresh();
    });
  };

  const openEdit = (customer: CustomerUserRow) => {
    setEditingCustomer(customer);
    setEditValue(customerToInput(customer));
  };

  const submitEdit = () => {
    if (!editingCustomer) return;
    startTransition(async () => {
      const result = await updateMektekCustomerUser(editingCustomer.id, editValue);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Customer berhasil diperbarui");
      setEditingCustomer(null);
      router.refresh();
    });
  };

  const deleteCustomer = (customer: CustomerUserRow) => {
    startTransition(async () => {
      const result = await deleteMektekCustomerUser(customer.id);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Customer berhasil dihapus");
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
              Tambah Customer
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Tambah Customer</DialogTitle>
              <DialogDescription>
                Buat Customer Profile dan User Account yang terhubung untuk akses Customer.
              </DialogDescription>
            </DialogHeader>
            <CustomerUserForm
              value={createValue}
              onChange={setCreateValue}
              onSubmit={submitCreate}
              submitLabel="Buat Customer"
              pending={isPending}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="overflow-hidden rounded-lg border">
        <div className="hidden grid-cols-[minmax(0,1.2fr)_minmax(160px,0.9fr)_minmax(128px,0.6fr)_minmax(120px,0.7fr)_128px] gap-4 border-b bg-muted/30 px-4 py-3 text-xs font-medium uppercase text-muted-foreground lg:grid">
          <span>Customer</span>
          <span>Account</span>
          <span>Role</span>
          <span>Activity</span>
          <span className="text-right">Actions</span>
        </div>
        <div className="divide-y">
          {customers.map((customer) => (
            <div
              key={customer.id}
              className="grid gap-3 px-4 py-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(160px,0.9fr)_minmax(128px,0.6fr)_minmax(120px,0.7fr)_128px] lg:items-center lg:gap-4"
            >
              <Link
                href={`/${locale}/mektek/customers/${customer.id}`}
                className="group -m-2 grid min-w-0 gap-3 rounded-md p-2 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:col-span-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(160px,0.9fr)_minmax(128px,0.6fr)_minmax(120px,0.7fr)] lg:items-center lg:gap-4"
                aria-label={`Lihat detail ${customer.user?.name || customer.username}`}
              >
                <div className="min-w-0">
                  <p className="truncate font-medium group-hover:underline">
                    {customer.user?.name || customer.username}
                  </p>
                  <p className="text-sm text-muted-foreground">{customer.phone}</p>
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm">
                    {!customer.user
                      ? "Belum ada Login Account"
                      : customer.user.emailIsPlaceholder
                        ? "Belum ada email asli"
                        : customer.user.email}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {customer.user ? "Customer Login" : "Belum ada Login terhubung"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">{typeLabel(customer.customerType)}</Badge>
                  <Badge variant={customer.user?.isAdmin ? "default" : "secondary"}>
                    {roleLabel(customer)}
                  </Badge>
                  {customer.whatsappOptedOutAt && (
                    <Badge variant="destructive">Tanpa WhatsApp</Badge>
                  )}
                </div>
                <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
                  <div>
                    <p>{customer.serviceCount} Service Order</p>
                    <p className="text-xs">
                      Login terakhir: {formatDate(customer.user?.lastLoginAt ?? null)}
                    </p>
                  </div>
                  <ChevronRight className="size-4 shrink-0 transition-transform group-hover:translate-x-0.5" />
                </div>
              </Link>
              <div className="flex flex-wrap justify-start gap-2 lg:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => openEdit(customer)}
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
                  onClick={() => deleteCustomer(customer)}
                  disabled={isPending}
                  aria-label={`Hapus ${customer.user?.name || customer.username}`}
                  className="shrink-0"
                >
                  <Trash2 />
                </Button>
              </div>
            </div>
          ))}
          {customers.length === 0 && (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              Tidak ada Customer yang cocok dengan Filter ini.
            </div>
          )}
        </div>
      </div>

      <Dialog open={!!editingCustomer} onOpenChange={(open) => !open && setEditingCustomer(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Customer</DialogTitle>
            <DialogDescription>
              Perubahan memperbarui Customer Profile dan User Account yang terhubung.
            </DialogDescription>
          </DialogHeader>
          <CustomerUserForm
            value={editValue}
            onChange={setEditValue}
            onSubmit={submitEdit}
            submitLabel="Simpan perubahan"
            pending={isPending}
            isEdit
            optOutSource={editingCustomer?.whatsappOptedOutSource ?? null}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
