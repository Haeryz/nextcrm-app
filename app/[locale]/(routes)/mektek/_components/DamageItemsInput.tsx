"use client";

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RupiahInput } from "@/components/mektek/RupiahInput";
import { X, Plus } from "lucide-react";
import { searchMektekCatalogItems } from "@/actions/mektek/service-orders";

export type DamageItem = {
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
  addLabel?: string;
  emptyMessage?: string;
  descriptionPlaceholder?: (index: number) => string;
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

export default function DamageItemsInput({
  items,
  onChange,
  label = "Deskripsi Servis",
  addLabel = "Tambah item",
  emptyMessage = "Belum ada item servis. Klik \"Tambah item\" untuk menambah.",
  descriptionPlaceholder = (index) =>
    `Kerusakan #${index + 1} (contoh: mesin susah menyala)`,
  disabled,
  catalogSearch = false,
}: DamageItemsInputProps) {
  const [activeCatalogIndex, setActiveCatalogIndex] = useState<number | null>(null);
  const [catalogResults, setCatalogResults] = useState<CatalogSearchItem[]>([]);
  const [isSearchingCatalog, startCatalogSearch] = useTransition();
  const activeCatalogQuery =
    activeCatalogIndex === null
      ? ""
      : items[activeCatalogIndex]?.description.trim() ?? "";

  const addItem = () => {
    onChange([...items, { description: "", estimatedCost: "", quantity: 1 }]);
  };

  const removeItem = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  const updateItem = (
    index: number,
    field: keyof DamageItem,
    value: string | number
  ) => {
    onChange(
      items.map((item, i) => (i === index ? { ...item, [field]: value } : item))
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
          : item
      )
    );
    setActiveCatalogIndex(null);
    setCatalogResults([]);
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground uppercase tracking-wide">
          {label}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addItem}
          disabled={disabled}
        >
          <Plus className="w-3 h-3 mr-1" />
          {addLabel}
        </Button>
      </div>

      {items.length === 0 && (
        <p className="text-xs text-muted-foreground italic py-2">
          {emptyMessage}
        </p>
      )}

      <div className="space-y-2">
        {items.map((item, index) => (
          <div key={index} className="rounded-lg border bg-background p-3">
            {item.catalogItemId && (
              <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="rounded-full bg-muted px-2 py-1">
                  Katalog
                </span>
                <span>{item.machine}</span>
                <span>{item.partNumber || "Tanpa nomor komponen"}</span>
              </div>
            )}
            <div className="flex flex-col gap-2 md:flex-row md:items-start">
              <div className="relative min-w-0 flex-1">
                <Input
                  placeholder={descriptionPlaceholder(index)}
                  value={item.description}
                  onFocus={() => catalogSearch && setActiveCatalogIndex(index)}
                  onChange={(e) => {
                    updateItem(index, "description", e.target.value);
                    if (catalogSearch) setActiveCatalogIndex(index);
                  }}
                  disabled={disabled}
                  required
                />
                {catalogSearch && activeCatalogIndex === index && (
                  <div className="absolute left-0 right-0 top-[calc(100%+0.25rem)] z-20 max-h-72 overflow-y-auto rounded-md border bg-popover text-popover-foreground shadow-md">
                    {isSearchingCatalog && (
                      <div className="px-3 py-2 text-xs text-muted-foreground">
                        Mencari di katalog...
                      </div>
                    )}
                    {!isSearchingCatalog &&
                      activeCatalogQuery.length >= 2 &&
                      catalogResults.map((catalogItem) => (
                        <button
                          key={catalogItem.id}
                          type="button"
                          className="flex w-full flex-col gap-1 border-b px-3 py-2 text-left last:border-b-0 hover:bg-accent hover:text-accent-foreground"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => selectCatalogItem(index, catalogItem)}
                        >
                          <span className="text-sm font-medium">
                            {catalogItem.description}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {catalogItem.machine} -{" "}
                            {catalogItem.partNumber || "Tanpa nomor komponen"}
                          </span>
                        </button>
                      ))}
                    {!isSearchingCatalog &&
                      activeCatalogQuery.length >= 2 &&
                      catalogResults.length === 0 && (
                        <div className="px-3 py-2 text-xs text-muted-foreground">
                          Item katalog tidak ditemukan.
                        </div>
                      )}
                  </div>
                )}
              </div>
              <Input
                aria-label="Jumlah"
                placeholder="Jml"
                value={String(item.quantity ?? 1)}
                onChange={(e) =>
                  updateItem(
                    index,
                    "quantity",
                    Math.max(1, Math.floor(Number(e.target.value.replace(/\D/g, "")) || 1))
                  )
                }
                disabled={disabled}
                className="w-full md:w-24"
              />
                    <RupiahInput
                      aria-label="Estimasi biaya dalam Rupiah"
                      placeholder="Estimasi biaya (Rp)"
                      value={item.estimatedCost}
                      onValueChange={(value) =>
                        updateItem(index, "estimatedCost", value)
                      }
                      disabled={disabled}
                      required
                      className="w-full md:w-44"
                    />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeItem(index)}
                disabled={disabled}
                className="shrink-0 self-end md:self-auto"
                aria-label={`Hapus item ${label.toLowerCase()} ${index + 1}`}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
