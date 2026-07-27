"use client";

import { Download, LoaderCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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

type ExportMode = "all" | "range" | "year";

interface ReceivingExportButtonProps {
  baseQuery: string;
}

function getDownloadFilename(response: Response, fallback: string) {
  const disposition = response.headers.get("content-disposition") ?? "";
  const match = /filename="?([^";]+)"?/i.exec(disposition);
  return match?.[1] || `mektek-receiving-po-${fallback}.xlsx`;
}

export default function ReceivingExportButton({
  baseQuery,
}: ReceivingExportButtonProps) {
  const currentMonth = getCatalogInventoryLocalDateKey().slice(0, 7);
  const currentYear = currentMonth.slice(0, 4);
  const [mode, setMode] = useState<ExportMode>("all");
  const [fromMonth, setFromMonth] = useState(currentMonth);
  const [toMonth, setToMonth] = useState(currentMonth);
  const [year, setYear] = useState(currentYear);
  const [isExporting, setIsExporting] = useState(false);

  const buildUrl = () => {
    const params = new URLSearchParams(baseQuery);
    if (mode === "range") {
      params.set("fromMonth", fromMonth);
      params.set("toMonth", toMonth);
    } else if (mode === "year" && year) {
      params.set("year", year);
    }
    const suffix = params.toString();
    return `/api/mektek/receiving/purchase-orders/export${suffix ? `?${suffix}` : ""}`;
  };

  const label =
    mode === "range"
      ? fromMonth === toMonth
        ? fromMonth
        : `${fromMonth}_${toMonth}`
      : mode === "year"
        ? year
        : "semua";

  const handleExport = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const response = await fetch(buildUrl());
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(payload?.error || "Gagal menyiapkan export Excel");
      }
      const objectUrl = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = getDownloadFilename(response, label);
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
      toast.success(`Export Receiving ${label} berhasil disiapkan`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Gagal export Receiving",
      );
    } finally {
      setIsExporting(false);
    }
  };

  const canExport =
    mode === "all" ||
    (mode === "range" && fromMonth && toMonth) ||
    (mode === "year" && year);

  return (
    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-end">
      <div className="space-y-1">
        <Label htmlFor="receiving-export-mode">Rentang export</Label>
        <Select value={mode} onValueChange={(value) => setMode(value as ExportMode)}>
          <SelectTrigger id="receiving-export-mode" className="sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua (filter aktif)</SelectItem>
            <SelectItem value="range">Rentang bulan</SelectItem>
            <SelectItem value="year">Per tahun</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {mode === "range" && (
        <>
          <div className="space-y-1">
            <Label htmlFor="receiving-export-from">Dari bulan</Label>
            <Input
              id="receiving-export-from"
              type="month"
              value={fromMonth}
              max={toMonth || currentMonth}
              onChange={(event) => setFromMonth(event.target.value)}
              disabled={isExporting}
              className="sm:w-44"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="receiving-export-to">Sampai bulan</Label>
            <Input
              id="receiving-export-to"
              type="month"
              value={toMonth}
              min={fromMonth}
              max={currentMonth}
              onChange={(event) => setToMonth(event.target.value)}
              disabled={isExporting}
              className="sm:w-44"
            />
          </div>
        </>
      )}
      {mode === "year" && (
        <div className="space-y-1">
          <Label htmlFor="receiving-export-year">Tahun export</Label>
          <Input
            id="receiving-export-year"
            type="number"
            min={2000}
            max={Number(currentYear)}
            value={year}
            onChange={(event) => setYear(event.target.value)}
            disabled={isExporting}
            className="sm:w-32"
          />
        </div>
      )}
      <Button
        type="button"
        variant="outline"
        onClick={handleExport}
        disabled={!canExport || isExporting}
      >
        {isExporting ? (
          <LoaderCircle className="animate-spin" aria-hidden="true" />
        ) : (
          <Download aria-hidden="true" />
        )}
        {isExporting ? "Menyiapkan..." : "Export Excel"}
      </Button>
    </div>
  );
}
