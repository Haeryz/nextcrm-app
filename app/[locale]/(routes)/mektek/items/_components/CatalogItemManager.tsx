"use client";

import { useMemo, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Edit, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  createMektekCatalogItem,
  deleteMektekCatalogItem,
  updateMektekCatalogItem,
  type CatalogItemInput,
} from "@/actions/mektek/catalog-items";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type CatalogItemRow = {
  id: string;
  machine: string;
  rowNumber: number;
  illustration: string | null;
  imagePath: string | null;
  partNumber: string | null;
  catalogPartNumber: string | null;
  description: string;
  quantity: string | null;
  price: number | null;
  remark: string | null;
};

type CatalogItemManagerProps = {
  items: CatalogItemRow[];
};

const blankItem: CatalogItemInput = {
  machine: "",
  rowNumber: "",
  illustration: "",
  imagePath: "",
  partNumber: "",
  catalogPartNumber: "",
  description: "",
  quantity: "",
  price: "",
  remark: "",
};

function itemToInput(item: CatalogItemRow): CatalogItemInput {
  return {
    machine: item.machine,
    rowNumber: item.rowNumber,
    illustration: item.illustration ?? "",
    imagePath: item.imagePath ?? "",
    partNumber: item.partNumber ?? "",
    catalogPartNumber: item.catalogPartNumber ?? "",
    description: item.description,
    quantity: item.quantity ?? "",
    price: item.price ?? "",
    remark: item.remark ?? "",
  };
}

