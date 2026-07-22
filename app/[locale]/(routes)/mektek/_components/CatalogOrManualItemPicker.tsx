"use client";

import { useMemo, useState, type KeyboardEvent } from "react";
import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type CatalogOrManualItemSource = "CATALOG" | "MANUAL";

export type CatalogOrManualItemOption = {
  id: string;
  description: string;
  partNumber: string | null;
};

type CatalogOrManualItemPickerProps = {
  idPrefix: string;
  itemNumber: number;
  source: CatalogOrManualItemSource;
  catalogItemId: string;
  catalogQuery: string;
  partName: string;
  partNumber: string;
  catalogItems: CatalogOrManualItemOption[];
  excludedCatalogItemIds: ReadonlySet<string>;
  disabled?: boolean;
  catalogStockMessage: string;
  manualStockMessage?: string;
  onSourceChange: (source: CatalogOrManualItemSource) => void;
  onCatalogQueryChange: (query: string) => void;
  onCatalogItemSelect: (item: CatalogOrManualItemOption) => void;
  onPartNameChange: (value: string) => void;
  onPartNumberChange: (value: string) => void;
};

export function CatalogOrManualItemPicker({
  idPrefix,
  itemNumber,
  source,
  catalogItemId,
  catalogQuery,
  partName,
  partNumber,
  catalogItems,
  excludedCatalogItemIds,
  disabled = false,
  catalogStockMessage,
  manualStockMessage = "Item manual tidak mengubah stok Catalog.",
  onSourceChange,
  onCatalogQueryChange,
  onCatalogItemSelect,
  onPartNameChange,
  onPartNumberChange,
}: CatalogOrManualItemPickerProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const listId = `${idPrefix}-catalog-list`;

  const catalogMatches = useMemo(() => {
    const normalizedQuery = catalogQuery.trim().toLocaleLowerCase("id-ID");
    return catalogItems
      .filter((item) => {
        const searchable = `${item.description} · ${item.partNumber || "Tanpa PN"}`
          .toLocaleLowerCase("id-ID");
        return (
          (!normalizedQuery || searchable.includes(normalizedQuery)) &&
          (!excludedCatalogItemIds.has(item.id) || item.id === catalogItemId)
        );
      })
      .slice(0, 50);
  }, [catalogItemId, catalogItems, catalogQuery, excludedCatalogItemIds]);

  const selectCatalogItem = (item: CatalogOrManualItemOption) => {
    onCatalogItemSelect(item);
    setOpen(false);
    setActiveIndex(-1);
  };

  const handleCatalogKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      setOpen(false);
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      if (catalogMatches.length === 0) return;
      setActiveIndex((current) => {
        if (event.key === "ArrowDown") {
          return current < 0 ? 0 : (current + 1) % catalogMatches.length;
        }
        return current < 0
          ? catalogMatches.length - 1
          : (current - 1 + catalogMatches.length) % catalogMatches.length;
      });
      return;
    }
    if (
      event.key === "Enter" &&
      open &&
      activeIndex >= 0 &&
      catalogMatches.length > 0
    ) {
      event.preventDefault();
      selectCatalogItem(catalogMatches[Math.min(activeIndex, catalogMatches.length - 1)]);
    }
  };

  return (
    <Tabs
      value={source}
      onValueChange={(value) => {
        setOpen(false);
        setActiveIndex(-1);
        onSourceChange(value as CatalogOrManualItemSource);
      }}
    >
      <TabsList className="grid w-full grid-cols-2 sm:w-80">
        <TabsTrigger value="CATALOG">Cari Catalog</TabsTrigger>
        <TabsTrigger value="MANUAL">Input Manual</TabsTrigger>
      </TabsList>

      <TabsContent value="CATALOG" className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-catalog-item`}>
          Nama Item atau Part Number
        </Label>
        <div
          className="relative"
          onBlurCapture={(event) => {
            const nextTarget = event.relatedTarget;
            if (!nextTarget || !event.currentTarget.contains(nextTarget as Node)) {
              setOpen(false);
            }
          }}
        >
          <Search
            className="pointer-events-none absolute start-3 top-2.5 z-10 size-4 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id={`${idPrefix}-catalog-item`}
            role="combobox"
            aria-autocomplete="list"
            aria-controls={open ? listId : undefined}
            aria-activedescendant={
              open && activeIndex >= 0 && catalogMatches.length > 0
                ? `${listId}-option-${Math.min(activeIndex, catalogMatches.length - 1)}`
                : undefined
            }
            aria-haspopup="listbox"
            aria-expanded={open}
            className="ps-9"
            value={catalogQuery}
            onFocus={() => {
              setOpen(true);
              setActiveIndex(-1);
            }}
            onChange={(event) => {
              onCatalogQueryChange(event.target.value);
              setOpen(true);
              setActiveIndex(-1);
            }}
            onKeyDown={handleCatalogKeyDown}
            placeholder="Ketik nama item atau part number"
            disabled={disabled}
            autoComplete="off"
          />
          {open && (
            <div
              id={listId}
              role="listbox"
              aria-label={`Hasil pencarian Catalog untuk Item ${itemNumber}`}
              className="absolute inset-x-0 top-full z-30 mt-1 max-h-56 overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
            >
              {catalogMatches.map((catalogItem, index) => (
                <Button
                  id={`${listId}-option-${index}`}
                  key={catalogItem.id}
                  type="button"
                  variant="ghost"
                  role="option"
                  aria-selected={catalogItemId === catalogItem.id}
                  className="h-auto w-full justify-start px-3 py-2 text-left"
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => selectCatalogItem(catalogItem)}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">
                      {catalogItem.description}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {catalogItem.partNumber || "Tanpa Part Number"}
                    </span>
                  </span>
                </Button>
              ))}
              {catalogMatches.length === 0 && (
                <p
                  className="px-3 py-4 text-center text-sm text-muted-foreground"
                  role="status"
                >
                  Tidak ditemukan di Catalog. Pilih tab Input Manual untuk mengetik
                  item baru.
                </p>
              )}
              {catalogMatches.length === 50 && (
                <p className="border-t px-3 py-2 text-xs text-muted-foreground">
                  Ketik lebih spesifik untuk mempersempit hasil.
                </p>
              )}
            </div>
          )}
        </div>
        {catalogItemId && (
          <p className="text-xs text-muted-foreground">{catalogStockMessage}</p>
        )}
        {!catalogItemId && catalogQuery.trim() && (
          <p className="text-xs text-destructive">
            Pilih salah satu hasil Catalog atau gunakan Input Manual.
          </p>
        )}
      </TabsContent>

      <TabsContent value="MANUAL" className="space-y-2">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor={`${idPrefix}-manual-name`}>Item Name</Label>
            <Input
              id={`${idPrefix}-manual-name`}
              value={partName}
              onChange={(event) => onPartNameChange(event.target.value)}
              placeholder="Nama item"
              maxLength={160}
              disabled={disabled}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${idPrefix}-manual-part-number`}>Part Number</Label>
            <Input
              id={`${idPrefix}-manual-part-number`}
              value={partNumber}
              onChange={(event) => onPartNumberChange(event.target.value)}
              placeholder="Part number"
              maxLength={120}
              disabled={disabled}
              required
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">{manualStockMessage}</p>
      </TabsContent>
    </Tabs>
  );
}
