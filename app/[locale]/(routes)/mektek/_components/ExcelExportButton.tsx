"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import * as XLSX from "xlsx";
import { normalizeMektekLineItems } from "@/lib/mektek/items";

interface ServiceOrder {
  id: string;
  title?: string | null;
  taskStatus?: string | null;
  dueDateAt?: Date | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
  content?: string | null;
  tags?: unknown;
}

interface ExcelExportButtonProps {
  orders: ServiceOrder[];
}

const SERVICE_TITLE_PREFIXES = ["MEKTEK Service - ", "MEKTEK AC - "];

function stripServicePrefix(title: string) {
  const prefix = SERVICE_TITLE_PREFIXES.find((item) => title.startsWith(item));
  return prefix ? title.slice(prefix.length) : title;
}

export default function ExcelExportButton({ orders }: ExcelExportButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleExport = () => {
    setLoading(true);
    try {
      const rows = orders.map((order) => {
        const tags =
          order.tags && typeof order.tags === "object" && !Array.isArray(order.tags)
            ? (order.tags as Record<string, unknown>)
            : {};
        const normalizedItems = normalizeMektekLineItems(tags, order.content);

        return {
          ID: order.id,
          "Nama Customer":
            typeof tags.customerName === "string"
              ? tags.customerName
              : "",
          Kendaraan: typeof tags.vehicle === "string" ? tags.vehicle : "",
          Telepon:
            typeof tags.phone === "string"
              ? tags.phone
              : "",
          Alamat: typeof tags.address === "string" ? tags.address : "",
          Status: order.taskStatus ?? "",
          Keluhan: typeof order.title === "string" ? stripServicePrefix(order.title) : "",
          "Estimasi Selesai": order.dueDateAt
            ? new Date(order.dueDateAt).toLocaleDateString("id-ID")
            : "",
          "Tanggal Masuk": order.createdAt
            ? new Date(order.createdAt).toLocaleDateString("id-ID")
            : "",
          "Terakhir Update": order.updatedAt
            ? new Date(order.updatedAt).toLocaleDateString("id-ID")
            : "",
          "Jumlah Timeline": Array.isArray(tags.timeline) ? tags.timeline.length : 0,
          "Jumlah Item Servis": normalizedItems.serviceItems.length,
          "Jumlah Sparepart": normalizedItems.sparepartItems.length,
          "Subtotal Servis": normalizedItems.serviceSubtotal,
          "Subtotal Sparepart": normalizedItems.sparepartSubtotal,
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Service Orders");

      const colWidths = [
        { wch: 36 }, { wch: 24 }, { wch: 22 }, { wch: 18 },
        { wch: 30 }, { wch: 12 }, { wch: 30 }, { wch: 18 },
        { wch: 18 }, { wch: 18 }, { wch: 16 }, { wch: 18 },
        { wch: 18 }, { wch: 18 }, { wch: 20 },
      ];
      worksheet["!cols"] = colWidths;

      const date = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(workbook, `mektek-service-orders-${date}.xlsx`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleExport}
      disabled={loading || orders.length === 0}
    >
      <Download className="w-4 h-4 mr-2" />
      {loading ? "Exporting..." : "Export Excel"}
    </Button>
  );
}
