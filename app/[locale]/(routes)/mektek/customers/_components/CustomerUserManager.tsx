"use client";

import { useMemo, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Edit, Loader2, Plus, Trash2 } from "lucide-react";
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
  user: {
    id: string;
    name: string | null;
    email: string;
    userStatus: "ACTIVE" | "PENDING" | "INACTIVE";
    userLanguage: "cz" | "en" | "de" | "uk";
    isAdmin: boolean;
    mektekRole: "CS" | "TECHNICIAN" | null;
    lastLoginAt: string | null;
  } | null;
};

type CustomerUserManagerProps = {
  customers: CustomerUserRow[];
};

const blankCustomer: CustomerUserInput = {
  name: "",
  phone: "",
  customerType: "STANDARD",
  email: "",
  password: "",
  userStatus: "ACTIVE",
  userLanguage: "en",
};

function customerToInput(customer: CustomerUserRow): CustomerUserInput {
  return {
    name: customer.user?.name || customer.username,
    phone: customer.phone,
    customerType: customer.customerType,
    email: customer.user?.email ?? "",
    password: "",
    userStatus: customer.user?.userStatus ?? "ACTIVE",
    userLanguage: customer.user?.userLanguage ?? "en",
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
  if (!value) return "Never";
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function roleLabel(customer: CustomerUserRow) {
  if (!customer.user) return "No login";
  if (customer.user.isAdmin) return "Admin";
  if (customer.user.mektekRole === "CS") return "CS";
  if (customer.user.mektekRole === "TECHNICIAN") return "Technician";
  return "Customer";
}

function typeLabel(customerType: CustomerUserRow["customerType"]) {
  return customerType === "B2B" ? "B2B" : "Standard";
}

function CustomerUserForm({
  value,
  onChange,
  onSubmit,
  submitLabel,
  pending,
  isEdit,
}: {
  value: CustomerUserInput;
  onChange: (value: CustomerUserInput) => void;
  onSubmit: () => void;
  submitLabel: string;
  pending: boolean;
  isEdit?: boolean;
}) {
  const update = (key: keyof CustomerUserInput, nextValue: string | boolean) => {
    onChange({ ...value, [key]: nextValue });
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
              <SelectItem value="STANDARD">Standard customer</SelectItem>
              <SelectItem value="B2B">B2B customer</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Email">
          <Input
            type="email"
            value={value.email ?? ""}
            onChange={(event) => update("email", event.target.value)}
            disabled={pending}
            placeholder="Generated from phone if blank"
          />
        </Field>
        <Field label={isEdit ? "New password" : "Password"}>
          <Input
            type="password"
            value={value.password ?? ""}
            onChange={(event) => update("password", event.target.value)}
            disabled={pending}
            placeholder={isEdit ? "Leave blank to keep current" : "Optional"}
          />
        </Field>
        <Field label="Status">
          <Select
            value={value.userStatus ?? "ACTIVE"}
            onValueChange={(nextValue) => update("userStatus", nextValue)}
            disabled={pending}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="PENDING">Pending</SelectItem>
              <SelectItem value="INACTIVE">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Language">
          <Select
            value={value.userLanguage ?? "en"}
            onValueChange={(nextValue) => update("userLanguage", nextValue)}
            disabled={pending}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="en">English</SelectItem>
              <SelectItem value="de">German</SelectItem>
              <SelectItem value="cz">Czech</SelectItem>
              <SelectItem value="uk">Ukrainian</SelectItem>
            </SelectContent>
          </Select>
        </Field>
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

export default function CustomerUserManager({ customers }: CustomerUserManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [createOpen, setCreateOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<CustomerUserRow | null>(null);
  const [createValue, setCreateValue] = useState<CustomerUserInput>(blankCustomer);
  const [editValue, setEditValue] = useState<CustomerUserInput>(blankCustomer);

  const countLabel = useMemo(
    () => `${customers.length} customer${customers.length === 1 ? "" : "s"} on this page`,
    [customers.length]
  );

  const submitCreate = () => {
    startTransition(async () => {
      const result = await createMektekCustomerUser(createValue);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Customer created");
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
      toast.success("Customer updated");
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
      toast.success("Customer deleted");
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
              Add customer
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add customer</DialogTitle>
              <DialogDescription>
                Create a customer profile and a linked user account for customer access.
              </DialogDescription>
            </DialogHeader>
            <CustomerUserForm
              value={createValue}
              onChange={setCreateValue}
              onSubmit={submitCreate}
              submitLabel="Create customer"
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
              <div className="min-w-0">
                <p className="truncate font-medium">
                  {customer.user?.name || customer.username}
                </p>
                <p className="text-sm text-muted-foreground">{customer.phone}</p>
                <p className="text-xs text-muted-foreground">
                  Normalized: {customer.phoneNormalized}
                </p>
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm">{customer.user?.email ?? "No login account"}</p>
                <div className="mt-1 flex flex-wrap gap-2">
                  <Badge variant={customer.user?.userStatus === "ACTIVE" ? "default" : "secondary"}>
                    {customer.user?.userStatus ?? "UNLINKED"}
                  </Badge>
                  {customer.user && (
                    <Badge variant="outline">{customer.user.userLanguage.toUpperCase()}</Badge>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">{typeLabel(customer.customerType)}</Badge>
                <Badge variant={customer.user?.isAdmin ? "default" : "secondary"}>
                  {roleLabel(customer)}
                </Badge>
              </div>
              <div className="text-sm text-muted-foreground">
                <p>{customer.serviceCount} service orders</p>
                <p className="text-xs">Last login: {formatDate(customer.user?.lastLoginAt ?? null)}</p>
              </div>
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
                  aria-label={`Delete ${customer.user?.name || customer.username}`}
                  className="shrink-0"
                >
                  <Trash2 />
                </Button>
              </div>
            </div>
          ))}
          {customers.length === 0 && (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              No customers match this filter.
            </div>
          )}
        </div>
      </div>

      <Dialog open={!!editingCustomer} onOpenChange={(open) => !open && setEditingCustomer(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit customer</DialogTitle>
            <DialogDescription>
              Changes update both the customer profile and linked user account.
            </DialogDescription>
          </DialogHeader>
          <CustomerUserForm
            value={editValue}
            onChange={setEditValue}
            onSubmit={submitEdit}
            submitLabel="Save changes"
            pending={isPending}
            isEdit
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
