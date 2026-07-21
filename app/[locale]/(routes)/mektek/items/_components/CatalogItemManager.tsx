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
import { CatalogImage } from "@/components/mektek/CatalogImage";
import { RupiahInput } from "@/components/mektek/RupiahInput";
import { getCatalogProductionChannelLabel } from "@/lib/mektek/catalog-inventory";

type CatalogItemRow = {
  id: string;
  machine: string;
  imagePath: string | null;
  partNumber: string | null;
  description: string;
  price: number | null;
  productionChannel: "POWERTRAIN" | "THERMAL" | null;
  rearLocation: string | null;
  frontLocation: string | null;
  rearStock: number;
  frontStock: number;
  remark: string | null;
};

type CatalogItemManagerProps = {
  items: CatalogItemRow[];
};

const blankItem: CatalogItemInput = {
  itemName: "",
  machine: "",
  partNumber: "",
  price: "",
  productionChannel: "",
  rearLocation: "",
  frontLocation: "",
  remark: "",
  initialRearStock: "",
  initialFrontStock: "",
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
    itemName: item.description,
    machine: item.machine,
    partNumber: item.partNumber ?? "",
    price: item.price ?? "",
    productionChannel: item.productionChannel ?? "",
    rearLocation: item.rearLocation ?? "",
    frontLocation: item.frontLocation ?? "",
    remark: item.remark ?? "",
    initialRearStock: "",
    initialFrontStock: "",
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
    throw new Error(payload?.error || "Gagal memperbarui Catalogue Image");
  }
}

