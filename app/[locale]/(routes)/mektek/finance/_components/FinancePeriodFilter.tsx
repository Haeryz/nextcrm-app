"use client";

import { useState } from "react";

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
import type { FinancePeriodMode } from "../_lib/period-filter";

interface FinancePeriodFilterProps {
  /** Current search query — preserved as a hidden field when submitting. */
  query: string;
  mode: FinancePeriodMode;
  month: string;
  fromMonth: string;
  toMonth: string;
  year: string;
  /** GET form action — the current page path (e.g. "/mektek/finance/receivables"). */
  action: string;
}

const ALL_MODES: Array<{ value: FinancePeriodMode; label: string }> = [
  { value: "all", label: "Semua periode" },
  { value: "month", label: "Per bulan" },
  { value: "range", label: "Rentang bulan" },
  { value: "year", label: "Per tahun" },
];

export function FinancePeriodFilter({
  query,
  mode,
  month,
  fromMonth,
  toMonth,
  year,
  action,
}: FinancePeriodFilterProps) {
  const currentYear = String(new Date().getFullYear());
  const [pendingMode, setPendingMode] = useState<FinancePeriodMode>(mode);

  return (
    <form
      action={action}
      method="get"
      className="flex w-full flex-col gap-2 lg:flex-row lg:items-end"
    >
      {/* Preserve the active search query across period changes. */}
      {query ? <input type="hidden" name="q" value={query} /> : null}
      <input type="hidden" name="periodMode" value={pendingMode} />

      <div className="space-y-1">
        <Label htmlFor="finance-period-mode">Rentang waktu</Label>
        <Select
          value={pendingMode}
          onValueChange={(value) =>
            setPendingMode(value as FinancePeriodMode)
          }
        >
          <SelectTrigger id="finance-period-mode" className="sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ALL_MODES.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {pendingMode === "month" ? (
        <div className="space-y-1">
          <Label htmlFor="finance-period-month">Bulan</Label>
          <Input
            id="finance-period-month"
            type="month"
            name="month"
            defaultValue={month}
            className="sm:w-44"
          />
        </div>
      ) : null}

      {pendingMode === "range" ? (
        <>
          <div className="space-y-1">
            <Label htmlFor="finance-period-from">Dari bulan</Label>
            <Input
              id="finance-period-from"
              type="month"
              name="fromMonth"
              defaultValue={fromMonth}
              className="sm:w-44"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="finance-period-to">Sampai bulan</Label>
            <Input
              id="finance-period-to"
              type="month"
              name="toMonth"
              defaultValue={toMonth}
              className="sm:w-44"
            />
          </div>
        </>
      ) : null}

      {pendingMode === "year" ? (
        <div className="space-y-1">
          <Label htmlFor="finance-period-year">Tahun</Label>
          <Input
            id="finance-period-year"
            type="number"
            name="year"
            min={2000}
            max={Number(currentYear)}
            defaultValue={year || currentYear}
            className="sm:w-32"
          />
        </div>
      ) : null}

      <Button type="submit" variant="outline">
        Terapkan
      </Button>
      {mode !== "all" ? (
        <Button type="submit" name="periodMode" value="all" variant="ghost">
          Reset
        </Button>
      ) : null}
    </form>
  );
}
