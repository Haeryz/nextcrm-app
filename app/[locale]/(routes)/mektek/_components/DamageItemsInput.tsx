"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Plus } from "lucide-react";

export type DamageItem = {
  description: string;
  estimatedCost: string;
};

interface DamageItemsInputProps {
  items: DamageItem[];
  onChange: (items: DamageItem[]) => void;
  disabled?: boolean;
}

export default function DamageItemsInput({
  items,
  onChange,
  disabled,
}: DamageItemsInputProps) {
  const addItem = () => {
    onChange([...items, { description: "", estimatedCost: "" }]);
  };

  const removeItem = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof DamageItem, value: string) => {
    onChange(
      items.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground uppercase tracking-wide">
          Detail Kerusakan
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addItem}
          disabled={disabled}
        >
          <Plus className="w-3 h-3 mr-1" />
          Tambah item
        </Button>
      </div>

      {items.length === 0 && (
        <p className="text-xs text-muted-foreground italic py-2">
          Belum ada item kerusakan. Klik &ldquo;Tambah item&rdquo; untuk menambah.
        </p>
      )}

      <div className="space-y-2">
        {items.map((item, index) => (
          <div key={index} className="flex gap-2 items-start">
            <Input
              placeholder={`Kerusakan #${index + 1} (contoh: AC tidak dingin)`}
              value={item.description}
              onChange={(e) => updateItem(index, "description", e.target.value)}
              disabled={disabled}
              className="flex-1"
              required
            />
            <Input
              placeholder="Estimasi biaya (Rp)"
              value={item.estimatedCost}
              onChange={(e) =>
                updateItem(index, "estimatedCost", e.target.value.replace(/\D/g, ""))
              }
              disabled={disabled}
              className="w-40"
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
        ))}
      </div>
    </div>
  );
}
