"use client";

import { useEffect, useId, useState, useTransition } from "react";
import { Minus, PackageSearch, Plus, Trash2, Wrench } from "lucide-react";

import { searchMektekCatalogItems } from "@/actions/mektek/service-orders";
import { RupiahInput } from "@/components/mektek/RupiahInput";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { mergeMektekLineItemInputs, parseMoney } from "@/lib/mektek/items";

export type DamageItem = {
  clientId?: string;
  description: string;
  estimatedCost: string;
  quantity?: number;
  catalogItemId?: string;
  machine?: string;
  partNumber?: string;
  catalogPartNumber?: string;
  stockWarehouse?: "FRONT" | "REAR";
  frontStock?: number;
  rearStock?: number;
};

interface DamageItemsInputProps {
  items: DamageItem[];
  onChange: (items: DamageItem[]) => void;
  label?: string;
  helperText?: string;
  itemLabel?: string;
  descriptionLabel?: string;
  addLabel?: string;
  emptyMessage?: string;
  descriptionPlaceholder?: (index: number) => string;
  minimumItems?: number;
  disabled?: boolean;
  catalogSearch?: boolean;
}

type CatalogSearchItem = {
  id: string;
  machine: string;
  description: string;
  partNumber: string | null;
  price: number | null;
  frontStock: number;
  rearStock: number;
};

let nextDamageItemId = 0;

function createDamageItemId() {
  nextDamageItemId += 1;
  return `damage-item-${Date.now()}-${nextDamageItemId}`;
}

