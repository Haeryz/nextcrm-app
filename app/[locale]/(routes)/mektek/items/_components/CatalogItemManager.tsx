"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Edit, ImagePlus, Loader2, Plus, Trash2, X } from "lucide-react";
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
import { CatalogImage } from "@/components/mektek/CatalogImage";

type CatalogItemRow = {
  id: string;
  machine: string;
  imagePath: string | null;
  partNumber: string | null;
  description: string;
  quantity: string | null;
  price: number | null;
};

type CatalogItemManagerProps = {
  items: CatalogItemRow[];
};

const blankItem: CatalogItemInput = {
  machine: "",
  partNumber: "",
  description: "",
  quantity: "",
  price: "",
};

type ImageDraft = {
  file: File | null;
  preview: string | null;
  removeExisting: boolean;
  error: string | null;
};

const blankImageDraft: ImageDraft = {
  file: null,
  preview: null,
  removeExisting: false,
  error: null,
};

function itemToInput(item: CatalogItemRow): CatalogItemInput {
  return {
    machine: item.machine,
    partNumber: item.partNumber ?? "",
    description: item.description,
    quantity: item.quantity ?? "",
    price: item.price ?? "",
  };
}

async function updateCatalogImage(itemId: string, draft: ImageDraft) {
  const path = `/api/mektek/catalog-items/${encodeURIComponent(itemId)}/image`;
  if (!draft.file && !draft.removeExisting) return;

  const response = await fetch(path, {
    method: draft.file ? "PUT" : "DELETE",
    ...(draft.file
      ? {
          body: draft.file,
          headers: { "Content-Type": draft.file.type },
        }
      : {}),
  });
  const payload = (await response.json().catch(() => null)) as
    | { error?: string }
    | null;
  if (!response.ok) {
    throw new Error(payload?.error || "Failed to update catalogue image");
  }
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
  imageSrc,
  imageDraft,
  onImageDraftChange,
}: {
  value: CatalogItemInput;
  onChange: (value: CatalogItemInput) => void;
  onSubmit: () => void;
  submitLabel: string;
  pending: boolean;
  imageSrc: string | null;
  imageDraft: ImageDraft;
  onImageDraftChange: (draft: ImageDraft) => void;
}) {
  const update = (key: keyof CatalogItemInput, nextValue: string) => {
    onChange({ ...value, [key]: nextValue });
  };

  const selectImage = (file: File | null) => {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)) {
      onImageDraftChange({
        ...blankImageDraft,
        error: "Choose a JPEG, PNG, WebP, or GIF image",
      });
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      onImageDraftChange({
        ...blankImageDraft,
        error: "Catalogue images must be 4 MB or smaller",
      });
      return;
    }

    const reader = new FileReader();
    reader.addEventListener("load", () => {
      onImageDraftChange({
        file,
        preview: typeof reader.result === "string" ? reader.result : null,
        removeExisting: false,
        error: null,
      });
    });
    reader.readAsDataURL(file);
  };

  const displayedImage = imageDraft.preview ||
    (imageDraft.removeExisting ? null : imageSrc);

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
        <Field label="Part number">
          <Input
            value={value.partNumber ?? ""}
            onChange={(event) => update("partNumber", event.target.value)}
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

      <Field label="Catalogue image">
        <div className="flex flex-col gap-3 rounded-lg border bg-muted/20 p-3 sm:flex-row sm:items-center">
          <div className="flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-background">
            {displayedImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={displayedImage}
                alt="Catalogue preview"
                className="size-full object-cover"
              />
            ) : (
              <ImagePlus className="size-7 text-muted-foreground" aria-hidden="true" />
            )}
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <Input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={(event) => selectImage(event.target.files?.[0] ?? null)}
              disabled={pending}
              aria-label="Choose catalogue image from device"
            />
            <p className="text-xs text-muted-foreground">
              Choose a JPEG, PNG, WebP, or GIF from your device (maximum 4 MB).
            </p>
            {imageDraft.error && (
              <p className="text-xs text-destructive" role="alert">
                {imageDraft.error}
              </p>
            )}
            {displayedImage && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={pending}
                onClick={() =>
                  onImageDraftChange({
                    ...blankImageDraft,
                    removeExisting: Boolean(imageSrc),
                  })
                }
              >
                <X data-icon="inline-start" />
                Remove image
              </Button>
            )}
          </div>
        </div>
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
  const [createImage, setCreateImage] = useState<ImageDraft>(blankImageDraft);
  const [editImage, setEditImage] = useState<ImageDraft>(blankImageDraft);

  const itemCountLabel = `${items.length} item${items.length === 1 ? "" : "s"} on this page`;

  const submitCreate = () => {
    startTransition(async () => {
      const result = await createMektekCatalogItem(createValue);
      if (!result || "error" in result) {
        toast.error(result?.error || "Failed to create catalogue item");
        return;
      }
      try {
        await updateCatalogImage(result.data.id, createImage);
      } catch (error) {
        toast.error(
          error instanceof Error
            ? `Item created, but the image was not saved: ${error.message}`
            : "Item created, but the image was not saved",
        );
        setCreateValue(blankItem);
        setCreateImage(blankImageDraft);
        setCreateOpen(false);
        router.refresh();
        return;
      }
      toast.success("Catalog item created");
      setCreateValue(blankItem);
      setCreateImage(blankImageDraft);
      setCreateOpen(false);
      router.refresh();
    });
  };

  const openEdit = (item: CatalogItemRow) => {
    setEditingItem(item);
    setEditValue(itemToInput(item));
    setEditImage(blankImageDraft);
  };

  const submitEdit = () => {
    if (!editingItem) return;
    startTransition(async () => {
      const result = await updateMektekCatalogItem(editingItem.id, editValue);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      try {
        await updateCatalogImage(editingItem.id, editImage);
      } catch (error) {
        toast.error(
          error instanceof Error
            ? `Item changes were saved, but the image was not updated: ${error.message}`
            : "Item changes were saved, but the image was not updated",
        );
        router.refresh();
        return;
      }
      toast.success("Catalog item updated");
      setEditingItem(null);
      setEditImage(blankImageDraft);
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
              imageSrc={null}
              imageDraft={createImage}
              onImageDraftChange={setCreateImage}
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
                <CatalogImage src={item.imagePath} alt={item.description} />
              </div>
              <div className="min-w-0">
                <p className="truncate font-medium">{item.description}</p>
                <p className="text-sm text-muted-foreground">{formatPrice(item.price)}</p>
              </div>
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <Badge variant="secondary" className="max-w-full whitespace-normal">
                  {item.machine}
                </Badge>
              </div>
              <p className="truncate text-sm text-muted-foreground">
                {item.partNumber || "No part number"}
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
            imageSrc={editingItem?.imagePath ?? null}
            imageDraft={editImage}
            onImageDraftChange={setEditImage}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
