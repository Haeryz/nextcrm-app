"use client";

import { useEffect, useId, useState, useTransition } from "react";
import { PackageSearch, Plus, Trash2, Wrench } from "lucide-react";

import { searchMektekCatalogItems } from "@/actions/mektek/service-orders";
import { RupiahInput } from "@/components/mektek/RupiahInput";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { parseMoney } from "@/lib/mektek/items";

export type DamageItem = {
  clientId?: string;
  description: string;
  estimatedCost: string;
  quantity?: number;
  catalogItemId?: string;
  machine?: string;
  partNumber?: string;
  catalogPartNumber?: string;
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
      items.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              catalogItemId: catalogItem.id,
              machine: catalogItem.machine,
              partNumber: catalogItem.partNumber ?? "",
              catalogPartNumber: "",
              description: catalogItem.description,
              quantity: Math.max(1, Number(item.quantity) || 1),
              estimatedCost:
                typeof catalogItem.price === "number"
                  ? String(catalogItem.price)
                  : item.estimatedCost,
            }
          : item,
      ),
    );
    setActiveCatalogIndex(null);
    setCatalogResults([]);
  };

  return (
    <section className="space-y-4" aria-labelledby={`${instanceId}-title`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-lg border bg-background p-2 text-muted-foreground">
            <SectionIcon className="size-4" aria-hidden="true" />
          </div>
          <div>
            <h5 id={`${instanceId}-title`} className="text-sm font-semibold">
              {label}
            </h5>
            <p className="mt-0.5 max-w-2xl text-xs leading-5 text-muted-foreground">
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
          className="shrink-0"
        >
          <Plus className="size-4" aria-hidden="true" />
          {addLabel}
        </Button>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed bg-muted/10 px-4 py-8 text-center">
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
                className="rounded-lg border bg-background p-4 shadow-xs"
              >
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">
                      {itemLabel} {String(index + 1).padStart(2, "0")}
                    </Badge>
                    {item.catalogItemId && (
                      <Badge variant="secondary">Dari katalog</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <p className="text-[11px] text-muted-foreground">
                        Total baris
                      </p>
                      <p className="font-mono text-sm font-semibold tabular-nums">
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
                  <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                    <span>{item.machine}</span>
                    <span>{item.partNumber || "Tanpa nomor komponen"}</span>
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
                                  <span className="text-sm font-medium">
                                    {catalogItem.description}
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    {catalogItem.machine} ·{" "}
                                    {catalogItem.partNumber ||
                                      "Tanpa nomor komponen"}
                                  </span>
                                </button>
                              ))}
                            {!isSearchingCatalog &&
                              catalogResults.length === 0 && (
                                <div className="px-3 py-2 text-xs text-muted-foreground">
                                  Item katalog tidak ditemukan. Data tetap dapat
                                  diisi manual.
                                </div>
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
                    />
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
