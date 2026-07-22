"use client";

import {
  CheckCircle2,
  CircleHelp,
  PackageSearch,
  PencilLine,
  Search,
  X,
} from "lucide-react";
import { useMemo, useRef, useState, type KeyboardEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

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
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listId = `${idPrefix}-catalog-list`;
  const selectedCatalogItem = useMemo(
    () => catalogItems.find((item) => item.id === catalogItemId) ?? null,
    [catalogItemId, catalogItems],
  );

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

  const clearCatalogSelection = () => {
    onCatalogQueryChange("");
    setOpen(true);
    setActiveIndex(-1);
    requestAnimationFrame(() => searchInputRef.current?.focus());
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
      className="w-full"
      value={source}
      onValueChange={(value) => {
        setOpen(false);
        setActiveIndex(-1);
        onSourceChange(value as CatalogOrManualItemSource);
      }}
    >
      <TabsList className="grid h-11 w-full grid-cols-2 rounded-lg p-1">
        <TabsTrigger value="CATALOG" className="gap-2 rounded-md">
          <PackageSearch className="size-4" aria-hidden="true" />
          Cari Catalog
        </TabsTrigger>
        <TabsTrigger value="MANUAL" className="gap-2 rounded-md">
          <PencilLine className="size-4" aria-hidden="true" />
          Input Manual
        </TabsTrigger>
      </TabsList>

      <TabsContent value="CATALOG" className="mt-3 space-y-3">
        {selectedCatalogItem ? (
          <div className="rounded-lg border border-primary/25 bg-primary/[0.04] p-3.5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <CheckCircle2 className="size-5" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-primary">
                    Item Catalog terpilih
                  </p>
                  <p className="mt-0.5 truncate text-sm font-semibold">
                    {selectedCatalogItem.description}
                  </p>
                  <p className="mt-1 font-mono text-xs text-muted-foreground">
                    {selectedCatalogItem.partNumber || "Tanpa Part Number"}
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={clearCatalogSelection}
                disabled={disabled}
              >
                Ganti item
              </Button>
            </div>
            <p className="mt-3 flex items-start gap-2 border-t border-primary/15 pt-3 text-xs text-muted-foreground">
              <CircleHelp className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              {catalogStockMessage}
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            <Label htmlFor={`${idPrefix}-catalog-item`}>
              Cari berdasarkan nama atau part number
            </Label>
            <p className="text-xs text-muted-foreground">
              Mulai ketik untuk melihat item yang tersedia di Catalog.
            </p>
            <div
              className="relative pt-1"
              onBlurCapture={(event) => {
                const nextTarget = event.relatedTarget;
                if (
                  !nextTarget ||
                  !event.currentTarget.contains(nextTarget as Node)
                ) {
                  setOpen(false);
                }
              }}
            >
              <Search
                className="pointer-events-none absolute start-3 top-4 z-10 size-4 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                ref={searchInputRef}
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
                className="h-11 rounded-lg bg-background ps-10 pe-10 shadow-sm"
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
                placeholder="Contoh: Aki atau 992"
                disabled={disabled}
                autoComplete="off"
              />
              {catalogQuery && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute end-1 top-2 size-9 text-muted-foreground"
                  onClick={clearCatalogSelection}
                  disabled={disabled}
                  aria-label="Bersihkan pencarian Catalog"
                >
                  <X className="size-4" aria-hidden="true" />
                </Button>
              )}
              {open && (
                <div
                  id={listId}
                  role="listbox"
                  aria-label={`Hasil pencarian Catalog untuk Item ${itemNumber}`}
                  className="relative z-30 mt-1 max-h-72 overflow-y-auto rounded-lg border bg-popover text-popover-foreground shadow-lg"
                >
                  <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-popover px-3 py-2 text-xs text-muted-foreground">
                    <span>Hasil Catalog</span>
                    <span>{catalogMatches.length} item</span>
                  </div>
                  <div className="p-1.5">
                    {catalogMatches.map((catalogItem, index) => (
                      <Button
                        id={`${listId}-option-${index}`}
                        key={catalogItem.id}
                        type="button"
                        variant="ghost"
                        role="option"
                        aria-selected={catalogItemId === catalogItem.id}
                        className={cn(
                          "h-auto w-full justify-start gap-3 rounded-md px-3 py-2.5 text-left",
                          index === activeIndex && "bg-accent text-accent-foreground",
                        )}
                        onMouseEnter={() => setActiveIndex(index)}
                        onClick={() => selectCatalogItem(catalogItem)}
                      >
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                          <PackageSearch className="size-4" aria-hidden="true" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">
                            {catalogItem.description}
                          </span>
                          <span className="mt-0.5 block truncate font-mono text-xs text-muted-foreground">
                            {catalogItem.partNumber || "Tanpa Part Number"}
                          </span>
                        </span>
                      </Button>
                    ))}
                    {catalogMatches.length === 0 && (
                      <div className="px-3 py-5 text-center" role="status">
                        <PackageSearch
                          className="mx-auto size-7 text-muted-foreground"
                          aria-hidden="true"
                        />
                        <p className="mt-2 text-sm font-medium">
                          Item tidak ditemukan
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Anda tetap dapat menambahkan item ini secara manual.
                        </p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="mt-3"
                          onClick={() => onSourceChange("MANUAL")}
                        >
                          <PencilLine className="size-4" aria-hidden="true" />
                          Gunakan Input Manual
                        </Button>
                      </div>
                    )}
                    {catalogMatches.length === 50 && (
                      <p className="border-t px-3 py-2 text-xs text-muted-foreground">
                        Ketik lebih spesifik untuk mempersempit hasil.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
            {catalogQuery.trim() && (
              <p className="text-xs text-destructive">
                Pilih salah satu hasil Catalog atau gunakan Input Manual.
              </p>
            )}
          </div>
        )}
      </TabsContent>

      <TabsContent value="MANUAL" className="mt-3 space-y-3">
        <div>
          <p className="text-sm font-medium">Masukkan identitas item</p>
          <p className="text-xs text-muted-foreground">
            Gunakan nama dan part number yang mudah dikenali pada dokumen PO.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor={`${idPrefix}-manual-name`}>Nama Item</Label>
            <Input
              id={`${idPrefix}-manual-name`}
              className="h-11 rounded-lg bg-background shadow-sm"
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
              className="h-11 rounded-lg bg-background font-mono shadow-sm"
              value={partNumber}
              onChange={(event) => onPartNumberChange(event.target.value)}
              placeholder="Part number"
              maxLength={120}
              disabled={disabled}
              required
            />
          </div>
        </div>
        <p className="flex items-start gap-2 rounded-md bg-muted/60 px-3 py-2.5 text-xs text-muted-foreground">
          <CircleHelp className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          {manualStockMessage}
        </p>
      </TabsContent>
    </Tabs>
  );
}
