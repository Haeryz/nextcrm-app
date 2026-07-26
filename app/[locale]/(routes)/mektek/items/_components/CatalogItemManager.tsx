"use client";

import { useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Edit,
  FileSpreadsheet,
  ImagePlus,
  Loader2,
  Plus,
  Trash2,
  X,
} from "lucide-react";
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
  spreadsheetHref: string;
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
    initialRearStock: String(item.rearStock),
    initialFrontStock: String(item.frontStock),
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
  stockMode,
}: {
  value: CatalogItemInput;
  onChange: (value: CatalogItemInput) => void;
  onSubmit: () => void;
  submitLabel: string;
  pending: boolean;
  imageSrc: string | null;
  imageDraft: ImageDraft;
  onImageDraftChange: (draft: ImageDraft) => void;
  stockMode: "initial" | "total";
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
      className="flex flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <fieldset className="space-y-4 rounded-lg border p-4">
        <legend className="px-2 text-sm font-semibold">Informasi Spare Part</legend>
        <p className="text-xs text-muted-foreground">
          Isi identitas utama agar spare part mudah ditemukan pada katalog dan receiving.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
        <Field label="Nama Spare Part">
          <Input
            aria-label="Item Name"
            value={value.itemName}
            onChange={(event) => update("itemName", event.target.value)}
            disabled={pending}
            required
          />
        </Field>
        <Field label="Mesin">
          <Input
            aria-label="Machine"
            value={value.machine}
            onChange={(event) => update("machine", event.target.value)}
            disabled={pending}
            required
          />
        </Field>
        <Field label="Nomor Part">
          <Input
            aria-label="Part Number"
            value={value.partNumber ?? ""}
            onChange={(event) => update("partNumber", event.target.value)}
            disabled={pending}
          />
        </Field>
        <Field label="Divisi Produksi">
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
        <Field label="Harga">
          <RupiahInput
            aria-label="Price in Rupiah"
            value={value.price}
            onValueChange={(nextValue) => update("price", nextValue)}
            disabled={pending}
          />
        </Field>
        <Field label="Catatan">
          <Input
            aria-label="Remark"
            value={value.remark ?? ""}
            onChange={(event) => update("remark", event.target.value)}
            disabled={pending}
          />
        </Field>
        </div>
      </fieldset>

      <fieldset className="space-y-4 rounded-lg border p-4">
        <legend className="px-2 text-sm font-semibold">Lokasi dan Unit Gudang</legend>
        <p className="text-xs text-muted-foreground">
          {stockMode === "initial"
            ? "Tentukan jumlah awal di setiap gudang. Nilai ini menjadi saldo awal stok."
            : "Jumlah saat ini sudah mencakup receiving yang telah selesai. Perubahan akan dicatat sebagai koreksi stok."}
        </p>
        <div className="grid gap-4 md:grid-cols-2">
            <Field label="Lokasi Gudang Belakang">
              <Input
                aria-label="Lokasi Gudang Belakang"
                value={value.rearLocation ?? ""}
                onChange={(event) => update("rearLocation", event.target.value)}
                disabled={pending}
                placeholder="Contoh: 002C0601"
              />
            </Field>
            <Field label="Lokasi Gudang Depan">
              <Input
                aria-label="Lokasi Gudang Depan"
                value={value.frontLocation ?? ""}
                onChange={(event) => update("frontLocation", event.target.value)}
                disabled={pending}
                placeholder="Contoh: 002D0203"
              />
            </Field>
            <Field
              label={
                stockMode === "initial"
                  ? "Stok Awal G. Belakang"
                  : "Total Unit Gudang Belakang"
              }
            >
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
            <Field
              label={
                stockMode === "initial"
                  ? "Stok Awal G. Depan"
                  : "Total Unit Gudang Depan"
              }
            >
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
        </div>
      </fieldset>

      <Field label="Foto Katalog">
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
              capture="environment"
              onChange={(event) => selectImage(event.target.files?.[0] ?? null)}
              disabled={pending}
              aria-label="Ambil atau pilih Catalogue Image dari perangkat"
            />
            <p className="text-xs text-muted-foreground">
              Di HP akan membuka kamera; di PC pilih file JPEG, PNG, WebP, atau
              GIF (maksimal 4 MB).
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

      <div className="flex justify-end border-t pt-4">
        <Button type="submit" disabled={pending} className="w-full sm:w-auto">
          {pending && <Loader2 data-icon="inline-start" className="animate-spin" />}
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

export default function CatalogItemManager({
  items,
  spreadsheetHref,
}: CatalogItemManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [createOpen, setCreateOpen] = useState(false);
  const [createValue, setCreateValue] = useState<CatalogItemInput>(blankItem);
  const [createImage, setCreateImage] = useState<ImageDraft>(blankImageDraft);
  const [editingItem, setEditingItem] = useState<CatalogItemRow | null>(null);
  const [editValue, setEditValue] = useState<CatalogItemInput>(blankItem);
  const [editImage, setEditImage] = useState<ImageDraft>(blankImageDraft);

  const itemCountLabel = `${items.length} item di halaman ini`;

  const openCreate = () => {
    setCreateValue(blankItem);
    setCreateImage(blankImageDraft);
    setCreateOpen(true);
  };

  const submitCreate = () => {
    startTransition(async () => {
      const result = await createMektekCatalogItem(createValue);
      if (result?.error || !result?.data) {
        toast.error(result?.error || "Gagal menambahkan Spare Part");
        return;
      }
      try {
        await updateCatalogImage(result.data.id, createImage);
      } catch (error) {
        toast.warning(
          error instanceof Error
            ? `Spare Part tersimpan, tetapi foto gagal diunggah: ${error.message}`
            : "Spare Part tersimpan, tetapi foto gagal diunggah",
        );
      }
      toast.success("Spare Part berhasil ditambahkan ke Catalog / Item");
      setCreateOpen(false);
      setCreateValue(blankItem);
      setCreateImage(blankImageDraft);
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
        <div className="flex w-full gap-2 sm:w-auto">
          <Button
            type="button"
            className="min-w-0 flex-1 sm:flex-none"
            onClick={openCreate}
            disabled={isPending}
          >
            <Plus data-icon="inline-start" />
            Tambah Spare Part
          </Button>
          <Button asChild variant="outline" className="min-w-0 flex-1 sm:flex-none">
            <Link href={spreadsheetHref}>
              <FileSpreadsheet data-icon="inline-start" />
              <span className="sm:hidden">Spreadsheet</span>
              <span className="hidden sm:inline">Buka Spreadsheet Inventory</span>
            </Link>
          </Button>
        </div>
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
            <div className="flex flex-col items-center gap-3 px-4 py-12 text-center">
              <ImagePlus className="size-8 text-muted-foreground" aria-hidden="true" />
              <div>
                <p className="text-sm font-medium">Belum ada Catalogue Item</p>
                <p className="text-xs text-muted-foreground">
                  Tambahkan spare part pertama untuk mulai mengelola stok.
                </p>
              </div>
              <Button type="button" size="sm" onClick={openCreate} disabled={isPending}>
                <Plus data-icon="inline-start" />
                Tambah Spare Part
              </Button>
            </div>
          )}
        </div>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Tambah Spare Part</DialogTitle>
            <DialogDescription>
              Tambahkan item manual beserta stok awal dan foto agar dapat
              langsung digunakan oleh Receiving dan Monitoring PO.
            </DialogDescription>
          </DialogHeader>
          <CatalogItemForm
            value={createValue}
            onChange={setCreateValue}
            onSubmit={submitCreate}
            submitLabel="Simpan Spare Part"
            pending={isPending}
            imageSrc={null}
            imageDraft={createImage}
            onImageDraftChange={setCreateImage}
            stockMode="initial"
          />
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingItem} onOpenChange={(open) => !open && setEditingItem(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Edit Spare Part</DialogTitle>
            <DialogDescription>
              Perbarui informasi, lokasi, dan total unit. Jumlah unit saat ini
              sudah termasuk receiving yang telah selesai.
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
            stockMode="total"
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
