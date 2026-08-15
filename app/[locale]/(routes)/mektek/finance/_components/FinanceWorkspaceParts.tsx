import type { ReactNode } from "react";
import Link from "next/link";
import { AlertTriangle, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import { FinancePeriodFilter } from "./FinancePeriodFilter";
import {
  type FinancePeriodFilter as FinancePeriodFilterValue,
} from "../_lib/period-filter";

const money = (value: unknown) =>
  Number(value ?? 0).toLocaleString("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  });

export type FinanceRevenueInspection = {
  id: string;
  invoiceNumber: string;
  customer: string;
  descriptions: string[];
};

export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}

export function Header({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div>
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

export function StickyFilterBar({ children }: { children: ReactNode }) {
  return (
    <div className="md:sticky md:top-0 md:z-30 md:-mt-4 md:bg-background md:px-6 md:pb-3 md:pt-4 md:-mx-6 md:border-b">
      {children}
    </div>
  );
}

/**
 * Sticky search + period filter bar shared by the four recap pages. The search
 * form carries the active period as hidden fields (and vice-versa) so changing
 * one filter never resets the other. The create button is passed in as a slot
 * so each page keeps its own `RecapCreateButton` instance.
 */
export function PeriodFilterBar({
  query,
  placeholder,
  period,
  action,
  createButton,
}: {
  query: string;
  placeholder: string;
  period: FinancePeriodFilterValue;
  action: string;
  createButton?: ReactNode;
}) {
  return (
    <StickyFilterBar>
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <ReportFilter
            query={query}
            placeholder={placeholder}
            period={period}
          />
          {createButton}
        </div>
        <FinancePeriodFilter
          query={query}
          mode={period.mode}
          month={period.month}
          fromMonth={period.fromMonth}
          toMonth={period.toMonth}
          year={period.year}
          action={action}
        />
      </div>
    </StickyFilterBar>
  );
}

/**
 * Period totals card — surfaces the revenue/ receivable totals for the active
 * period (single month, month range, or whole year), plus the period label.
 */
export function PeriodTotalsCard({
  periodLabel,
  totals,
}: {
  periodLabel: string;
  totals: Array<{ label: string; value: string; emphasis?: boolean }>;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
          <span>Ringkasan periode</span>
          <Badge variant="secondary">{periodLabel}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {totals.map((entry) => (
            <div key={entry.label} className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">{entry.label}</p>
              <p
                className={cn(
                  "mt-1 text-lg font-semibold tabular-nums",
                  entry.emphasis && "text-primary",
                )}
              >
                {entry.value}
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function ReportFilter({
  query,
  placeholder = "Cari data rekap",
  classification = "",
  period,
}: {
  query: string;
  placeholder?: string;
  classification?: string;
  period?: FinancePeriodFilterValue;
}) {
  return (
    <form className="flex max-w-xl gap-2">
      {classification ? (
        <input type="hidden" name="classification" value={classification} />
      ) : null}
      {period && period.mode !== "all" ? (
        <>
          <input type="hidden" name="periodMode" value={period.mode} />
          {period.mode === "month" && period.month ? (
            <input type="hidden" name="month" value={period.month} />
          ) : null}
          {period.mode === "range" ? (
            <>
              {period.fromMonth ? (
                <input type="hidden" name="fromMonth" value={period.fromMonth} />
              ) : null}
              {period.toMonth ? (
                <input type="hidden" name="toMonth" value={period.toMonth} />
              ) : null}
            </>
          ) : null}
          {period.mode === "year" && period.year ? (
            <input type="hidden" name="year" value={period.year} />
          ) : null}
        </>
      ) : null}
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          name="q"
          type="search"
          defaultValue={query}
          className="pl-9"
          placeholder={placeholder}
        />
      </div>
      <Button type="submit" variant="outline">
        Filter
      </Button>
      {query ? (
        <Button type="submit" name="q" value="" variant="ghost">
          Reset
        </Button>
      ) : null}
    </form>
  );
}

export function RevenueClassificationWarning({
  count,
  subtotal,
  invoices,
}: {
  count: number;
  subtotal: number;
  invoices: FinanceRevenueInspection[];
}) {
  return (
    <div className="flex gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="font-medium">Ada jenis pengeluaran yang belum dapat dipisahkan</p>
        <p>
          {count.toLocaleString("id-ID")} invoice senilai {money(subtotal)} memuat
          deskripsi campuran atau tidak jelas. Rinci menjadi baris jasa dan spare part
          agar pendapatannya masuk otomatis tanpa salah hitung.
        </p>
        <div className="mt-3 space-y-2">
          {invoices.slice(0, 5).map((invoice) => (
            <Link
              key={invoice.id}
              href={`/mektek/finance/invoices?classification=unclassified&inspect=${encodeURIComponent(invoice.id)}`}
              className="block rounded-md border border-amber-300 bg-white/70 px-3 py-2 transition hover:bg-white"
            >
              <span className="font-medium">
                {invoice.invoiceNumber} · {invoice.customer}
              </span>
              <span className="mt-0.5 block truncate text-xs text-amber-800">
                Deskripsi perlu diperiksa:{" "}
                {invoice.descriptions.join("; ") || "Tidak ada deskripsi"}
              </span>
            </Link>
          ))}
        </div>
        <Button asChild size="sm" variant="outline" className="mt-3 bg-white">
          <Link href="/mektek/finance/invoices?classification=unclassified">
            Periksa semua {count.toLocaleString("id-ID")} invoice
          </Link>
        </Button>
      </div>
    </div>
  );
}

export { money };