function formatPrice(price: number | null) {
  if (typeof price !== "number") return "No price";
  return price.toLocaleString("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  });
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

function CatalogItemForm({
  value,
  onChange,
  onSubmit,
  submitLabel,
  pending,
}: {
  value: CatalogItemInput;
  onChange: (value: CatalogItemInput) => void;
  onSubmit: () => void;
  submitLabel: string;
  pending: boolean;
}) {
  const update = (key: keyof CatalogItemInput, nextValue: string) => {
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
        <Field label="Machine">
          <Input
            value={value.machine}
            onChange={(event) => update("machine", event.target.value)}
            disabled={pending}
            required
          />
        </Field>
        <Field label="Excel row">
          <Input
            inputMode="numeric"
            value={String(value.rowNumber ?? "")}
            onChange={(event) => update("rowNumber", event.target.value)}
            disabled={pending}
          />
        </Field>
        <Field label="Part number">
          <Input
            value={value.partNumber ?? ""}
            onChange={(event) => update("partNumber", event.target.value)}
            disabled={pending}
          />
        </Field>
        <Field label="Catalogue part number">
          <Input
            value={value.catalogPartNumber ?? ""}
            onChange={(event) => update("catalogPartNumber", event.target.value)}
            disabled={pending}
          />
        </Field>
        <Field label="Quantity">
          <Input
            value={value.quantity ?? ""}
            onChange={(event) => update("quantity", event.target.value)}
            disabled={pending}
          />
        </Field>
        <Field label="Price">
          <Input
            inputMode="numeric"
            value={String(value.price ?? "")}
            onChange={(event) => update("price", event.target.value.replace(/\D/g, ""))}
            disabled={pending}
          />
        </Field>
      </div>

      <Field label="Description">
        <Textarea
          value={value.description}
          onChange={(event) => update("description", event.target.value)}
          disabled={pending}
          required
        />
      </Field>

      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Illustration">
          <Input
            value={value.illustration ?? ""}
            onChange={(event) => update("illustration", event.target.value)}
            disabled={pending}
          />
        </Field>
        <Field label="Image path">
          <Input
            placeholder="/catalog/images/example.jpeg"
            value={value.imagePath ?? ""}
            onChange={(event) => update("imagePath", event.target.value)}
            disabled={pending}
          />
        </Field>
      </div>

      <Field label="Remark">
        <Textarea
          value={value.remark ?? ""}
          onChange={(event) => update("remark", event.target.value)}
          disabled={pending}
        />
      </Field>

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 data-icon="inline-start" className="animate-spin" />}
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

export default function CatalogItemManager({ items }: CatalogItemManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [createOpen, setCreateOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CatalogItemRow | null>(null);
  const [createValue, setCreateValue] = useState<CatalogItemInput>(blankItem);
  const [editValue, setEditValue] = useState<CatalogItemInput>(blankItem);

  const itemCountLabel = useMemo(
    () => `${items.length} item${items.length === 1 ? "" : "s"} on this page`,
    [items.length]
  );

  const submitCreate = () => {
    startTransition(async () => {
      const result = await createMektekCatalogItem(createValue);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Catalog item created");
      setCreateValue(blankItem);
      setCreateOpen(false);
      router.refresh();
    });
  };

  const openEdit = (item: CatalogItemRow) => {
    setEditingItem(item);
    setEditValue(itemToInput(item));
  };

  const submitEdit = () => {
    if (!editingItem) return;
    startTransition(async () => {
      const result = await updateMektekCatalogItem(editingItem.id, editValue);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Catalog item updated");
      setEditingItem(null);
      router.refresh();
    });
  };

  const deleteItem = (item: CatalogItemRow) => {
    startTransition(async () => {
      const result = await deleteMektekCatalogItem(item.id);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Catalog item deleted");
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">{itemCountLabel}</p>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto">
              <Plus data-icon="inline-start" />
              Add item
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle>Add catalogue item</DialogTitle>
              <DialogDescription>
                Create a searchable item that can be shown to customers and added to service orders.
              </DialogDescription>
            </DialogHeader>
            <CatalogItemForm
              value={createValue}
              onChange={setCreateValue}
              onSubmit={submitCreate}
              submitLabel="Create item"
              pending={isPending}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="overflow-hidden rounded-lg border">
        <div className="hidden grid-cols-[72px_minmax(0,1.4fr)_minmax(120px,0.7fr)_minmax(120px,0.6fr)_128px] gap-4 border-b bg-muted/30 px-4 py-3 text-xs font-medium uppercase text-muted-foreground lg:grid">
          <span>Image</span>
          <span>Item</span>
          <span>Machine</span>
          <span>Part</span>
          <span className="text-right">Actions</span>
        </div>
        <div className="divide-y">
          {items.map((item) => (
            <div
              key={item.id}
              className="grid gap-3 px-4 py-4 lg:grid-cols-[72px_minmax(0,1.4fr)_minmax(120px,0.7fr)_minmax(120px,0.6fr)_128px] lg:items-center lg:gap-4"
            >
              <div className="size-16 overflow-hidden rounded-md border bg-muted">
                {item.imagePath ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.imagePath}
                    alt={item.description}
                    className="size-full object-cover"
                  />
                ) : (
                  <div className="flex size-full items-center justify-center text-xs text-muted-foreground">
                    No image
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate font-medium">{item.description}</p>
                <p className="text-sm text-muted-foreground">{formatPrice(item.price)}</p>
                {item.remark && (
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                    {item.remark}
                  </p>
                )}
              </div>
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <Badge variant="secondary" className="max-w-full whitespace-normal">
                  {item.machine}
                </Badge>
                <span className="text-xs text-muted-foreground">Row {item.rowNumber}</span>
              </div>
              <p className="truncate text-sm text-muted-foreground">
                {item.catalogPartNumber || item.partNumber || "No part number"}
              </p>
              <div className="flex flex-wrap justify-start gap-2 lg:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => openEdit(item)}
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
                  onClick={() => deleteItem(item)}
                  disabled={isPending}
                  aria-label={`Delete ${item.description}`}
                  className="shrink-0"
                >
                  <Trash2 />
                </Button>
              </div>
            </div>
          ))}
          {items.length === 0 && (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              No catalogue items match this filter.
            </div>
          )}
        </div>
      </div>

      <Dialog open={!!editingItem} onOpenChange={(open) => !open && setEditingItem(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Edit catalogue item</DialogTitle>
            <DialogDescription>
              Updates are available immediately in customer catalogue search and order intake.
            </DialogDescription>
          </DialogHeader>
          <CatalogItemForm
            value={editValue}
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
