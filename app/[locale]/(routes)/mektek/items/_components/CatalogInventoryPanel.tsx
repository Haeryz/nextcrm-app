"use client";

import { useMemo, useState, useTransition } from "react";
import { Download, Loader2, PackagePlus, Warehouse } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  recordMektekCatalogStockMovement,
  setMektekCatalogOpeningStock,
} from "@/actions/mektek/catalog-inventory";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  filterCatalogInventorySnapshots,
  getCatalogProductionChannelLabel,
  getCatalogInventoryLocalDateKey,
  type CatalogInventorySnapshot,
  type CatalogInventoryQuantityField,
  type CatalogInventoryQuantityOperator,
  type CatalogStockDirection,
  type CatalogWarehouse,
} from "@/lib/mektek/catalog-inventory";

type CatalogInventoryPanelProps = {
  items: Array<{
    id: string;
    description: string;
    inventory: CatalogInventorySnapshot;
  }>;
  month: string;
  daysInMonth: number;
};

type MovementDraft = {
  warehouse: CatalogWarehouse;
  direction: CatalogStockDirection;
  quantity: string;
  occurredOn: string;
  note: string;
};

function todayKey() {
  return getCatalogInventoryLocalDateKey();
}

function defaultMovementDate(month: string, daysInMonth: number) {
  const today = todayKey();
  if (today.startsWith(`${month}-`)) return today;
  if (month < today.slice(0, 7)) {
    return `${month}-${String(daysInMonth).padStart(2, "0")}`;
  }
  return today;
}

function blankMovement(month: string, daysInMonth: number): MovementDraft {
  return {
    warehouse: "REAR",
    direction: "IN",
    quantity: "",
    occurredOn: defaultMovementDate(month, daysInMonth),
    note: "",
  };
}

function monthLabel(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("id-ID", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, monthNumber - 1, 1)));
}

