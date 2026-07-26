"use client";

import { useMemo, useState, useTransition } from "react";
import {
  AlertTriangle,
  ArrowUpDown,
  Download,
  History,
  Loader2,
  PackageMinus,
  PackagePlus,
  Warehouse,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  listMektekCatalogStockMovements,
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
  getCatalogMovementCategory,
  getCatalogMovementCategoryLabel,
  getCatalogProductionChannelLabel,
  getCatalogInventoryLocalDateKey,
  type CatalogInventorySnapshot,
  type CatalogInventoryQuantityField,
  type CatalogInventoryQuantityOperator,
  type CatalogMovementCategory,
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
  locale: string;
  currentMonth: string;
};

type MovementDraft = {
  warehouse: CatalogWarehouse;
  direction: CatalogStockDirection;
  quantity: string;
  occurredOn: string;
  note: string;
  counterpartyName: string;
};

type HistoryMovement = {
  id: string;
  warehouse: CatalogWarehouse;
  direction: CatalogStockDirection;
  quantity: number;
  occurredAt: Date | string;
  note: string | null;
  counterpartyName: string | null;
  source: string;
  sourceId: string | null;
  consignmentSiteName: string | null;
};

const LOW_STOCK_THRESHOLD = 30;

const STOCK_MOVEMENT_SOURCE_LABEL: Record<string, string> = {
  MANUAL: "Manual",
  RECEIVING: "Receiving",
  OUTBOUND_PO: "Monitoring PO",
  SERVICE_ORDER: "Service Order",
};

function formatHistoryTime(value: Date | string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Makassar",
  }).format(date);
}

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

