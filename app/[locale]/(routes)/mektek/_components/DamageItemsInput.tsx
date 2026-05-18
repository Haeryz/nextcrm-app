"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Plus } from "lucide-react";

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
}

export default function DamageItemsInput({
  items,
  onChange,
  label = "Service Items",
  addLabel = "Tambah item",
  emptyMessage = "Belum ada item servis. Klik \"Tambah item\" untuk menambah.",
  descriptionPlaceholder = (index) =>
    `Kerusakan #${index + 1} (contoh: mesin susah menyala)`,
  disabled,
}: DamageItemsInputProps) {
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

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
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
                  Catalog
                </span>
                <span>{item.machine}</span>
                <span>{item.catalogPartNumber || item.partNumber || "No part number"}</span>
              </div>
            )}
            <div className="flex flex-col gap-2 md:flex-row md:items-start">
              <Input
                placeholder={descriptionPlaceholder(index)}
                value={item.description}
                onChange={(e) => updateItem(index, "description", e.target.value)}
                disabled={disabled}
                className="flex-1"
                required
              />
              <Input
                aria-label="Quantity"
                placeholder="Qty"
                value={String(item.quantity ?? 1)}
                onChange={(e) =>
                  updateItem(
                    index,
                    "quantity",
                    Math.max(1, Math.floor(Number(e.target.value.replace(/\D/g, "")) || 1))
                  )
                }
                disabled={disabled}
                className="w-full md:w-20"
              />
              <Input
                placeholder="Estimasi biaya (Rp)"
                value={item.estimatedCost}
                onChange={(e) =>
                  updateItem(index, "estimatedCost", e.target.value.replace(/\D/g, ""))
                }
                disabled={disabled}
                className="w-full md:w-40"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeItem(index)}
                disabled={disabled}
                className="shrink-0"
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
