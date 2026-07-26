"use client";

import { FormEvent, useEffect, useState, useTransition } from "react";
import dynamic from "next/dynamic";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  BellRing,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  Filter,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { deleteSupplierDebtEntry } from "@/actions/mektek/supplier-debt-report";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type {
  SupplierDebtDetailEntry,
  SupplierDebtDetailSheet,
  SupplierDebtMonthlySummary,
  SupplierDebtOverviewRow,
  SupplierDebtRecapEntry,
  SupplierDebtStatus,
} from "@/lib/mektek/supplier-debt-report";
import { supplierDebtDueState } from "@/lib/mektek/supplier-debt-ledger";

import SupplierDebtEntryDialog from "./SupplierDebtEntryDialog";
import SupplierDebtTransactionDialog from "./SupplierDebtTransactionDialog";

// Split out of this route's bundle: the chart is a ~525-line SVG component that
// renders below the fold on both the recap and detail views. The skeleton
// matches the `variant="market"` layout used here (header + 4-up stat row +
// 280px plot area) at each breakpoint so the swap-in causes no layout shift.
const PaymentFakturTrendChart = dynamic(
  () => import("./PaymentFakturTrendChart"),
  {
    ssr: false,
    loading: () => (
      <div
        aria-hidden
        className="h-[686px] animate-pulse rounded-xl border border-slate-800 bg-slate-900/40 sm:h-[626px] lg:h-[524px]"
      />
    ),
  },
);

type ReportView = "overview" | "recap" | "detail";

type SheetOption = Pick<
  SupplierDebtDetailSheet,
  | "sheetKey"
  | "supplierName"
  | "contactName"
  | "paymentTermDays"
  | "phone"
  | "bankAccount"
  | "bankAccountName"
  | "bankName"
> & {
  entryCount: number;
};

type Summary = {
  total: number;
  paid: number;
  remaining: number;
  count: number;
  LUNAS?: number;
  CICILAN?: number;
  BELUM_BAYAR?: number;
};

const rupiah = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