export default function CatalogInventoryPanel({
  items,
  month,
  daysInMonth,
}: CatalogInventoryPanelProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [activeItem, setActiveItem] = useState<
    CatalogInventoryPanelProps["items"][number] | null
  >(null);
  const [openingItem, setOpeningItem] = useState<
    CatalogInventoryPanelProps["items"][number] | null
  >(null);
  const [openingRearStock, setOpeningRearStock] = useState("");
  const [openingFrontStock, setOpeningFrontStock] = useState("");
  const [draft, setDraft] = useState<MovementDraft>(() =>
    blankMovement(month, daysInMonth),
  );
  const [query, setQuery] = useState("");
  const [productionChannel, setProductionChannel] = useState("");
  const [quantityField, setQuantityField] =
    useState<CatalogInventoryQuantityField>("TOTAL_CLOSING_STOCK");
  const [quantityOperator, setQuantityOperator] =
    useState<CatalogInventoryQuantityOperator>("LT");
  const [quantityValue, setQuantityValue] = useState("");
  const filteredItems = useMemo(() => {
    const matchingIds = new Set(
      filterCatalogInventorySnapshots(
        items.map((item) => item.inventory),
        {
          query,
          productionChannel:
            productionChannel === "POWERTRAIN" || productionChannel === "THERMAL"
              ? productionChannel
              : "",
          quantityField,
          quantityOperator,
          quantityValue,
        },
      ).map((snapshot) => snapshot.id),
    );
    return items.filter((item) => matchingIds.has(item.id));
  }, [items, productionChannel, quantityField, quantityOperator, quantityValue, query]);
  const hasActiveFilters = Boolean(query || productionChannel || quantityValue);
  const totalRearStock = filteredItems.reduce(
    (sum, item) => sum + item.inventory.closingRearStock,
    0,
  );
  const totalFrontStock = filteredItems.reduce(
    (sum, item) => sum + item.inventory.closingFrontStock,
    0,
  );

  const openMovement = (item: CatalogInventoryPanelProps["items"][number]) => {
    setActiveItem(item);
    setDraft(blankMovement(month, daysInMonth));
  };

  const openOpeningStock = (
    item: CatalogInventoryPanelProps["items"][number],
  ) => {
    setOpeningItem(item);
    setOpeningRearStock(String(item.inventory.openingRearStock));
    setOpeningFrontStock(String(item.inventory.openingFrontStock));
  };

  const submitMovement = () => {
    if (!activeItem) return;
    startTransition(async () => {
      const result = await recordMektekCatalogStockMovement({
        catalogItemId: activeItem.id,
        ...draft,
      });
      if (!result || "error" in result) {
        toast.error(result?.error || "Gagal mencatat mutasi stok");
        return;
      }
      toast.success("Mutasi stok berhasil dicatat");
      setActiveItem(null);
      router.refresh();
    });
  };

  const submitOpeningStock = () => {
    if (!openingItem) return;
    startTransition(async () => {
      const result = await setMektekCatalogOpeningStock({
        catalogItemId: openingItem.id,
        month,
        openingRearStock,
        openingFrontStock,
      });
      if (!result || "error" in result) {
        toast.error(result?.error || "Gagal memperbarui stok awal");
        return;
      }
      toast.success("Stok awal berhasil diperbarui");
      setOpeningItem(null);
      router.refresh();
    });
  };

  return (
    <section aria-labelledby="monthly-inventory-title" className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 id="monthly-inventory-title" className="text-lg font-semibold">
            Inventory Bulanan · {monthLabel(month)}
          </h2>
          <p className="text-sm text-muted-foreground">
            Kolom tanggal menampilkan stok masuk; stok akhir juga memperhitungkan mutasi keluar.
          </p>
        </div>
        <Button asChild variant="outline" className="w-full lg:w-auto">
          <a href={`/api/mektek/catalog-inventory/export?month=${month}`}>
            <Download data-icon="inline-start" />
            Export Excel {month}
          </a>
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filter spreadsheet</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(240px,1.4fr)_170px_210px_170px_140px_auto] xl:items-end">
            <div className="space-y-1.5">
              <Label htmlFor="spreadsheet-search">Cari seluruh kolom</Label>
              <Input
                id="spreadsheet-search"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Item, machine, part number, lokasi..."
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="spreadsheet-channel">Channel</Label>
              <Select
                value={productionChannel || "ALL"}
                onValueChange={(value) =>
                  setProductionChannel(value === "ALL" ? "" : value)
                }
              >
                <SelectTrigger id="spreadsheet-channel">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Semua channel</SelectItem>
                  <SelectItem value="POWERTRAIN">Powertrain</SelectItem>
                  <SelectItem value="THERMAL">Thermal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="spreadsheet-quantity-field">Kolom quantity</Label>
              <Select
                value={quantityField}
                onValueChange={(value) =>
                  setQuantityField(value as CatalogInventoryQuantityField)
                }
              >
                <SelectTrigger id="spreadsheet-quantity-field">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TOTAL_CLOSING_STOCK">Total stok akhir</SelectItem>
                  <SelectItem value="CLOSING_REAR_STOCK">Stok akhir G. Belakang</SelectItem>
                  <SelectItem value="CLOSING_FRONT_STOCK">Stok akhir G. Depan</SelectItem>
                  <SelectItem value="TOTAL_INBOUND">Total stok masuk</SelectItem>
                  <SelectItem value="OPENING_REAR_STOCK">Stok awal G. Belakang</SelectItem>
                  <SelectItem value="OPENING_FRONT_STOCK">Stok awal G. Depan</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="spreadsheet-quantity-operator">Operator</Label>
              <Select
                value={quantityOperator}
                onValueChange={(value) =>
                  setQuantityOperator(value as CatalogInventoryQuantityOperator)
                }
              >
                <SelectTrigger id="spreadsheet-quantity-operator">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LT">Kurang dari (&lt;)</SelectItem>
                  <SelectItem value="LTE">Maksimal (≤)</SelectItem>
                  <SelectItem value="EQ">Sama dengan (=)</SelectItem>
                  <SelectItem value="GTE">Minimal (≥)</SelectItem>
                  <SelectItem value="GT">Lebih dari (&gt;)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="spreadsheet-quantity">Nilai quantity</Label>
              <Input
                id="spreadsheet-quantity"
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                value={quantityValue}
                onChange={(event) => setQuantityValue(event.target.value)}
                placeholder="Contoh: 100"
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              disabled={!hasActiveFilters}
              onClick={() => {
                setQuery("");
                setProductionChannel("");
                setQuantityField("TOTAL_CLOSING_STOCK");
                setQuantityOperator("LT");
                setQuantityValue("");
              }}
            >
              Reset Filter
            </Button>
          </div>
          <p className="text-sm text-muted-foreground" aria-live="polite">
            Menampilkan {filteredItems.length} dari {items.length} item.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Warehouse className="size-5 text-primary" aria-hidden="true" />
            <div>
              <p className="text-xs text-muted-foreground">Stok akhir G. Belakang</p>
              <p className="text-xl font-semibold tabular-nums">{totalRearStock}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Warehouse className="size-5 text-primary" aria-hidden="true" />
            <div>
              <p className="text-xs text-muted-foreground">Stok akhir G. Depan</p>
              <p className="text-xl font-semibold tabular-nums">{totalFrontStock}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <PackagePlus className="size-5 text-primary" aria-hidden="true" />
            <div>
              <p className="text-xs text-muted-foreground">Total stok masuk</p>
              <p className="text-xl font-semibold tabular-nums">
                {filteredItems.reduce(
                  (sum, item) => sum + item.inventory.totalInbound,
                  0,
                )}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Kartu stok sparepart</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="min-w-max border-collapse text-sm">
              <caption className="sr-only">
                Kartu stok sparepart {monthLabel(month)} dengan stok masuk harian dan saldo dua gudang
              </caption>
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="sticky left-0 z-20 min-w-56 border-b border-e bg-muted px-3 py-3 text-left">
                    Item
                  </th>
                  <th className="min-w-28 border-b border-e px-3 py-3 text-left">Channel</th>
                  <th className="min-w-24 border-b border-e px-3 py-3 text-right">Awal B.</th>
                  <th className="min-w-24 border-b border-e px-3 py-3 text-right">Awal D.</th>
                  {Array.from({ length: daysInMonth }, (_, index) => (
                    <th key={index + 1} className="w-12 border-b border-e px-2 py-3 text-center">
                      {index + 1}
                    </th>
                  ))}
                  <th className="min-w-24 border-b border-e px-3 py-3 text-right">Total Masuk</th>
                  <th className="min-w-24 border-b border-e px-3 py-3 text-right">Akhir B.</th>
                  <th className="min-w-24 border-b border-e px-3 py-3 text-right">Akhir D.</th>
                  <th className="min-w-28 border-b border-e px-3 py-3 text-right">Total Akhir</th>
                  <th className="min-w-40 border-b border-e px-3 py-3 text-left">Remark</th>
                  <th className="min-w-36 border-b border-e px-3 py-3 text-left">Lokasi B.</th>
                  <th className="min-w-36 border-b border-e px-3 py-3 text-left">Lokasi D.</th>
                  <th className="min-w-36 border-b px-3 py-3 text-right">Mutasi</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => {
                  const inventory = item.inventory;
                  return (
                    <tr key={item.id} className="border-b last:border-b-0 hover:bg-muted/20">
                      <th scope="row" className="sticky left-0 z-10 border-e bg-card px-3 py-3 text-left font-normal">
                        <p className="max-w-56 truncate font-medium">{item.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {inventory.machine} · {inventory.partNumber || "Tanpa part number"}
                        </p>
                      </th>
                      <td className="border-e px-3 py-3">
                        <Badge variant={inventory.productionChannel ? "secondary" : "outline"}>
                          {getCatalogProductionChannelLabel(inventory.productionChannel) || "-"}
                        </Badge>
                      </td>
                      <td className="border-e px-3 py-3 text-right font-mono tabular-nums">
                        {inventory.openingRearStock}
                      </td>
                      <td className="border-e px-3 py-3 text-right font-mono tabular-nums">
                        {inventory.openingFrontStock}
                      </td>
                      {inventory.dailyInbound.map((daily) => (
                        <td
                          key={daily.day}
                          className="border-e px-2 py-3 text-center font-mono tabular-nums"
                          title={`Belakang ${daily.rear} · Depan ${daily.front}`}
                        >
                          {daily.total || ""}
                        </td>
                      ))}
                      <td className="border-e px-3 py-3 text-right font-mono font-semibold tabular-nums">
                        {inventory.totalInbound}
                      </td>
                      <td className="border-e px-3 py-3 text-right font-mono font-semibold tabular-nums">
                        {inventory.closingRearStock}
                      </td>
                      <td className="border-e px-3 py-3 text-right font-mono font-semibold tabular-nums">
                        {inventory.closingFrontStock}
                      </td>
                      <td className="border-e px-3 py-3 text-right font-mono font-semibold tabular-nums">
                        {inventory.closingRearStock + inventory.closingFrontStock}
                      </td>
                      <td className="border-e px-3 py-3 text-muted-foreground">
                        {inventory.remark || "-"}
                      </td>
                      <td className="border-e px-3 py-3 text-muted-foreground">
                        {inventory.rearLocation || "-"}
                      </td>
                      <td className="border-e px-3 py-3 text-muted-foreground">
                        {inventory.frontLocation || "-"}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <div className="flex flex-col items-end gap-1.5">
                          <Button size="sm" variant="outline" onClick={() => openMovement(item)}>
                            Catat
                          </Button>
                          {inventory.openingStockEditable && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => openOpeningStock(item)}
                            >
                              Stok awal
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredItems.length === 0 && (
                  <tr>
                    <td colSpan={daysInMonth + 12} className="px-4 py-10 text-center text-muted-foreground">
                      Tidak ada item yang cocok dengan filter spreadsheet ini.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!activeItem} onOpenChange={(open) => !open && setActiveItem(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Catat Mutasi Stok</DialogTitle>
            <DialogDescription>
              {activeItem?.description} · saldo akan dihitung ulang sampai bulan terbaru.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              submitMovement();
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Gudang</Label>
                <Select
                  value={draft.warehouse}
                  onValueChange={(warehouse) =>
                    setDraft((current) => ({
                      ...current,
                      warehouse: warehouse as CatalogWarehouse,
                    }))
                  }
                  disabled={isPending}
                >
                  <SelectTrigger aria-label="Gudang"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="REAR">Gudang Belakang</SelectItem>
                    <SelectItem value="FRONT">Gudang Depan</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Jenis Mutasi</Label>
                <Select
                  value={draft.direction}
                  onValueChange={(direction) =>
                    setDraft((current) => ({
                      ...current,
                      direction: direction as CatalogStockDirection,
                    }))
                  }
                  disabled={isPending}
                >
                  <SelectTrigger aria-label="Jenis Mutasi"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="IN">Stok masuk</SelectItem>
                    <SelectItem value="OUT">Stok keluar</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="movement-date">Tanggal</Label>
                <Input
                  id="movement-date"
                  type="date"
                  min={`${month}-01`}
                  max={defaultMovementDate(month, daysInMonth)}
                  value={draft.occurredOn}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, occurredOn: event.target.value }))
                  }
                  disabled={isPending}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="movement-quantity">Quantity</Label>
                <Input
                  id="movement-quantity"
                  inputMode="numeric"
                  value={draft.quantity}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      quantity: event.target.value.replace(/\D/g, ""),
                    }))
                  }
                  disabled={isPending}
                  required
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="movement-note">Catatan</Label>
              <Input
                id="movement-note"
                value={draft.note}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, note: event.target.value }))
                }
                disabled={isPending}
                placeholder="Contoh: penerimaan PO / pemakaian service"
              />
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 data-icon="inline-start" className="animate-spin" />}
                Simpan Mutasi
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!openingItem} onOpenChange={(open) => !open && setOpeningItem(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Atur Stok Awal</DialogTitle>
            <DialogDescription>
              {openingItem?.description} · hanya bulan inventory pertama yang dapat mengubah saldo awal.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              submitOpeningStock();
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="opening-rear-stock">Gudang Belakang</Label>
                <Input
                  id="opening-rear-stock"
                  inputMode="numeric"
                  value={openingRearStock}
                  onChange={(event) =>
                    setOpeningRearStock(event.target.value.replace(/\D/g, ""))
                  }
                  disabled={isPending}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="opening-front-stock">Gudang Depan</Label>
                <Input
                  id="opening-front-stock"
                  inputMode="numeric"
                  value={openingFrontStock}
                  onChange={(event) =>
                    setOpeningFrontStock(event.target.value.replace(/\D/g, ""))
                  }
                  disabled={isPending}
                  required
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Perubahan akan menghitung ulang stok akhir dan rollover seluruh bulan setelahnya.
            </p>
            <div className="flex justify-end">
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 data-icon="inline-start" className="animate-spin" />}
                Simpan Stok Awal
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
