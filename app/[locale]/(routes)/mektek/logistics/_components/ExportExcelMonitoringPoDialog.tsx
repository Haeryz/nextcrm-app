"use client";

import { useState } from "react";
import { Download, FileSpreadsheet } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { getCatalogInventoryLocalDateKey } from "@/lib/mektek/catalog-inventory";
import {
  getLogisticsPoExportRange,
  type LogisticsPoExportType,
} from "@/lib/mektek/logistics-export";

export function ExportExcelMonitoringPoDialog() {
  const currentMonth = getCatalogInventoryLocalDateKey().slice(0, 7);
  const currentYear = currentMonth.slice(0, 4);
  const [exportMode, setExportMode] = useState<"month" | "range" | "year">(
    "month",
  );
  const [exportMonth, setExportMonth] = useState(currentMonth);
  const [exportFromMonth, setExportFromMonth] = useState(currentMonth);
  const [exportToMonth, setExportToMonth] = useState(currentMonth);
  const [exportYear, setExportYear] = useState(currentYear);
  const [exportType, setExportType] =
    useState<LogisticsPoExportType>("delivery-note");

  let exportRangeError: string | null = null;
  let exportHref = "";
  try {
    if (exportMode === "range") {
      getLogisticsPoExportRange(exportFromMonth, exportToMonth);
      exportHref = `/api/mektek/logistics/purchase-orders/export?type=${encodeURIComponent(exportType)}&fromMonth=${encodeURIComponent(exportFromMonth)}&toMonth=${encodeURIComponent(exportToMonth)}`;
    } else if (exportMode === "year") {
      const parsedYear = Number(exportYear);
      if (!Number.isInteger(parsedYear) || parsedYear < 2000 || parsedYear > 9999) {
        throw new Error("Tahun export tidak valid");
      }
      exportHref = `/api/mektek/logistics/purchase-orders/export?type=${encodeURIComponent(exportType)}&year=${encodeURIComponent(exportYear)}`;
    } else {
      getLogisticsPoExportRange(exportMonth, exportMonth);
      exportHref = `/api/mektek/logistics/purchase-orders/export?type=${encodeURIComponent(exportType)}&month=${encodeURIComponent(exportMonth)}`;
    }
  } catch (error) {
    exportRangeError =
      error instanceof Error ? error.message : "Periode export tidak valid";
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="outline">
          <FileSpreadsheet data-icon="inline-start" />
          Export Excel
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Export Excel Monitoring PO</DialogTitle>
          <DialogDescription>
            Pilih jenis recap dan bulan yang ingin dimasukkan ke file
            Excel.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="po-export-type">Jenis recap</Label>
            <Select
              value={exportType}
              onValueChange={(value: LogisticsPoExportType) =>
                setExportType(value)
              }
            >
              <SelectTrigger id="po-export-type" className="w-full">
                <SelectValue placeholder="Pilih jenis recap" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="delivery-note">
                  Recap Bulanan (SJ)
                </SelectItem>
                <SelectItem value="purchase-order">
                  Recap PO Bulanan (PO/User)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="po-export-mode">Rentang export</Label>
            <Select
              value={exportMode}
              onValueChange={(value: "month" | "range" | "year") =>
                setExportMode(value)
              }
            >
              <SelectTrigger id="po-export-mode" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="month">Per bulan</SelectItem>
                <SelectItem value="range">Rentang bulan</SelectItem>
                <SelectItem value="year">Per tahun</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        {exportMode === "month" && (
          <div className="space-y-1.5">
            <Label htmlFor="po-export-month">Bulan</Label>
            <Input
              id="po-export-month"
              type="month"
              max={currentMonth}
              value={exportMonth}
              onChange={(event) => setExportMonth(event.target.value)}
            />
          </div>
        )}
        {exportMode === "range" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="po-export-from">Dari bulan</Label>
              <Input
                id="po-export-from"
                type="month"
                max={exportToMonth || currentMonth}
                value={exportFromMonth}
                onChange={(event) => setExportFromMonth(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="po-export-to">Sampai bulan</Label>
              <Input
                id="po-export-to"
                type="month"
                min={exportFromMonth}
                max={currentMonth}
                value={exportToMonth}
                onChange={(event) => setExportToMonth(event.target.value)}
              />
            </div>
          </div>
        )}
        {exportMode === "year" && (
          <div className="space-y-1.5">
            <Label htmlFor="po-export-year">Tahun</Label>
            <Input
              id="po-export-year"
              type="number"
              min={2000}
              max={Number(currentYear)}
              value={exportYear}
              onChange={(event) => setExportYear(event.target.value)}
            />
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          {exportRangeError ??
            (exportType === "delivery-note"
              ? "Recap dikelompokkan berdasarkan nomor SJ; satu SJ dapat berisi beberapa baris item."
              : "Recap dikelompokkan berdasarkan nomor PO; nomor urut tetap sama untuk seluruh item dalam satu PO.")}
        </p>
        <div className="flex justify-end">
          {exportRangeError ? (
            <Button type="button" disabled>
              <Download data-icon="inline-start" /> Download Excel
            </Button>
          ) : (
            <Button asChild type="button">
              <a href={exportHref}>
                <Download data-icon="inline-start" /> Download Excel
              </a>
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