function formatPrice(price: number | null) {
  if (typeof price !== "number") return "Harga belum tersedia";
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
  showInitialStock,
}: {
  value: CatalogItemInput;
  onChange: (value: CatalogItemInput) => void;
  onSubmit: () => void;
  submitLabel: string;
  pending: boolean;
  imageSrc: string | null;
  imageDraft: ImageDraft;
  onImageDraftChange: (draft: ImageDraft) => void;
  showInitialStock: boolean;
}) {
  const update = (key: keyof CatalogItemInput, nextValue: string) => {
    onChange({ ...value, [key]: nextValue });
  };

  const selectImage = (file: File | null) => {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)) {
      onImageDraftChange({
        ...blankImageDraft,
        error: "Pilih image JPEG, PNG, WebP, atau GIF",
      });
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      onImageDraftChange({
        ...blankImageDraft,
        error: "Ukuran Catalogue Image maksimal 4 MB",
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
        <Field label="Item Name">
          <Input
            aria-label="Item Name"
            value={value.itemName}
            onChange={(event) => update("itemName", event.target.value)}
            disabled={pending}
            required
          />
        </Field>
        <Field label="Machine">
          <Input
            aria-label="Machine"
            value={value.machine}
            onChange={(event) => update("machine", event.target.value)}
            disabled={pending}
            required
          />
        </Field>
        <Field label="Part Number">
          <Input
            aria-label="Part Number"
            value={value.partNumber ?? ""}
            onChange={(event) => update("partNumber", event.target.value)}
            disabled={pending}
          />
        </Field>
        <Field label="Production Channel">
          <Select
            value={value.productionChannel || "NONE"}
            onValueChange={(nextValue) =>
              update(
                "productionChannel",
                nextValue === "NONE" ? "" : nextValue,
              )
            }
            disabled={pending}
          >
            <SelectTrigger aria-label="Production Channel">
              <SelectValue placeholder="Bisa dikosongi" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="NONE">Tidak diatur</SelectItem>
              <SelectItem value="POWERTRAIN">Powertrain</SelectItem>
              <SelectItem value="THERMAL">Thermal</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Price">
          <RupiahInput
            aria-label="Price in Rupiah"
            value={value.price}
            onValueChange={(nextValue) => update("price", nextValue)}
            disabled={pending}
          />
        </Field>
        <Field label="Lokasi G. Belakang">
          <Input
            aria-label="Lokasi Gudang Belakang"
            value={value.rearLocation ?? ""}
            onChange={(event) => update("rearLocation", event.target.value)}
            disabled={pending}
            placeholder="Contoh: 002C0601"
          />
        </Field>
        <Field label="Lokasi G. Depan">
          <Input
            aria-label="Lokasi Gudang Depan"
            value={value.frontLocation ?? ""}
            onChange={(event) => update("frontLocation", event.target.value)}
            disabled={pending}
            placeholder="Contoh: 002D0203"
          />
        </Field>
        <Field label="Remark">
          <Input
            aria-label="Remark"
            value={value.remark ?? ""}
            onChange={(event) => update("remark", event.target.value)}
            disabled={pending}
          />
        </Field>
        {showInitialStock && (
          <>
            <Field label="Stok Awal G. Belakang">
              <Input
                aria-label="Stok Awal Gudang Belakang"
                inputMode="numeric"
                value={value.initialRearStock ?? ""}
                onChange={(event) =>
                  update("initialRearStock", event.target.value.replace(/\D/g, ""))
                }
                disabled={pending}
                placeholder="0"
              />
            </Field>
            <Field label="Stok Awal G. Depan">
              <Input
                aria-label="Stok Awal Gudang Depan"
                inputMode="numeric"
                value={value.initialFrontStock ?? ""}
                onChange={(event) =>
                  update("initialFrontStock", event.target.value.replace(/\D/g, ""))
                }
                disabled={pending}
                placeholder="0"
              />
            </Field>
          </>
        )}
      </div>

      <Field label="Catalogue Image">
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
              aria-label="Pilih Catalogue Image dari perangkat"
            />
            <p className="text-xs text-muted-foreground">
              Pilih JPEG, PNG, WebP, atau GIF dari perangkat Anda (maksimal 4 MB).
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
                Hapus image
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

  const itemCountLabel = `${items.length} item di halaman ini`;

  const submitCreate = () => {
    startTransition(async () => {
      const result = await createMektekCatalogItem(createValue);
      if (!result || "error" in result) {
        toast.error(result?.error || "Gagal membuat Catalogue Item");
        return;
      }
      try {
        await updateCatalogImage(result.data.id, createImage);
      } catch (error) {
        toast.error(
          error instanceof Error
            ? `Item berhasil dibuat, tetapi image tidak tersimpan: ${error.message}`
            : "Item berhasil dibuat, tetapi image tidak tersimpan",
        );
        setCreateValue(blankItem);
        setCreateImage(blankImageDraft);
        setCreateOpen(false);
        router.refresh();
        return;
      }
      toast.success("Catalogue Item berhasil dibuat");
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
            ? `Perubahan item tersimpan, tetapi image tidak diperbarui: ${error.message}`
            : "Perubahan item tersimpan, tetapi image tidak diperbarui",
        );
        router.refresh();
        return;
      }
      toast.success("Catalogue Item berhasil diperbarui");
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
      toast.success("Catalogue Item berhasil dihapus");
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
              Tambah Spare Part
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle>Tambah Spare Part</DialogTitle>
              <DialogDescription>
                Simpan identitas item, Production Channel, lokasi, dan stok awal kedua gudang.
              </DialogDescription>
            </DialogHeader>
            <CatalogItemForm
              value={createValue}
              onChange={setCreateValue}
              onSubmit={submitCreate}
              submitLabel="Buat item"
              pending={isPending}
              imageSrc={null}
              imageDraft={createImage}
              onImageDraftChange={setCreateImage}
              showInitialStock
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="overflow-hidden rounded-lg border">
        <div className="hidden grid-cols-[72px_minmax(0,1.2fr)_120px_minmax(140px,0.8fr)_minmax(130px,0.7fr)_minmax(130px,0.7fr)_128px] gap-4 border-b bg-muted/30 px-4 py-3 text-xs font-medium uppercase text-muted-foreground xl:grid">
          <span>Image</span>
          <span>Item</span>
          <span>Channel</span>
          <span>Machine / Part</span>
          <span>G. Belakang</span>
          <span>G. Depan</span>
          <span className="text-right">Actions</span>
        </div>
        <div className="divide-y">
          {items.map((item) => (
            <div
              key={item.id}
              className="grid gap-3 px-4 py-4 xl:grid-cols-[72px_minmax(0,1.2fr)_120px_minmax(140px,0.8fr)_minmax(130px,0.7fr)_minmax(130px,0.7fr)_128px] xl:items-center xl:gap-4"
            >
              <div className="size-16 overflow-hidden rounded-md border bg-muted">
                <CatalogImage src={item.imagePath} alt={item.description} />
              </div>
              <div className="min-w-0">
                <p className="truncate font-medium">{item.description}</p>
                <p className="text-sm text-muted-foreground">{formatPrice(item.price)}</p>
              </div>
              <div>
                <Badge variant={item.productionChannel ? "secondary" : "outline"}>
                  {getCatalogProductionChannelLabel(item.productionChannel) || "Belum diatur"}
                </Badge>
              </div>
              <div className="min-w-0 text-sm">
                <p className="truncate font-medium">{item.machine}</p>
                <p className="truncate text-muted-foreground">
                  {item.partNumber || "Part Number belum tersedia"}
                </p>
              </div>
              <div className="text-sm">
                <p className="font-semibold tabular-nums">{item.rearStock} unit</p>
                <p className="truncate text-xs text-muted-foreground">
                  {item.rearLocation || "Lokasi belum diatur"}
                </p>
              </div>
              <div className="text-sm">
                <p className="font-semibold tabular-nums">{item.frontStock} unit</p>
                <p className="truncate text-xs text-muted-foreground">
                  {item.frontLocation || "Lokasi belum diatur"}
                </p>
              </div>
              <div className="flex flex-wrap justify-start gap-2 xl:justify-end">
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
                  aria-label={`Hapus ${item.description}`}
                  className="shrink-0"
                >
                  <Trash2 />
                </Button>
              </div>
            </div>
          ))}
          {items.length === 0 && (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              Tidak ada Catalogue Item yang cocok dengan Filter ini.
            </div>
          )}
        </div>
      </div>

      <Dialog open={!!editingItem} onOpenChange={(open) => !open && setEditingItem(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Edit Catalogue Item</DialogTitle>
            <DialogDescription>
              Perubahan langsung tersedia pada pencarian customer catalogue dan penerimaan order.
            </DialogDescription>
          </DialogHeader>
          <CatalogItemForm
            value={editValue}
            onChange={setEditValue}
            onSubmit={submitEdit}
            submitLabel="Simpan perubahan"
            pending={isPending}
            imageSrc={editingItem?.imagePath ?? null}
            imageDraft={editImage}
            onImageDraftChange={setEditImage}
            showInitialStock={false}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
