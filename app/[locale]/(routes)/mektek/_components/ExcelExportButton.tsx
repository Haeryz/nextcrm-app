"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import * as XLSX from "xlsx";

interface ServiceOrder {
  id: string;
  title?: string | null;
  taskStatus?: string | null;
  dueDateAt?: Date | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
  tags?: unknown;
  crm_accounts?: { name?: string | null; office_phone?: string | null } | null;
}

interface ExcelExportButtonProps {
  orders: ServiceOrder[];
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

        return {
          ID: order.id,
          "Nama Customer": order.crm_accounts?.name ?? "",
          Kendaraan: typeof tags.vehicle === "string" ? tags.vehicle : "",
          Telepon:
            typeof tags.phone === "string"
              ? tags.phone
              : (order.crm_accounts?.office_phone ?? ""),
          Alamat: typeof tags.address === "string" ? tags.address : "",
          Status: order.taskStatus ?? "",
          Keluhan: typeof order.title === "string" ? order.title.replace("MEKTEK AC - ", "") : "",
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
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Service Orders");

      const colWidths = [
        { wch: 36 }, { wch: 24 }, { wch: 22 }, { wch: 18 },
        { wch: 30 }, { wch: 12 }, { wch: 30 }, { wch: 18 },
        { wch: 18 }, { wch: 18 }, { wch: 16 },
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