export default function DamageItemsInput({
  items,
  onChange,
  label = "Pekerjaan Servis",
  helperText = "Pisahkan setiap keluhan atau pekerjaan agar estimasi mudah diperiksa.",
  itemLabel = "Pekerjaan",
  descriptionLabel = "Keluhan / pekerjaan",
  addLabel = "Tambah pekerjaan",
  emptyMessage = "Belum ada pekerjaan servis.",
  descriptionPlaceholder = (index) =>
    `Kerusakan #${index + 1} (contoh: mesin susah menyala)`,
  minimumItems = 1,
  disabled,
  catalogSearch = false,
}: DamageItemsInputProps) {
  const instanceId = useId();
  const [activeCatalogIndex, setActiveCatalogIndex] = useState<number | null>(null);
  const [catalogResults, setCatalogResults] = useState<CatalogSearchItem[]>([]);
  const [isSearchingCatalog, startCatalogSearch] = useTransition();
  const activeCatalogQuery =
    activeCatalogIndex === null
      ? ""
      : items[activeCatalogIndex]?.description.trim() ?? "";
  const SectionIcon = catalogSearch ? PackageSearch : Wrench;

  const addItem = () => {
    onChange([
      ...items,
      {
        clientId: createDamageItemId(),
        description: "",
        estimatedCost: "",
        quantity: 1,
      },
    ]);
  };

  const removeItem = (index: number) => {
    if (items.length <= minimumItems) return;
    onChange(items.filter((_, itemIndex) => itemIndex !== index));
  };

  const updateItem = (
    index: number,
    field: keyof DamageItem,
    value: string | number,
  ) => {
    onChange(
      items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item,
      ),
    );
  };

  useEffect(() => {
    if (!catalogSearch || activeCatalogQuery.length < 2) return;

    let cancelled = false;
    const timeoutId = window.setTimeout(() => {
      startCatalogSearch(async () => {
        const result = await searchMektekCatalogItems(activeCatalogQuery);
        if (cancelled) return;
        setCatalogResults((result?.data ?? []) as CatalogSearchItem[]);
      });
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [activeCatalogQuery, catalogSearch]);

  const selectCatalogItem = (index: number, catalogItem: CatalogSearchItem) => {
    onChange(
      mergeMektekLineItemInputs(
        items.map((item, itemIndex) =>
          itemIndex === index
            ? {
                ...item,
                catalogItemId: catalogItem.id,
                machine: catalogItem.machine,
                partNumber: catalogItem.partNumber ?? "",
                catalogPartNumber: "",
                stockWarehouse:
                  catalogItem.frontStock > 0 || catalogItem.rearStock <= 0
                    ? "FRONT"
                    : "REAR",
                frontStock: catalogItem.frontStock,
                rearStock: catalogItem.rearStock,
                description: catalogItem.description,
                quantity: Math.max(1, Number(item.quantity) || 1),
                estimatedCost:
                  typeof catalogItem.price === "number"
                    ? String(catalogItem.price)
                    : item.estimatedCost,
              }
            : item,
        ),
      ),
    );
    setActiveCatalogIndex(null);
    setCatalogResults([]);
  };

  return (
    <section
      className="min-w-0 space-y-4"
      aria-labelledby={`${instanceId}-title`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="rounded-lg border bg-background p-2 text-muted-foreground">
            <SectionIcon className="size-4" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h5 id={`${instanceId}-title`} className="text-sm font-semibold">
              {label}
            </h5>
            <p className="mt-0.5 max-w-2xl break-words text-xs leading-5 text-muted-foreground">
              {helperText}
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addItem}
          disabled={disabled}
          className="w-full shrink-0 sm:w-auto"
        >
          <Plus className="size-4" aria-hidden="true" />
          {addLabel}
        </Button>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed bg-muted/10 px-3 py-6 text-center sm:px-4 sm:py-8">
          <div className="rounded-full bg-muted p-2.5 text-muted-foreground">
            <SectionIcon className="size-5" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-medium">{emptyMessage}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Tambahkan satu baris saat item sudah diketahui.
            </p>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={addItem}
            disabled={disabled}
            className="w-full sm:w-auto"
          >
            <Plus className="size-4" aria-hidden="true" />
            {addLabel}
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item, index) => {
            const quantity = Math.max(1, Number(item.quantity) || 1);
            const lineTotal = parseMoney(item.estimatedCost) * quantity;
            const canRemove = items.length > minimumItems;
            const descriptionId = `${instanceId}-description-${index}`;
            const quantityId = `${instanceId}-quantity-${index}`;
            const priceId = `${instanceId}-price-${index}`;

            return (
              <article
                key={item.clientId ?? `${instanceId}-${index}`}
                className="min-w-0 rounded-lg border bg-background p-3 shadow-xs sm:p-4"
              >
                <div className="mb-4 flex flex-col gap-3 min-[420px]:flex-row min-[420px]:items-start min-[420px]:justify-between">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <Badge variant="outline">
                      {itemLabel} {String(index + 1).padStart(2, "0")}
                    </Badge>
                    {item.catalogItemId && (
                      <Badge variant="secondary">Dari katalog</Badge>
                    )}
                  </div>
                  <div className="flex w-full items-center justify-between gap-2 min-[420px]:w-auto min-[420px]:justify-start">
                    <div className="text-left min-[420px]:text-right">
                      <p className="text-[11px] text-muted-foreground">
                        Total baris
                      </p>
                      <p className="break-words font-mono text-sm font-semibold tabular-nums">
                        Rp {lineTotal.toLocaleString("id-ID")}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeItem(index)}
                      disabled={disabled || !canRemove}
                      className="shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      aria-label={`Hapus ${itemLabel.toLowerCase()} ${index + 1}`}
                      title={
                        canRemove
                          ? `Hapus ${itemLabel.toLowerCase()}`
                          : `Minimal ${minimumItems} ${itemLabel.toLowerCase()} diperlukan`
                      }
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </Button>
                  </div>
                </div>

                {item.catalogItemId && (
                  <div className="mb-3 space-y-3 rounded-md bg-muted/40 px-3 py-2">
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span>{item.machine}</span>
                      <span>{item.partNumber || "Tanpa nomor komponen"}</span>
                      {typeof item.frontStock === "number" && (
                        <span>Gudang Depan: {item.frontStock} PCS</span>
                      )}
                      {typeof item.rearStock === "number" && (
                        <span>Gudang Belakang: {item.rearStock} PCS</span>
                      )}
                    </div>
                    <div className="max-w-xs space-y-1.5">
                      <Label htmlFor={`${instanceId}-warehouse-${index}`}>
                        Ambil stok dari
                      </Label>
                      <select
                        id={`${instanceId}-warehouse-${index}`}
                        value={item.stockWarehouse ?? ""}
                        onChange={(event) =>
                          updateItem(index, "stockWarehouse", event.target.value)
                        }
                        disabled={disabled}
                        required
                        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <option value="" disabled>
                          Pilih gudang
                        </option>
                        <option value="FRONT">
                          Gudang Depan
                          {typeof item.frontStock === "number"
                            ? ` · ${item.frontStock} PCS`
                            : ""}
                        </option>
                        <option value="REAR">
                          Gudang Belakang
                          {typeof item.rearStock === "number"
                            ? ` · ${item.rearStock} PCS`
                            : ""}
                        </option>
                      </select>
                    </div>
                  </div>
                )}

                <div className="grid gap-3 md:grid-cols-12 md:items-start">
                  <div className="space-y-1.5 md:col-span-7">
                    <Label htmlFor={descriptionId}>
                      {descriptionLabel} <span className="text-destructive">*</span>
                    </Label>
                    <div className="relative">
                      <Input
                        id={descriptionId}
                        placeholder={descriptionPlaceholder(index)}
                        value={item.description}
                        onFocus={() =>
                          catalogSearch && setActiveCatalogIndex(index)
                        }
                        onChange={(event) => {
                          updateItem(index, "description", event.target.value);
                          if (catalogSearch) setActiveCatalogIndex(index);
                        }}
                        onBlur={() =>
                          onChange(mergeMektekLineItemInputs(items))
                        }
                        disabled={disabled}
                        autoComplete="off"
                        required
                      />
                      {catalogSearch &&
                        activeCatalogIndex === index &&
                        activeCatalogQuery.length >= 2 && (
                          <div className="absolute left-0 right-0 top-[calc(100%+0.25rem)] z-20 max-h-72 overflow-y-auto rounded-md border bg-popover text-popover-foreground shadow-md">
                            {isSearchingCatalog && (
                              <div className="px-3 py-2 text-xs text-muted-foreground">
                                Mencari di katalog...
                              </div>
                            )}
                            {!isSearchingCatalog &&
                              catalogResults.map((catalogItem) => (
                                <button
                                  key={catalogItem.id}
                                  type="button"
                                  className="flex w-full flex-col gap-1 border-b px-3 py-2.5 text-left last:border-b-0 hover:bg-accent hover:text-accent-foreground"
                                  onMouseDown={(event) => event.preventDefault()}
                                  onClick={() =>
                                    selectCatalogItem(index, catalogItem)
                                  }
                                >
                                  <span className="break-words text-sm font-medium">
                                    {catalogItem.description}
                                  </span>
                                  <span className="break-words text-xs text-muted-foreground">
                                    {catalogItem.machine} ·{" "}
                                    {catalogItem.partNumber ||
                                      "Tanpa nomor komponen"}
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    Depan {catalogItem.frontStock} PCS · Belakang{" "}
                                    {catalogItem.rearStock} PCS
                                  </span>
                                </button>
                              ))}
                            {!isSearchingCatalog &&
                              catalogResults.length === 0 && (
                                <button
                                  type="button"
                                  className="w-full px-3 py-2.5 text-left text-xs hover:bg-accent"
                                  onMouseDown={(event) => event.preventDefault()}
                                  onClick={() => {
                                    setActiveCatalogIndex(null);
                                    setCatalogResults([]);
                                  }}
                                >
                                  <span className="font-medium text-foreground">
                                    Gunakan nama manual ini
                                  </span>
                                  <span className="mt-0.5 block text-muted-foreground">
                                    &quot;{activeCatalogQuery}&quot; tidak ada di katalog.
                                  </span>
                                </button>
                              )}
                          </div>
                        )}
                    </div>
                    {catalogSearch && (
                      <p className="text-xs text-muted-foreground">
                        Ketik minimal 2 karakter untuk mencari katalog.
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5 md:col-span-2">
                    <Label htmlFor={quantityId}>Jumlah</Label>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        aria-label={`Kurangi jumlah ${itemLabel.toLowerCase()} ${index + 1}`}
                        onClick={() =>
                          updateItem(index, "quantity", Math.max(1, quantity - 1))
                        }
                        disabled={disabled || quantity <= 1}
                        className="shrink-0"
                      >
                        <Minus className="size-4" aria-hidden="true" />
                      </Button>
                      <Input
                        id={quantityId}
                        aria-label={`Jumlah ${itemLabel.toLowerCase()} ${index + 1}`}
                        type="number"
                        inputMode="numeric"
                        min={1}
                        step={1}
                        value={String(quantity)}
                        onChange={(event) =>
                          updateItem(
                            index,
                            "quantity",
                            Math.max(
                              1,
                              Math.floor(
                                Number(event.target.value.replace(/\D/g, "")) || 1,
                              ),
                            ),
                          )
                        }
                        disabled={disabled}
                        className="min-w-0 text-center"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        aria-label={`Tambah jumlah ${itemLabel.toLowerCase()} ${index + 1}`}
                        onClick={() => updateItem(index, "quantity", quantity + 1)}
                        disabled={disabled}
                        className="shrink-0"
                      >
                        <Plus className="size-4" aria-hidden="true" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-1.5 md:col-span-3">
                    <Label htmlFor={priceId}>
                      Harga satuan <span className="text-destructive">*</span>
                    </Label>
                    <RupiahInput
                      id={priceId}
                      aria-label={`Harga satuan ${itemLabel.toLowerCase()} ${index + 1} dalam Rupiah`}
                      placeholder="Rp 0"
                      value={item.estimatedCost}
                      onValueChange={(value) =>
                        updateItem(index, "estimatedCost", value)
                      }
                      disabled={disabled}
                      required
                    />
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