function blankMovement(
  month: string,
  daysInMonth: number,
  occurredOn = defaultMovementDate(month, daysInMonth),
): MovementDraft {
  return {
    warehouse: "REAR",
    direction: "IN",
    quantity: "",
    occurredOn,
    note: "",
    counterpartyName: "",
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
  locale,
  currentMonth,
}: CatalogInventoryPanelProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [movementOpen, setMovementOpen] = useState(false);
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
  const [movementCategory, setMovementCategory] = useState<
    CatalogMovementCategory | ""
  >("");
  const [quantityField, setQuantityField] =
    useState<CatalogInventoryQuantityField>("TOTAL_CLOSING_STOCK");
  const [quantityOperator, setQuantityOperator] =
    useState<CatalogInventoryQuantityOperator>("LT");
  const [quantityValue, setQuantityValue] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyItem, setHistoryItem] = useState<
    CatalogInventoryPanelProps["items"][number] | null
  >(null);
  const [historyDay, setHistoryDay] = useState<number | null>(null);
  const [historyMovements, setHistoryMovements] = useState<HistoryMovement[]>(
    [],
  );
  const [historyLoading, setHistoryLoading] = useState(false);
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
          movementCategory,
        },
      ).map((snapshot) => snapshot.id),
    );
    return items.filter((item) => matchingIds.has(item.id));
  }, [
    items,
    movementCategory,
    productionChannel,
    quantityField,
    quantityOperator,
    quantityValue,
    query,
  ]);
  const hasActiveFilters = Boolean(
    query || productionChannel || movementCategory || quantityValue,
  );
  const totalRearStock = filteredItems.reduce(
    (sum, item) => sum + item.inventory.closingRearStock,
    0,
  );
  const totalFrontStock = filteredItems.reduce(
    (sum, item) => sum + item.inventory.closingFrontStock,
    0,
  );

  const openMovement = (
    item: CatalogInventoryPanelProps["items"][number],
    occurredOn = defaultMovementDate(month, daysInMonth),
  ) => {
    setActiveItem(item);
    setDraft(blankMovement(month, daysInMonth, occurredOn));
    setMovementOpen(true);
  };

  const openOpeningStock = (
    item: CatalogInventoryPanelProps["items"][number],
  ) => {
    setOpeningItem(item);
    setOpeningRearStock(String(item.inventory.openingRearStock));
    setOpeningFrontStock(String(item.inventory.openingFrontStock));
  };

  const openHistory = (
    item: CatalogInventoryPanelProps["items"][number],
    day: number,
  ) => {
    const occurredOn = `${month}-${String(day).padStart(2, "0")}`;
    setHistoryItem(item);
    setHistoryDay(day);
    setHistoryMovements([]);
    setHistoryOpen(true);
    setHistoryLoading(true);
    startTransition(async () => {
      const result = await listMektekCatalogStockMovements({
        catalogItemId: item.id,
        occurredOn,
      });
      if (!result || "error" in result) {
        toast.error(result?.error || "Gagal memuat riwayat mutasi");
        setHistoryOpen(false);
        return;
      }
      setHistoryMovements(result.data as HistoryMovement[]);
      setHistoryLoading(false);
    });
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
      setMovementOpen(false);
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
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <PackageMinus className="size-5 text-destructive" aria-hidden="true" />
            <div>
              <p className="text-xs text-muted-foreground">Total stok keluar</p>
              <p className="text-xl font-semibold tabular-nums">
                {filteredItems.reduce(
                  (sum, item) => sum + item.inventory.totalOutbound,
                  0,
                )}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="sticky top-0 z-30 gap-4 border-b bg-card pb-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <CardTitle id="monthly-inventory-title" className="text-base">
                Kartu stok sparepart · {monthLabel(month)}
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Filter & periode kartu stok berada di satu tempat agar konteks tabel tetap jelas.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <form
                action={`/${locale}/mektek/items/spreadsheet`}
                className="flex flex-col gap-2 sm:flex-row sm:items-end"
              >
                <div className="space-y-1.5">
                  <Label htmlFor="inventory-month">Bulan kartu stok</Label>
                  <Input
                    id="inventory-month"
                    type="month"
                    name="month"
                    max={currentMonth}
                    defaultValue={month}
                  />
                </div>
                <Button type="submit" variant="outline">
                  Tampilkan
                </Button>
              </form>
              <Button asChild variant="outline">
                <a href={`/api/mektek/catalog-inventory/export?month=${month}`}>
                  <Download data-icon="inline-start" />
                  Export Excel
                </a>
              </Button>
            </div>
          </div>
          <div>
            <p className="mb-3 text-sm font-medium">Filter & periode kartu stok</p>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(220px,1.4fr)_160px_180px_200px_150px_130px_auto] xl:items-end">
              <div className="space-y-1.5">
                <Label htmlFor="stock-card-search">Cari seluruh kolom</Label>
                <Input
                  id="stock-card-search"
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Item, machine, part number, lokasi..."
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="stock-card-channel">Channel</Label>
                <Select
                  value={productionChannel || "ALL"}
                  onValueChange={(value) =>
                    setProductionChannel(value === "ALL" ? "" : value)
                  }
                >
                  <SelectTrigger id="stock-card-channel"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Semua channel</SelectItem>
                    <SelectItem value="POWERTRAIN">Powertrain</SelectItem>
                    <SelectItem value="THERMAL">Thermal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="stock-card-movement">Pergerakan</Label>
                <Select
                  value={movementCategory || "ALL"}
                  onValueChange={(value) =>
                    setMovementCategory(
                      value === "ALL" ? "" : (value as CatalogMovementCategory),
                    )
                  }
                >
                  <SelectTrigger id="stock-card-movement"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Semua pergerakan</SelectItem>
                    <SelectItem value="FAST_MOVING">Fast Moving</SelectItem>
                    <SelectItem value="SLOW_MOVING">Slow Moving</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="stock-card-quantity-field">Kolom quantity</Label>
                <Select
                  value={quantityField}
                  onValueChange={(value) =>
                    setQuantityField(value as CatalogInventoryQuantityField)
                  }
                >
                  <SelectTrigger id="stock-card-quantity-field"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TOTAL_CLOSING_STOCK">Total stok akhir</SelectItem>
                    <SelectItem value="CLOSING_REAR_STOCK">Akhir G. Belakang</SelectItem>
                    <SelectItem value="CLOSING_FRONT_STOCK">Akhir G. Depan</SelectItem>
                    <SelectItem value="TOTAL_INBOUND">Total stok masuk</SelectItem>
                    <SelectItem value="TOTAL_OUTBOUND">Total stok keluar</SelectItem>
                    <SelectItem value="OPENING_REAR_STOCK">Awal G. Belakang</SelectItem>
                    <SelectItem value="OPENING_FRONT_STOCK">Awal G. Depan</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="stock-card-operator">Operator</Label>
                <Select
                  value={quantityOperator}
                  onValueChange={(value) =>
                    setQuantityOperator(value as CatalogInventoryQuantityOperator)
                  }
                >
                  <SelectTrigger id="stock-card-operator"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LT">{"Kurang dari (<)"}</SelectItem>
                    <SelectItem value="LTE">{"Maksimal (≤)"}</SelectItem>
                    <SelectItem value="EQ">{"Sama dengan (=)"}</SelectItem>
                    <SelectItem value="GTE">{"Minimal (≥)"}</SelectItem>
                    <SelectItem value="GT">{"Lebih dari (>)"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="stock-card-quantity">Nilai</Label>
                <Input
                  id="stock-card-quantity"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={1}
                  value={quantityValue}
                  onChange={(event) => setQuantityValue(event.target.value)}
                  placeholder="100"
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                disabled={!hasActiveFilters}
                onClick={() => {
                  setQuery("");
                  setProductionChannel("");
                  setMovementCategory("");
                  setQuantityField("TOTAL_CLOSING_STOCK");
                  setQuantityOperator("LT");
                  setQuantityValue("");
                }}
              >
                Reset Filter
              </Button>
            </div>
            <p className="mt-3 text-sm text-muted-foreground" aria-live="polite">
              Menampilkan {filteredItems.length} dari {items.length} item.
            </p>
          </div>
        </CardHeader>
        <CardContent className="min-w-0 p-0">
          <div className="max-h-[70vh] overflow-auto">
            <table className="min-w-max border-collapse text-sm">
              <caption className="sr-only">
                Kartu stok sparepart {monthLabel(month)} dengan stok masuk harian dan saldo dua gudang
              </caption>
              <thead className="sticky top-0 z-20 bg-muted text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="sticky left-0 z-30 min-w-56 border-b border-e bg-muted px-3 py-3 text-left">
                    Item
                  </th>
                  <th className="min-w-28 border-b border-e px-3 py-3 text-left">Channel</th>
                  <th className="min-w-32 border-b border-e px-3 py-3 text-right">Stok Awal Gudang Belakang</th>
                  <th className="min-w-32 border-b border-e px-3 py-3 text-right">Stok Awal Gudang Depan</th>
                  {Array.from({ length: daysInMonth }, (_, index) => (
                    <th
                      key={index + 1}
                      className="w-12 border-b border-e px-1 py-3 text-center font-medium"
                    >
                      {index + 1}
                    </th>
                  ))}
                  <th className="min-w-24 border-b border-e px-3 py-3 text-right">Total Masuk</th>
                  <th className="min-w-24 border-b border-e px-3 py-3 text-right">Total Keluar</th>
                  <th className="min-w-36 border-b border-e px-3 py-3 text-right">Stok Akhir Gudang Belakang</th>
                  <th className="min-w-36 border-b border-e px-3 py-3 text-right">Stok Akhir Gudang Depan</th>
                  <th className="min-w-28 border-b border-e px-3 py-3 text-right">Total Akhir</th>
                  <th className="min-w-28 border-b border-e px-3 py-3 text-left">Pergerakan</th>
                  <th className="min-w-40 border-b border-e px-3 py-3 text-left">Remark</th>
                  <th className="min-w-36 border-b border-e px-3 py-3 text-left">Lokasi B.</th>
                  <th className="min-w-36 border-b border-e px-3 py-3 text-left">Lokasi D.</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => {
                  const inventory = item.inventory;
                  const totalClosingStock =
                    inventory.closingRearStock + inventory.closingFrontStock;
                  const isLowStock = totalClosingStock < LOW_STOCK_THRESHOLD;
                  const movementCategoryValue = getCatalogMovementCategory(
                    inventory.totalOutbound,
                  );
                  return (
                    <tr
                      key={item.id}
                      className={`border-b last:border-b-0 hover:bg-muted/20 ${
                        isLowStock ? "bg-orange-100/70 dark:bg-orange-900/20" : ""
                      }`}
                    >
                      <th scope="row" className="sticky left-0 z-10 border-e bg-card px-3 py-3 text-left font-normal">
                        <Button
                          type="button"
                          variant="link"
                          className="h-auto max-w-56 justify-start gap-1.5 p-0 text-left font-medium"
                          aria-label={`Catat mutasi stok untuk ${item.description}`}
                          title={`Catat mutasi stok untuk ${item.description}`}
                          onClick={() => openMovement(item)}
                        >
                          <ArrowUpDown className="size-3.5 shrink-0" aria-hidden="true" />
                          <span className="truncate">{item.description}</span>
                        </Button>
                        <p className="text-xs text-muted-foreground">
                          {inventory.machine} · {inventory.partNumber || "Tanpa part number"}
                        </p>
                        {isLowStock && (
                          <span
                            className="mt-1 inline-flex items-center gap-1 rounded-md bg-orange-100 px-1.5 py-0.5 text-xs font-medium text-orange-800 dark:bg-orange-900/40 dark:text-orange-200"
                            title={`Total stok akhir ${totalClosingStock} di bawah ambang ${LOW_STOCK_THRESHOLD}`}
                          >
                            <AlertTriangle className="size-3 shrink-0" aria-hidden="true" />
                            Stok Rendah
                          </span>
                        )}
                        {inventory.openingStockEditable && (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="mt-1 h-7 px-2 text-xs"
                            onClick={() => openOpeningStock(item)}
                          >
                            Atur stok awal
                          </Button>
                        )}
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
                      {inventory.dailyMovements.map((daily) => {
                        const hasActivity =
                          daily.inbound.total > 0 || daily.outbound.total > 0;
                        return (
                          <td
                            key={daily.day}
                            className="border-e p-1 text-center font-mono tabular-nums"
                            title={`Masuk: belakang ${daily.inbound.rear}, depan ${daily.inbound.front} · Keluar: belakang ${daily.outbound.rear}, depan ${daily.outbound.front}`}
                          >
                            <div className="flex min-h-10 w-full flex-col items-center justify-center gap-0.5 px-1">
                              {daily.inbound.total > 0 && (
                                <button
                                  type="button"
                                  onClick={() => openHistory(item, daily.day)}
                                  className="rounded px-1 text-xs font-semibold text-emerald-600 hover:bg-emerald-100 dark:text-emerald-400 dark:hover:bg-emerald-900/30"
                                  aria-label={`Riwayat mutasi ${item.description} tanggal ${daily.day} (masuk ${daily.inbound.total})`}
                                >
                                  +{daily.inbound.total}
                                </button>
                              )}
                              {daily.outbound.total > 0 && (
                                <button
                                  type="button"
                                  onClick={() => openHistory(item, daily.day)}
                                  className="rounded px-1 text-xs font-semibold text-destructive hover:bg-red-100 dark:hover:bg-red-900/30"
                                  aria-label={`Riwayat mutasi ${item.description} tanggal ${daily.day} (keluar ${daily.outbound.total})`}
                                >
                                  -{daily.outbound.total}
                                </button>
                              )}
                              {!hasActivity && (
                                <span className="text-muted-foreground/50">—</span>
                              )}
                            </div>
                          </td>
                        );
                      })}
                      <td className="border-e px-3 py-3 text-right font-mono font-semibold tabular-nums">
                        {inventory.totalInbound}
                      </td>
                      <td className="border-e px-3 py-3 text-right font-mono font-semibold tabular-nums">
                        {inventory.totalOutbound}
                      </td>
                      <td className="border-e px-3 py-3 text-right font-mono font-semibold tabular-nums">
                        {inventory.closingRearStock}
                      </td>
                      <td className="border-e px-3 py-3 text-right font-mono font-semibold tabular-nums">
                        {inventory.closingFrontStock}
                      </td>
                      <td className="border-e px-3 py-3 text-right font-mono font-semibold tabular-nums">
                        {totalClosingStock}
                      </td>
                      <td className="border-e px-3 py-3">
                        <Badge
                          variant={
                            movementCategoryValue === "FAST_MOVING"
                              ? "default"
                              : "secondary"
                          }
                          className={
                            movementCategoryValue === "FAST_MOVING"
                              ? "bg-sky-600 hover:bg-sky-600"
                              : "bg-amber-500 hover:bg-amber-500"
                          }
                        >
                          {getCatalogMovementCategoryLabel(movementCategoryValue)}
                        </Badge>
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
                    </tr>
                  );
                })}
                {filteredItems.length === 0 && (
                  <tr>
                    <td colSpan={daysInMonth + 13} className="px-4 py-10 text-center">
                      <p className="text-sm text-muted-foreground">
                        {items.length === 0
                          ? "Belum ada Catalogue Item pada bulan ini."
                          : "Tidak ada item yang cocok dengan filter spreadsheet ini."}
                      </p>
                      {items.length > 0 && hasActiveFilters && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="mt-3"
                          onClick={() => {
                            setQuery("");
                            setProductionChannel("");
                            setMovementCategory("");
                            setQuantityField("TOTAL_CLOSING_STOCK");
                            setQuantityOperator("LT");
                            setQuantityValue("");
                          }}
                        >
                          Reset Filter
                        </Button>
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={movementOpen}
        onOpenChange={(open) => {
          setMovementOpen(open);
          if (!open) setActiveItem(null);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Catat Mutasi Stok</DialogTitle>
            <DialogDescription>
              Pilih tanggal dan jenis mutasi. Saldo item akan dihitung ulang otomatis.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              submitMovement();
            }}
          >
            <div className="rounded-lg border bg-muted/40 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Item terpilih
              </p>
              <p className="mt-1 font-medium">{activeItem?.description}</p>
              <p className="text-xs text-muted-foreground">
                {activeItem?.inventory.machine} · {activeItem?.inventory.partNumber || "Tanpa part number"}
              </p>
            </div>
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
              <Label htmlFor="movement-counterparty">
                {draft.direction === "IN" ? "Dari (sumber masuk)" : "Untuk (tujuan keluar)"}
              </Label>
              <Input
                id="movement-counterparty"
                value={draft.counterpartyName}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    counterpartyName: event.target.value,
                  }))
                }
                disabled={isPending}
                placeholder={
                  draft.direction === "IN"
                    ? "Contoh: supplier / gudang lain"
                    : "Contoh: customer / site / service"
                }
              />
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
              <Button type="submit" disabled={isPending || !activeItem || !draft.quantity}>
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

      <Dialog
        open={historyOpen}
        onOpenChange={(open) => {
          setHistoryOpen(open);
          if (!open) {
            setHistoryItem(null);
            setHistoryDay(null);
            setHistoryMovements([]);
          }
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="size-4" aria-hidden="true" />
              Riwayat Mutasi Stok
            </DialogTitle>
            <DialogDescription>
              {historyItem?.description}
              {historyDay
                ? ` · ${month}-${String(historyDay).padStart(2, "0")}`
                : ""}
            </DialogDescription>
          </DialogHeader>
          {historyLoading ? (
            <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" data-icon="inline-start" />
              Memuat riwayat...
            </div>
          ) : historyMovements.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Tidak ada mutasi tercatat pada tanggal ini.
            </p>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              <table className="w-full border-collapse text-sm">
                <thead className="sticky top-0 bg-muted/50 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="border-b border-e px-3 py-2 text-left">Waktu</th>
                    <th className="border-b border-e px-3 py-2 text-left">Gudang</th>
                    <th className="border-b border-e px-3 py-2 text-left">Jenis</th>
                    <th className="border-b border-e px-3 py-2 text-right">Qty</th>
                    <th className="border-b border-e px-3 py-2 text-left">Dari / Untuk</th>
                    <th className="border-b border-e px-3 py-2 text-left">Sumber</th>
                    <th className="border-b px-3 py-2 text-left">Catatan</th>
                  </tr>
                </thead>
                <tbody>
                  {historyMovements.map((movement) => (
                    <tr key={movement.id} className="border-b last:border-b-0">
                      <td className="border-e px-3 py-2 align-top text-xs">
                        {formatHistoryTime(movement.occurredAt)}
                      </td>
                      <td className="border-e px-3 py-2 align-top">
                        {movement.warehouse === "REAR" ? "Belakang" : "Depan"}
                      </td>
                      <td className="border-e px-3 py-2 align-top">
                        <Badge
                          variant={movement.direction === "IN" ? "secondary" : "outline"}
                          className={
                            movement.direction === "IN"
                              ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-300"
                              : "bg-red-100 text-red-700 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-300"
                          }
                        >
                          {movement.direction === "IN" ? "Masuk" : "Keluar"}
                        </Badge>
                      </td>
                      <td className="border-e px-3 py-2 text-right align-top font-mono tabular-nums">
                        {movement.quantity}
                      </td>
                      <td className="border-e px-3 py-2 align-top text-xs">
                        {movement.counterpartyName ||
                          movement.consignmentSiteName ||
                          "-"}
                      </td>
                      <td className="border-e px-3 py-2 align-top text-xs">
                        {STOCK_MOVEMENT_SOURCE_LABEL[movement.source] ?? movement.source}
                      </td>
                      <td className="px-3 py-2 align-top text-xs text-muted-foreground">
                        {movement.note || "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
