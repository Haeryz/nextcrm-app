"use client";

import { Download, LoaderCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getMektekServiceOrderExportMonthKey } from "@/lib/mektek/service-order-export";

interface ExcelExportButtonProps {
  initialMonth: string;
}

function getDownloadFilename(response: Response, month: string) {
  const disposition = response.headers.get("content-disposition") ?? "";
  const match = /filename="?([^";]+)"?/i.exec(disposition);
  return match?.[1] || `mektek-service-orders-${month}.xlsx`;
}

export default function ExcelExportButton({
  initialMonth,
}: ExcelExportButtonProps) {
  const [month, setMonth] = useState(initialMonth);
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    if (!month || isExporting) return;
    setIsExporting(true);
    try {
      const response = await fetch(
        `/api/mektek/service-orders/export?month=${encodeURIComponent(month)}`,
      );
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(payload?.error || "Gagal menyiapkan export Excel");
      }

      const objectUrl = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = getDownloadFilename(response, month);
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
      toast.success(`Export order ${month} berhasil disiapkan`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Gagal export order",
      );
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-end">
      <div className="space-y-1">
        <Label htmlFor="service-order-export-month">Bulan export</Label>
        <Input
          id="service-order-export-month"
          type="month"
          value={month}
          max={getMektekServiceOrderExportMonthKey()}
          onChange={(event) => setMonth(event.target.value)}
          disabled={isExporting}
          className="sm:w-44"
        />
      </div>
      <Button
        type="button"
        variant="outline"
        onClick={handleExport}
        disabled={!month || isExporting}
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