const dateFormatter = new Intl.DateTimeFormat("id-ID", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const dateLabel = (value: string | null) =>
  value ? dateFormatter.format(new Date(`${value}T00:00:00.000Z`)) : "—";

const statusLabel: Record<SupplierDebtStatus, string> = {
  BELUM_BAYAR: "Belum dibayar",
  CICILAN: "Cicilan",
  LUNAS: "Lunas",
};

const statusBadge: Record<SupplierDebtStatus, string> = {
  BELUM_BAYAR: "bg-rose-100 text-rose-800 hover:bg-rose-100",
  CICILAN: "bg-amber-100 text-amber-800 hover:bg-amber-100",
  LUNAS: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100",
};

function SummaryCards({
  items,
}: {
  items: Array<[label: string, value: string]>;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {items.map(([label, value]) => (
        <div key={label} className="rounded-lg border bg-card p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className="mt-1 text-lg font-semibold">{value}</p>
        </div>
      ))}
    </div>
  );
}

export default function SupplierDebtReportManager({
  sourceFile,
  view,
  overviewMeta,
  overviewRows,
  overviewSummary,
  recapRows,
  recapSummary,
  recapMonthlySummary,
  sheets,
  selectedSheetKey,
  detailRows,
  detailSummary,
  depositBalance,
  dueAlertSummary,
  recentTransactions,
  monthlyTotals,
  search,
  status,
  sort,
  direction,
  page,
  pageCount,
  totalRows,
}: {
  sourceFile: string;
  view: ReportView;
  overviewMeta: {
    title: string;
    period: string | null;
    updatedAt: string | null;
  };
  overviewRows: SupplierDebtOverviewRow[];
  overviewSummary: Summary;
  recapRows: SupplierDebtRecapEntry[];
  recapSummary: Summary;
  recapMonthlySummary: SupplierDebtMonthlySummary[];
  sheets: SheetOption[];
  selectedSheetKey: string | null;
  detailRows: SupplierDebtDetailEntry[];
  detailSummary: Summary;
  depositBalance: number;
  dueAlertSummary: { overdue: number; dueSoon: number };
  recentTransactions: Array<{
    id: string;
    sourceRow: number | null;
    kind: "DEPOSIT" | "PAYMENT";
    paymentSource: "CASH" | "DEPOSIT" | null;
    amount: number;
    transactionDate: string;
    reference: string | null;
    note: string | null;
  }>;
  monthlyTotals: number[];
  search: string;
  status: "SEMUA" | SupplierDebtStatus;
  sort: string;
  direction: "asc" | "desc";
  page: number;
  pageCount: number;
  totalRows: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [searchValue, setSearchValue] = useState(search);
  const selectedSheet = sheets.find(
    (sheet) => sheet.sheetKey === selectedSheetKey,
  );
  const selectedSupplierName = selectedSheet?.supplierName;
  useEffect(() => {
    const totalAlerts = dueAlertSummary.overdue + dueAlertSummary.dueSoon;
    if (!selectedSupplierName || totalAlerts === 0) return;
    toast.warning(
      `${selectedSupplierName}: ${dueAlertSummary.overdue} lewat jatuh tempo, ${dueAlertSummary.dueSoon} segera jatuh tempo`,
    );
  }, [
    dueAlertSummary.dueSoon,
    dueAlertSummary.overdue,
    selectedSupplierName,
  ]);

  const setQuery = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    startTransition(() => router.push(`${pathname}?${params.toString()}`));
  };

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    setQuery({ q: searchValue.trim() || null, page: null });
  };

  const resetFilters = () => {
    setSearchValue("");
    setQuery({
      q: null,
      status: null,
      sort: null,
      direction: null,
      page: null,
    });
  };

  const deleteManualEntry = (row: SupplierDebtDetailEntry) => {
    if (!row.id || !window.confirm("Hapus baris hutang pemasok ini?")) return;
    startTransition(async () => {
      const result = await deleteSupplierDebtEntry(row.id!);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Baris hutang pemasok berhasil dihapus");
      router.refresh();
    });
  };

  const filterPanel = (
    <div className="rounded-xl border bg-card p-3 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <Filter className="h-4 w-4 text-primary" />
        <div>
          <p className="text-sm font-semibold">Filter dan urutkan tabel</p>
          <p className="text-xs text-muted-foreground">
            Pencarian berlaku pada laporan yang sedang aktif.
          </p>
        </div>
      </div>
      <div
        className={
          view === "detail"
            ? "grid gap-2 lg:grid-cols-[minmax(280px,1fr)_190px_200px_auto_auto]"
            : "grid gap-2 lg:grid-cols-[minmax(280px,1fr)_220px_auto_auto]"
        }
      >
        <form className="flex gap-2" onSubmit={submitSearch}>
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              placeholder={
                view === "overview"
                  ? "Cari pemasok, PIC, lokasi, atau catatan"
                  : "Cari pemasok, invoice, PO, SJ, atau deskripsi"
              }
            />
          </div>
          <Button type="submit" variant="outline" disabled={pending}>
            Cari
          </Button>
        </form>
        {view === "detail" && (
          <select
            className="h-10 rounded-md border bg-background px-3 text-sm"
            value={status}
            onChange={(event) =>
              setQuery({ status: event.target.value, page: null })
            }
            aria-label="Filter status hutang"
            disabled={pending}
          >
            <option value="SEMUA">Semua status</option>
            <option value="BELUM_BAYAR">Belum dibayar</option>
            <option value="CICILAN">Cicilan</option>
            <option value="LUNAS">Lunas</option>
          </select>
        )}
        <select
          className="h-10 rounded-md border bg-background px-3 text-sm"
          value={sort}
          onChange={(event) =>
            setQuery({ sort: event.target.value, page: null })
          }
          aria-label="Urutkan laporan berdasarkan"
          disabled={pending}
        >
          <option value="number">Nomor urut</option>
          {view === "overview" ? (
            <>
              <option value="supplierName">Nama pemasok</option>
              <option value="remainingDebt">Sisa hutang</option>
              <option value="dueAmount">Jatuh tempo</option>
            </>
          ) : (
            <>
              <option value="supplierName">Nama pemasok</option>
              <option value="invoiceDate">Tanggal invoice</option>
              <option value="invoiceNumber">Nomor invoice</option>
              <option value="grandTotal">Nilai invoice</option>
              <option value="paymentAmount">Nilai dibayar</option>
              <option value="remainingAmount">Sisa hutang</option>
            </>
          )}
        </select>
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            setQuery({
              direction: direction === "asc" ? "desc" : "asc",
              page: null,
            })
          }
          disabled={pending}
        >
          {direction === "asc" ? (
            <ArrowUp className="mr-2 h-4 w-4" />
          ) : (
            <ArrowDown className="mr-2 h-4 w-4" />
          )}
          {direction === "asc" ? "Menaik" : "Menurun"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={resetFilters}
          disabled={pending}
        >
          Reset
        </Button>
      </div>
    </div>
  );

  const pagination = (
    <div className="flex flex-col gap-2 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
      <span>
        {totalRows} baris · halaman {page} dari {pageCount}
      </span>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={page <= 1 || pending}
          onClick={() => setQuery({ page: String(page - 1) })}
        >
          <ChevronLeft className="mr-1 h-4 w-4" /> Sebelumnya
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={page >= pageCount || pending}
          onClick={() => setQuery({ page: String(page + 1) })}
        >
          Berikutnya <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-5 px-4 pb-8 sm:px-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <FileSpreadsheet className="h-4 w-4" />
            Laporan keuangan 2026
          </div>
          <h2 className="mt-1 text-xl font-semibold">
            Laporan Hutang Pemasok
          </h2>
          <p className="text-xs text-muted-foreground">
            Sumber: {sourceFile}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            ["overview", "Total Hutang"],
            ["recap", "Rekap Hutang"],
            ["detail", "Rincian per Pemasok"],
          ].map(([value, label]) => (
            <Button
              key={value}
              type="button"
              variant={view === value ? "default" : "outline"}
              onClick={() =>
                setQuery({
                  view: value,
                  q: null,
                  status: null,
                  sort: null,
                  direction: null,
                  page: null,
                })
              }
              disabled={pending}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      {view === "overview" && (
        <>
          <div>
            <p className="text-sm text-muted-foreground">
              {overviewMeta.period || "Periode laporan 2026"}
            </p>
            <h3 className="text-lg font-semibold">{overviewMeta.title}</h3>
            <p className="text-xs text-muted-foreground">
              {overviewMeta.updatedAt || "Tanggal pembaruan mengikuti workbook"}
            </p>
          </div>
          <SummaryCards
            items={[
              ["Total sisa hutang", rupiah.format(overviewSummary.total)],
              ["Total sisa piutang", rupiah.format(overviewSummary.paid)],
              ["Tagihan jatuh tempo", rupiah.format(overviewSummary.remaining)],
              ["Jumlah pemasok", `${overviewSummary.count} pemasok`],
            ]}
          />
          {filterPanel}
          <div className="overflow-hidden rounded-lg border">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1500px] text-sm">
                <thead className="bg-muted/60 text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-3">No.</th>
                    <th className="px-3 py-3">Nama pemasok</th>
                    <th className="px-3 py-3">PIC</th>
                    <th className="px-3 py-3">Lokasi</th>
                    <th className="px-3 py-3 text-right">Sisa hutang</th>
                    <th className="px-3 py-3 text-right">Sisa piutang</th>
                    <th className="px-3 py-3 text-right">TOP</th>
                    <th className="px-3 py-3 text-right">Jatuh tempo</th>
                    <th className="px-3 py-3">Catatan jatuh tempo</th>
                    <th className="px-3 py-3">Rincian</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {overviewRows.map((row) => (
                    <tr key={row.sourceRow} className="align-top hover:bg-muted/30">
                      <td className="px-3 py-3 text-muted-foreground">
                        {row.number}
                      </td>
                      <td className="px-3 py-3 font-medium">{row.supplierName}</td>
                      <td className="px-3 py-3">{row.pic || "—"}</td>
                      <td className="px-3 py-3">{row.location || "—"}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-right font-medium">
                        {rupiah.format(row.remainingDebt)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-right">
                        {rupiah.format(row.remainingReceivable)}
                      </td>
                      <td className="px-3 py-3 text-right">
                        {row.paymentTermDays
                          ? `${row.paymentTermDays} hari`
                          : "—"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-right">
                        {rupiah.format(row.dueAmount)}
                      </td>
                      <td className="max-w-96 px-3 py-3">
                        {row.dueDescription || "—"}
                      </td>
                      <td className="max-w-96 px-3 py-3">
                        {row.breakdown.length
                          ? row.breakdown.map((value) => rupiah.format(value)).join(" · ")
                          : row.breakdownNote || "—"}
                      </td>
                    </tr>
                  ))}
                  {!overviewRows.length && (
                    <tr>
                      <td
                        colSpan={10}
                        className="px-4 py-12 text-center text-muted-foreground"
                      >
                        Tidak ada data yang cocok.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          {pagination}
        </>
      )}

      {view === "recap" && (
        <>
          <div>
            <p className="text-sm text-muted-foreground">
              Rekap invoice dan pembayaran seluruh pemasok
            </p>
            <h3 className="text-lg font-semibold">Rekap Hutang Pemasok</h3>
          </div>
          <SummaryCards
            items={[
              ["Total nominal", rupiah.format(recapSummary.total)],
              ["Total pembayaran", rupiah.format(recapSummary.paid)],
              ["Sisa hutang", rupiah.format(recapSummary.remaining)],
              ["Jumlah invoice", `${recapSummary.count} invoice`],
            ]}
          />
          <PaymentFakturTrendChart
            values={recapMonthlySummary.map((row) => row.debtValue)}
            eyebrow="Analitik hutang"
            title="Pergerakan hutang bulanan"
            description="Nilai hutang pemasok berdasarkan periode pada rekap workbook."
            variant="market"
          />
          {filterPanel}
          <div className="overflow-hidden rounded-lg border">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1500px] text-sm">
                <thead className="bg-muted/60 text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-3">No.</th>
                    <th className="px-3 py-3">Nama pemasok</th>
                    <th className="px-3 py-3">Tanggal invoice</th>
                    <th className="px-3 py-3">Nomor invoice</th>
                    <th className="px-3 py-3 text-right">Nominal</th>
                    <th className="px-3 py-3">Tanggal pembayaran</th>
                    <th className="px-3 py-3 text-right">Total pembayaran</th>
                    <th className="px-3 py-3 text-right">Bulan ke</th>
                    <th className="px-3 py-3">Jenis transaksi</th>
                    <th className="px-3 py-3">Kategori akun</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {recapRows.map((row) => (
                    <tr key={row.sourceRow} className="align-top hover:bg-muted/30">
                      <td className="px-3 py-3 text-muted-foreground">
                        {row.number}
                      </td>
                      <td className="px-3 py-3 font-medium">{row.supplierName}</td>
                      <td className="px-3 py-3">{dateLabel(row.invoiceDate)}</td>
                      <td className="px-3 py-3">{row.invoiceNumber}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-right font-medium">
                        {rupiah.format(row.nominal)}
                      </td>
                      <td className="px-3 py-3">
                        {dateLabel(row.actualPaymentDate)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-right">
                        {rupiah.format(row.totalPayment)}
                      </td>
                      <td className="px-3 py-3 text-right">
                        {row.monthNumber ?? "—"}
                      </td>
                      <td className="px-3 py-3">{row.transactionType || "—"}</td>
                      <td className="px-3 py-3">
                        {[
                          row.accountCategory,
                          row.otherDebtCategory,
                          row.accountantServiceDebt,
                          row.cashCategory,
                        ]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </td>
                    </tr>
                  ))}
                  {!recapRows.length && (
                    <tr>
                      <td
                        colSpan={10}
                        className="px-4 py-12 text-center text-muted-foreground"
                      >
                        Tidak ada data yang cocok.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          {pagination}
        </>
      )}

      {view === "detail" && (
        <>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm text-muted-foreground">
                Rincian hutang per pemasok
              </p>
              <h3 className="text-lg font-semibold">
                {selectedSheet?.supplierName || selectedSheetKey}
              </h3>
              <p className="text-xs text-muted-foreground">
                Sheet {selectedSheetKey}
                {selectedSheet?.contactName
                  ? ` · PIC ${selectedSheet.contactName}`
                  : ""}
                {selectedSheet?.paymentTermDays
                  ? ` · TOP ${selectedSheet.paymentTermDays} hari`
                  : ""}
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <select
                className="h-10 min-w-72 rounded-md border bg-background px-3 text-sm"
                value={selectedSheetKey ?? ""}
                onChange={(event) =>
                  setQuery({ sheet: event.target.value, page: null })
                }
                disabled={pending}
              >
                {sheets.map((sheet) => (
                  <option key={sheet.sheetKey} value={sheet.sheetKey}>
                    {sheet.sheetKey} — {sheet.supplierName} ({sheet.entryCount})
                  </option>
                ))}
              </select>
              {selectedSheet && selectedSheetKey && (
                <SupplierDebtEntryDialog
                  sheetKey={selectedSheetKey}
                  supplierName={selectedSheet.supplierName}
                />
              )}
            </div>
          </div>

          <div className="rounded-lg border bg-card">
            <div className="overflow-x-auto">
              <div className="flex min-w-max gap-1 p-2">
                {sheets.map((sheet) => {
                  const active = sheet.sheetKey === selectedSheetKey;
                  return (
                    <button
                      key={sheet.sheetKey}
                      type="button"
                      title={sheet.supplierName}
                      aria-current={active ? "page" : undefined}
                      className={
                        active
                          ? "rounded-md bg-primary px-3 py-2 text-left text-primary-foreground shadow-sm"
                          : "rounded-md border bg-background px-3 py-2 text-left hover:bg-muted"
                      }
                      onClick={() =>
                        setQuery({ sheet: sheet.sheetKey, page: null })
                      }
                      disabled={pending}
                    >
                      <span className="block text-sm font-semibold">
                        {sheet.sheetKey}
                      </span>
                      <span
                        className={
                          active
                            ? "block text-[11px] text-primary-foreground/80"
                            : "block text-[11px] text-muted-foreground"
                        }
                      >
                        {sheet.entryCount} baris
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {selectedSheet && (
              <div className="grid gap-3 rounded-lg border bg-muted/20 p-4 text-sm sm:grid-cols-2 lg:grid-cols-5">
                <div>
                  <p className="text-xs uppercase text-muted-foreground">
                    Kontak
                  </p>
                  <p className="font-medium">{selectedSheet.phone || "—"}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Bank</p>
                  <p className="font-medium">{selectedSheet.bankName || "—"}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-muted-foreground">
                    Nomor rekening
                  </p>
                  <p className="font-medium">{selectedSheet.bankAccount || "—"}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-muted-foreground">
                    Nama rekening
                  </p>
                  <p className="font-medium">
                    {selectedSheet.bankAccountName || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase text-muted-foreground">
                    Saldo deposit
                  </p>
                  <p className="font-semibold text-sky-700">
                    {rupiah.format(depositBalance)}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Sisa dana yang belum digunakan
                  </p>
                </div>
              </div>
            )}

          {(dueAlertSummary.overdue > 0 || dueAlertSummary.dueSoon > 0) && (
            <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-950">
              <BellRing className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="font-semibold">Perhatian jatuh tempo</p>
                <p className="text-sm">
                  {dueAlertSummary.overdue} tagihan telah lewat jatuh tempo dan{" "}
                  {dueAlertSummary.dueSoon} tagihan akan jatuh tempo dalam 7 hari.
                </p>
              </div>
            </div>
          )}

          {recentTransactions.length > 0 && (
            <details className="rounded-lg border bg-card">
              <summary className="cursor-pointer px-4 py-3 text-sm font-semibold">
                Riwayat deposit & pembayaran ({recentTransactions.length})
              </summary>
              <div className="overflow-x-auto border-t">
                <table className="w-full min-w-[760px] text-sm">
                  <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2">Tanggal</th>
                      <th className="px-3 py-2">Jenis</th>
                      <th className="px-3 py-2">Sumber</th>
                      <th className="px-3 py-2">Referensi</th>
                      <th className="px-3 py-2">Catatan</th>
                      <th className="px-3 py-2 text-right">Nominal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {recentTransactions.map((transaction) => (
                      <tr key={transaction.id}>
                        <td className="px-3 py-2">
                          {dateLabel(transaction.transactionDate)}
                        </td>
                        <td className="px-3 py-2">
                          {transaction.kind === "DEPOSIT"
                            ? "Deposit"
                            : "Pembayaran"}
                        </td>
                        <td className="px-3 py-2">
                          {transaction.paymentSource === "DEPOSIT"
                            ? "Saldo deposit"
                            : transaction.paymentSource === "CASH"
                              ? "Kas / transfer"
                              : "—"}
                        </td>
                        <td className="px-3 py-2">
                          {transaction.reference || "—"}
                        </td>
                        <td className="max-w-80 px-3 py-2">
                          {transaction.note || "—"}
                        </td>
                        <td className="px-3 py-2 text-right font-medium">
                          {rupiah.format(transaction.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}

          <SummaryCards
            items={[
              ["Total invoice", rupiah.format(detailSummary.total)],
              ["Hutang dibayar", rupiah.format(detailSummary.paid)],
              ["Sisa hutang", rupiah.format(detailSummary.remaining)],
              [
                "Status",
                `${detailSummary.LUNAS ?? 0} lunas · ${detailSummary.CICILAN ?? 0} cicilan · ${detailSummary.BELUM_BAYAR ?? 0} pending`,
              ],
            ]}
          />
          <PaymentFakturTrendChart
            values={monthlyTotals}
            eyebrow="Analitik hutang"
            title="Pergerakan invoice bulanan"
            description="Nilai invoice berdasarkan tanggal invoice pada sheet pemasok aktif."
            variant="market"
          />
          {filterPanel}
          <div className="overflow-hidden rounded-lg border">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[2640px] text-sm">
                <thead className="bg-muted/60 text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-3">No.</th>
                    <th className="px-3 py-3">Tanggal PO</th>
                    <th className="px-3 py-3">Nomor PO</th>
                    <th className="px-3 py-3">Terima barang</th>
                    <th className="px-3 py-3">Diterima oleh</th>
                    <th className="px-3 py-3">Nomor SJ</th>
                    <th className="px-3 py-3">Tanggal invoice</th>
                    <th className="px-3 py-3">Nomor invoice</th>
                    <th className="px-3 py-3">Nomor FP</th>
                    <th className="px-3 py-3">Jatuh tempo</th>
                    <th className="px-3 py-3">Part number</th>
                    <th className="px-3 py-3">Deskripsi</th>
                    <th className="px-3 py-3 text-right">Qty</th>
                    <th className="px-3 py-3 text-right">Harga</th>
                    <th className="px-3 py-3 text-right">Jumlah</th>
                    <th className="px-3 py-3 text-right">Grand total</th>
                    <th className="px-3 py-3">Date in part</th>
                    <th className="px-3 py-3">Tanggal bayar</th>
                    <th className="px-3 py-3 text-right">Nominal bayar</th>
                    <th className="px-3 py-3">Tanggal PBK</th>
                    <th className="px-3 py-3">Kode akun</th>
                    <th className="px-3 py-3 text-right">Sisa</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="sticky right-0 bg-muted/95 px-3 py-3 text-right">
                      Aksi
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {detailRows.map((row) => {
                    const dueState = supplierDebtDueState(
                      row.dueDate,
                      row.status,
                    );
                    return (
                    <tr
                      key={row.id ?? row.sourceRow}
                      className={
                        dueState === "OVERDUE"
                          ? "align-top bg-rose-50 hover:bg-rose-100/70"
                          : dueState === "DUE_SOON"
                            ? "align-top bg-amber-50 hover:bg-amber-100/70"
                            : "align-top hover:bg-muted/30"
                      }
                    >
                      <td className="px-3 py-3 text-muted-foreground">
                        {row.number || "—"}
                      </td>
                      <td className="px-3 py-3">
                        {dateLabel(row.purchaseOrderDate)}
                      </td>
                      <td className="px-3 py-3">{row.purchaseOrderNumber || "—"}</td>
                      <td className="px-3 py-3">
                        {dateLabel(row.goodsReceiptDate)}
                      </td>
                      <td className="px-3 py-3">{row.receivedBy || "—"}</td>
                      <td className="px-3 py-3">{row.deliveryNoteNumber || "—"}</td>
                      <td className="px-3 py-3">{dateLabel(row.invoiceDate)}</td>
                      <td className="px-3 py-3 font-medium">
                        {row.invoiceNumber || "—"}
                      </td>
                      <td className="max-w-56 break-all px-3 py-3">
                        {row.taxInvoiceNumber || "—"}
                      </td>
                      <td className="px-3 py-3">
                        <span className="whitespace-nowrap">
                          {dateLabel(row.dueDate)}
                        </span>
                        {dueState !== "NONE" && (
                          <Badge
                            className={
                              dueState === "OVERDUE"
                                ? "mt-1 block w-fit bg-rose-600 text-white hover:bg-rose-600"
                                : "mt-1 block w-fit bg-amber-500 text-white hover:bg-amber-500"
                            }
                          >
                            {dueState === "OVERDUE"
                              ? "Lewat jatuh tempo"
                              : "Segera jatuh tempo"}
                          </Badge>
                        )}
                      </td>
                      <td className="px-3 py-3">{row.partNumber || "—"}</td>
                      <td className="max-w-80 px-3 py-3">
                        {row.description || "—"}
                      </td>
                      <td className="px-3 py-3 text-right">{row.quantity || "—"}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-right">
                        {row.unitPrice ? rupiah.format(row.unitPrice) : "—"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-right">
                        {row.amount ? rupiah.format(row.amount) : "—"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-right font-medium">
                        {row.grandTotal ? rupiah.format(row.grandTotal) : "—"}
                      </td>
                      <td className="px-3 py-3">
                        {dateLabel(row.partsEntryDate)}
                      </td>
                      <td className="px-3 py-3">{dateLabel(row.paymentDate)}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-right">
                        {row.paymentAmount
                          ? rupiah.format(row.paymentAmount)
                          : "—"}
                      </td>
                      <td className="px-3 py-3">{dateLabel(row.pbkDate)}</td>
                      <td className="max-w-60 px-3 py-3">{row.accountCode || "—"}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-right">
                        {rupiah.format(row.remainingAmount)}
                      </td>
                      <td className="px-3 py-3">
                        {row.grandTotal > 0 || row.paymentAmount > 0 ? (
                          <Badge className={statusBadge[row.status]}>
                            {statusLabel[row.status]}
                          </Badge>
                        ) : (
                          <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-100">
                            Rincian item
                          </Badge>
                        )}
                      </td>
                      <td className="sticky right-0 bg-background px-3 py-2 text-right">
                        {selectedSheet && selectedSheetKey ? (
                          <div className="flex justify-end gap-1">
                            <SupplierDebtTransactionDialog
                              kind="DEPOSIT"
                              sheetKey={selectedSheetKey}
                              sourceRow={row.sourceRow}
                              invoiceLabel={
                                row.invoiceNumber ??
                                row.purchaseOrderNumber ??
                                row.deliveryNoteNumber ??
                                `Baris ${row.number ?? row.sourceRow}`
                              }
                              remainingAmount={row.remainingAmount}
                              depositBalance={depositBalance}
                            />
                            <SupplierDebtTransactionDialog
                              kind="PAYMENT"
                              sheetKey={selectedSheetKey}
                              sourceRow={row.sourceRow}
                              invoiceLabel={
                                row.invoiceNumber ??
                                row.purchaseOrderNumber ??
                                row.deliveryNoteNumber ??
                                `Baris ${row.number ?? row.sourceRow}`
                              }
                              remainingAmount={row.remainingAmount}
                              depositBalance={depositBalance}
                            />
                            <SupplierDebtEntryDialog
                              sheetKey={selectedSheetKey}
                              supplierName={selectedSheet.supplierName}
                              entry={row}
                            />
                            {row.isManual && row.id && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => deleteManualEntry(row)}
                                disabled={pending}
                                aria-label="Hapus baris"
                              >
                                <Trash2 className="h-4 w-4 text-rose-600" />
                              </Button>
                            )}
                          </div>
                        ) : (
                          <Badge variant="outline">Impor</Badge>
                        )}
                      </td>
                    </tr>
                    );
                  })}
                  {!detailRows.length && (
                    <tr>
                      <td
                        colSpan={24}
                        className="px-4 py-12 text-center text-muted-foreground"
                      >
                        Tidak ada data yang cocok pada sheet ini.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          {pagination}
        </>
      )}
    </div>
  );
}
