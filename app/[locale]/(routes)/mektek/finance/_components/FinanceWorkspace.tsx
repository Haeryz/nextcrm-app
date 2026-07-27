import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Clock3,
  FileCheck2,
  Landmark,
  ReceiptText,
  Search,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";

import type { Prisma } from "@prisma/client";

import { getFinanceOverview } from "@/actions/mektek/finance";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  buildContractReminderDemo,
} from "@/lib/mektek/finance-contract-reminder-demo";
import {
  classifyFinanceRevenueLine,
  getContractDaysRemaining,
  parseFinanceContractPeriodEnd,
} from "@/lib/mektek/finance";
import { buildFinanceSynchronizedRecaps } from "@/lib/mektek/finance-recaps";
import {
  matchesReportQuery,
  reportQueryTerms,
} from "@/lib/mektek/finance-search";
import { buildFinancePurchaseOrderDeliveryNoteSuggestion } from "@/lib/mektek/finance-po";
import { prismadb } from "@/lib/prisma";

import MektekPagination from "../../_components/MektekPagination";
import ContractCrudManager from "./ContractCrudManager";
import ContractReminderDemo from "./ContractReminderDemo";
import RecapCreateButton from "./RecapCreateButton";
import RecapRowActions from "./RecapRowActions";
import InvoiceCrudManager, { type FinanceInvoiceCrudRow } from "./InvoiceCrudManager";

export type FinanceSection =
  | "overview"
  | "invoices"
  | "delivery-notes"
  | "receivables"
  | "spare-parts"
  | "services"
  | "revenue"
  | "payables"
  | "cash"
  | "contracts"
  | "audit";

const money = (value: unknown) =>
  Number(value ?? 0).toLocaleString("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  });

const date = (value: Date | null | undefined) =>
  value
    ? new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(value)
    : "—";

const dateInput = (value: Date | null | undefined) =>
  value ? value.toISOString().slice(0, 10) : "";

type FinanceRevenueInspection = {
  id: string;
  invoiceNumber: string;
  customer: string;
  descriptions: string[];
};

async function getFinanceSynchronizedReport() {
  const invoices = await prismadb.financeInvoice.findMany({
    orderBy: [{ invoiceDate: "desc" }, { createdAt: "desc" }],
    take: 5000,
    include: {
      counterparty: { select: { legalName: true } },
      lines: {
        orderBy: { position: "asc" },
        select: {
          kind: true,
          description: true,
          lineTotal: true,
        },
      },
      allocations: {
        where: { receipt: { status: "POSTED" } },
        select: { amount: true },
      },
      sources: {
        where: { sourceType: "OUTBOUND_DISPATCH" },
        orderBy: { occurredAt: "asc" },
        select: {
          id: true,
          sourceReference: true,
          occurredAt: true,
          subtotal: true,
          snapshot: true,
        },
      },
    },
  });

  return buildFinanceSynchronizedRecaps(
    invoices.map((invoice) => ({
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      draftNumber: invoice.draftNumber,
      status: invoice.status,
      customer: invoice.counterparty.legalName,
      invoiceDate: dateInput(invoice.invoiceDate) || null,
      deliveryNoteNumber: invoice.deliveryNoteNumber,
      deliveryNoteDate: dateInput(invoice.deliveryNoteDate) || null,
      receiptNumber: invoice.receiptNumber,
      purchaseOrderNumber: invoice.purchaseOrderNumber,
      purchaseOrderDate: dateInput(invoice.purchaseOrderDate) || null,
      taxInvoiceNumber: invoice.taxInvoiceNumber,
      subtotal: Number(invoice.subtotal),
      taxAmount: Number(invoice.taxAmount),
      netAmount: Number(invoice.netAmount),
      paidAmount: invoice.allocations.reduce(
        (total, allocation) => total + Number(allocation.amount),
        0,
      ),
      lines: invoice.lines.map((line) => ({
        kind: line.kind,
        description: line.description,
        lineTotal: Number(line.lineTotal),
      })),
      deliveryNotes: invoice.sources.map((source) => {
        const deliveryNote =
          buildFinancePurchaseOrderDeliveryNoteSuggestion(source);
        const subtotal = Number(deliveryNote.subtotal);
        return {
          id: deliveryNote.id,
          number: deliveryNote.number,
          date: deliveryNote.date || null,
          description: deliveryNote.description,
          subtotal:
            deliveryNote.pricingComplete && Number.isFinite(subtotal)
              ? subtotal
              : null,
        };
      }),
    })),
  );
}

type DemoData = Record<string, unknown>;

const demoData = (value: unknown): DemoData =>
  value && typeof value === "object" && !Array.isArray(value)
    ? value as DemoData
    : {};

const demoText = (value: unknown) =>
  value == null || value === "" ? "—" : String(value);

const workbookText = (value: unknown) =>
  value == null || value === "" ? "" : String(value);

const workbookDate = (value: unknown) => {
  if (value == null || value === "") return "";
  if (value === "-") return "-";
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime())
    ? String(value)
    : new Intl.DateTimeFormat("id-ID", { dateStyle: "long" }).format(parsed);
};

const workbookMoney = (value: unknown) =>
  value == null || value === "" ? "" : money(value);

const demoNumber = (value: unknown) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const statusLabel: Record<string, string> = {
  DRAFT: "Draf",
  ACTIVE: "Aktif",
  EXPIRED: "Berakhir",
  TERMINATED: "Dihentikan",
  SUPERSEDED: "Digantikan",
  PENDING_APPROVAL: "Menunggu persetujuan",
  ISSUED: "Terbit",
  PARTIALLY_PAID: "Dibayar sebagian",
  PAID: "Lunas",
  VOID: "Dibatalkan",
  REQUESTED: "Diajukan",
  POSTED: "Dibukukan",
  CANCELLED: "Dibatalkan",
  PENDING: "Menunggu",
  APPROVED: "Disetujui",
  REJECTED: "Ditolak",
};

const actionLabel: Record<string, string> = {
  CREATE: "Dibuat",
  CREATE_DRAFT: "Draf dibuat",
  UPDATE: "Diperbarui",
  DELETE: "Dihapus",
  SUBMIT: "Diajukan",
  APPROVE: "Disetujui",
  REJECT: "Ditolak",
  POST: "Dibukukan",
  VOID: "Dibatalkan",
  ISSUE_INVOICE: "Menerbitkan invoice",
  POST_SUPPLIER_BILL: "Membukukan tagihan pemasok",
  APPROVE_QUOTE: "Menyetujui penawaran",
  POST_DISBURSEMENT: "Membukukan pembayaran",
  VOID_INVOICE: "Membatalkan invoice",
  VOID_SUPPLIER_BILL: "Membatalkan tagihan pemasok",
  REVERSE_RECEIPT: "Membalik penerimaan",
  REVERSE_DISBURSEMENT: "Membalik pembayaran",
  OVERRIDE_SUPPLY_CONFLICT: "Mengesampingkan konflik pasokan",
};

const contractTypeLabel: Record<string, string> = {
  SERVICE: "Jasa",
  SPARE_PART: "Suku cadang",
  RENTAL: "Sewa",
  CONSIGNMENT: "Konsinyasi",
  MIXED: "Campuran",
  OTHER: "Lainnya",
};

const entityLabel: Record<string, string> = {
  INVOICE: "Invoice",
  SUPPLIER_BILL: "Tagihan pemasok",
  QUOTE: "Penawaran",
  DISBURSEMENT: "Pembayaran",
  RECEIPT: "Penerimaan",
  CONTRACT: "Kontrak",
  COUNTERPARTY: "Rekanan",
};

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}

function Header({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function StickyFilterBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="md:sticky md:top-0 md:z-30 md:-mt-4 md:bg-background md:px-6 md:pb-3 md:pt-4 md:-mx-6 md:border-b">
      {children}
    </div>
  );
}

/**
 * Narrows the invoice query in the database so a search is not limited to the
 * page of most recent invoices we would otherwise load into memory.
 */
const invoiceSearchWhere = (query: string): Prisma.FinanceInvoiceWhereInput => {
  const terms = reportQueryTerms(query);
  if (!terms.length) return {};
  return {
    AND: terms.map((term) => ({
      OR: [
        { invoiceNumber: { contains: term, mode: "insensitive" as const } },
        { draftNumber: { contains: term, mode: "insensitive" as const } },
        { deliveryNoteNumber: { contains: term, mode: "insensitive" as const } },
        { receiptNumber: { contains: term, mode: "insensitive" as const } },
        {
          purchaseOrderNumber: {
            contains: term,
            mode: "insensitive" as const,
          },
        },
        { taxInvoiceNumber: { contains: term, mode: "insensitive" as const } },
        { notes: { contains: term, mode: "insensitive" as const } },
        {
          counterparty: {
            legalName: { contains: term, mode: "insensitive" as const },
          },
        },
        {
          lines: {
            some: {
              description: { contains: term, mode: "insensitive" as const },
            },
          },
        },
      ],
    })),
  };
};

function ReportFilter({
  query,
  placeholder = "Cari data rekap",
  classification = "",
}: {
  query: string;
  placeholder?: string;
  classification?: string;
}) {
  return (
    <form className="flex max-w-xl gap-2">
      {classification ? (
        <input type="hidden" name="classification" value={classification} />
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

function RevenueClassificationWarning({
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

export default async function FinanceWorkspace({
  section,
  deliveryNotesPage = 1,
  query = "",
  classification = "",
  inspectInvoiceId = "",
}: {
  section: FinanceSection;
  deliveryNotesPage?: number;
  query?: string;
  classification?: string;
  inspectInvoiceId?: string;
}) {
  if (section === "overview") {
    const result = await getFinanceOverview();
    if (!("data" in result)) return <Empty>Data keuangan tidak dapat dimuat.</Empty>;
    const value = result.data;
    const cards = [
      ["Kas masuk", money(value.cashIn), ArrowDownLeft],
      ["Kas keluar", money(value.cashOut), ArrowUpRight],
      ["Piutang terbuka", money(value.receivable), ReceiptText],
      ["Utang terbuka", money(value.payable), Landmark],
    ] as const;
    const queues = [
      ["Persetujuan menunggu", value.pendingApprovals, ShieldCheck],
      ["Sumber belum ditagih", value.unbilledSources, FileCheck2],
      ["Penerimaan belum dicocokkan", value.unmatchedPayables, AlertTriangle],
      ["Kontrak berakhir dalam 30 hari", value.expiringContracts, Clock3],
    ] as const;

    return (
      <main className="space-y-6 px-4 pb-8 sm:px-6">
        <Header
          title="Ringkasan keuangan"
          description="Posisi kas, piutang, utang, dan pekerjaan yang perlu ditindaklanjuti."
        />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map(([label, amount, Icon]) => (
            <Card key={label}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm">{label}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent><p className="text-2xl font-semibold">{amount}</p></CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardHeader><CardTitle className="text-base">Daftar tindak lanjut</CardTitle></CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {queues.map(([label, count, Icon]) => (
              <div key={label} className="flex items-center justify-between rounded-lg border p-4">
                <div className="flex items-center gap-3">
                  <Icon className="h-5 w-5 text-muted-foreground" />
                  <span className="text-sm font-medium">{label}</span>
                </div>
                <Badge variant={Number(count) ? "destructive" : "secondary"}>{count}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </main>
    );
  }

  if (section === "invoices") {
    const [invoices, customers] = await Promise.all([
      prismadb.financeInvoice.findMany({
        where: invoiceSearchWhere(query),
        orderBy: [{ invoiceDate: "desc" }, { createdAt: "desc" }],
        take: 500,
        include: {
          counterparty: { select: { legalName: true } },
          lines: { orderBy: { position: "asc" } },
          sources: {
            where: { sourceType: "OUTBOUND_DISPATCH" },
            orderBy: { occurredAt: "asc" },
            select: {
              id: true,
              sourceReference: true,
              occurredAt: true,
              subtotal: true,
              snapshot: true,
            },
          },
          allocations: {
            where: { receipt: { status: "POSTED" } },
            select: { amount: true },
          },
        },
      }),
      prismadb.financeCounterparty.findMany({
        where: { isActive: true, role: { in: ["CUSTOMER", "BOTH"] } },
        orderBy: { legalName: "asc" },
        select: { legalName: true },
      }),
    ]);
    const rows: FinanceInvoiceCrudRow[] = invoices.map((row) => {
      const paid = row.allocations.reduce((sum, allocation) => sum + Number(allocation.amount), 0);
      const sources = row.sources.map((source) => {
        const snapshot =
          source.snapshot &&
          typeof source.snapshot === "object" &&
          !Array.isArray(source.snapshot)
            ? source.snapshot
            : {};
        const deliveryNote =
          buildFinancePurchaseOrderDeliveryNoteSuggestion(source);
        return {
          id: deliveryNote.id,
          purchaseOrderId: String(snapshot.purchaseOrderId ?? ""),
          purchaseOrderNumber: String(snapshot.poNumber ?? ""),
          purchaseOrderMode:
            snapshot.poMode === "CONSIGNMENT"
              ? ("CONSIGNMENT" as const)
              : ("MANUAL" as const),
          customerName: row.counterparty.legalName,
          projectName: String(snapshot.projectName ?? ""),
          purchaseOrderDate: dateInput(row.purchaseOrderDate),
          dueDate: dateInput(row.dueDate),
          deliveryNoteNumber: deliveryNote.number,
          deliveryNoteDate: deliveryNote.date,
          description: deliveryNote.description,
          subtotal: deliveryNote.subtotal,
          pricingComplete: deliveryNote.pricingComplete,
          items: deliveryNote.items,
        };
      });
      const classificationDescriptions = row.lines
        .filter(
          (line) =>
            Number(line.lineTotal) > 0 &&
            classifyFinanceRevenueLine(line) === "unclassified",
        )
        .map((line) => line.description);
      return {
        id: row.id,
        invoiceNumber: row.invoiceNumber ?? "",
        displayNumber: row.invoiceNumber ?? `Draf ${row.draftNumber.slice(0, 8)}`,
        customerName: row.counterparty.legalName,
        status: row.status,
        invoiceDate: dateInput(row.invoiceDate),
        dueDate: dateInput(row.dueDate),
        deliveryNoteNumber: row.deliveryNoteNumber ?? "",
        deliveryNoteDate: dateInput(row.deliveryNoteDate),
        receiptNumber: row.receiptNumber ?? "",
        purchaseOrderNumber: row.purchaseOrderNumber ?? "",
        purchaseOrderDate: dateInput(row.purchaseOrderDate),
        description: row.lines[0]?.description ?? "",
        items: row.lines.map((line) => ({
          description: line.description,
          partNumber: line.partNumber ?? "",
          quantity: String(Number(line.quantity)),
          unitPrice: String(Number(line.unitPrice)),
        })),
        subtotal: Number(row.subtotal),
        taxRate: Number(row.taxRate) * 100,
        taxInvoiceNumber: row.taxInvoiceNumber ?? "",
        accountDestination: row.accountDestination ?? "",
        notes: row.notes ?? "",
        total: Number(row.netAmount),
        balance: Math.max(0, Number(row.netAmount) - paid),
        hasPayment: row.allocations.length > 0,
        classificationIssue: classificationDescriptions.length > 0,
        classificationDescriptions,
        sources,
      };
    }).filter(
      (row) =>
        (classification !== "unclassified" || row.classificationIssue) &&
        matchesReportQuery(
          query,
          row.displayNumber,
          row.customerName,
          row.deliveryNoteNumber,
          row.receiptNumber,
          row.purchaseOrderNumber,
          row.description,
          row.taxInvoiceNumber,
          row.status,
        ),
    );

    return (
      <main className="space-y-4 px-4 pb-8 sm:px-6">
        <Header
          title="Rekap invoice"
          description="Tambah, lihat, ubah, dan hapus data invoice sesuai format kerja akuntansi."
        />
        <div className="flex items-start gap-3 rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-950">
          <FileCheck2 className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">Sinkronisasi rekap aktif</p>
            <p>
              Perubahan invoice otomatis diterapkan ke Rekap Surat Jalan,
              Rekapitulasi Invoice Jasa & Part, Pendapatan Spare Part,
              Pendapatan Jasa, dan Rekap Jasa & Part.
            </p>
          </div>
        </div>
        <StickyFilterBar>
          <ReportFilter
            query={query}
            placeholder="Cari invoice, pelanggan, SJ, PO, atau faktur pajak"
            classification={classification}
          />
        </StickyFilterBar>
        {classification === "unclassified" ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
            <div>
              <p className="font-medium">Invoice dengan deskripsi perlu diperiksa</p>
              <p>
                Hanya invoice dengan deskripsi campuran atau tidak jelas yang
                ditampilkan.
              </p>
            </div>
            <Button asChild size="sm" variant="outline" className="bg-white">
              <Link href="/mektek/finance/invoices">Tampilkan semua invoice</Link>
            </Button>
          </div>
        ) : null}
        <InvoiceCrudManager
          rows={rows}
          customerNames={customers.map((row) => row.legalName)}
          initialInvoiceId={inspectInvoiceId}
        />
      </main>
    );
  }

  if (section === "delivery-notes") {
    const deliveryNotesPageSize = 100;
    const synchronizedReport = await getFinanceSynchronizedReport();
    const matchingRows = synchronizedReport.deliveryNotes.filter((row) =>
      matchesReportQuery(
        query,
        row.company,
        row.deliveryNoteNumber,
        row.deliveryNoteDate,
        row.invoiceNumber,
        row.invoiceDate,
        row.purchaseOrderNumber,
        row.purchaseOrderDate,
        row.description,
      ),
    );
    const synchronizedCount = matchingRows.length;
    const deliveryNotesTotalPages = Math.max(
      1,
      Math.ceil(synchronizedCount / deliveryNotesPageSize),
    );
    const currentDeliveryNotesPage = Math.min(
      Math.max(deliveryNotesPage, 1),
      deliveryNotesTotalPages,
    );
    const rows = matchingRows.slice(
      (currentDeliveryNotesPage - 1) * deliveryNotesPageSize,
      currentDeliveryNotesPage * deliveryNotesPageSize,
    );
    return (
      <main className="space-y-4 px-4 pb-8 sm:px-6">
        <Header
          title="Rekap surat jalan"
          description={`${synchronizedCount.toLocaleString("id-ID")} baris otomatis dari invoice dan Surat Jalan Logistics yang terhubung.`}
        />
        <StickyFilterBar>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <ReportFilter
              query={query}
              placeholder="Cari perusahaan, nomor SJ, invoice, atau PO"
            />
            <RecapCreateButton />
          </div>
        </StickyFilterBar>
        {rows.length ? (
          <>
            <div className="overflow-hidden rounded-xl border bg-card">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1400px] text-sm">
                  <thead className="bg-muted/50 text-left">
                    <tr>
                      <th className="p-3">PERUSAHAAN</th>
                      <th className="p-3">NO SJ/BA</th>
                      <th className="p-3">TANGGAL SJ</th>
                      <th className="p-3">NOMER INVOICE</th>
                      <th className="p-3">TANGGAL INVOICE</th>
                      <th className="p-3">PO</th>
                      <th className="p-3">TANGGAL PO</th>
                      <th className="p-3">DESCRIPTION</th>
                      <th className="p-3 text-right">TOTAL</th>
                      <th className="p-3 text-right">PPN</th>
                      <th className="p-3 text-right">GRAND TOTAL</th>
                      <th className="p-3 text-right">AKSI</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.id} className="border-t">
                        <td className="p-3">{row.company}</td>
                        <td className="p-3 font-medium">{row.deliveryNoteNumber}</td>
                        <td className="p-3">{workbookDate(row.deliveryNoteDate)}</td>
                        <td className="p-3">{row.invoiceNumber}</td>
                        <td className="p-3">{workbookDate(row.invoiceDate)}</td>
                        <td className="p-3">{row.purchaseOrderNumber}</td>
                        <td className="p-3">{workbookDate(row.purchaseOrderDate)}</td>
                        <td className="max-w-[320px] truncate p-3" title={row.description}>{row.description}</td>
                        <td className="p-3 text-right">{workbookMoney(row.subtotal)}</td>
                        <td className="p-3 text-right">{workbookMoney(row.taxAmount)}</td>
                        <td className="p-3 text-right font-medium">{workbookMoney(row.total)}</td>
                        <td className="p-3 text-right">
                          <RecapRowActions
                            invoiceId={row.invoiceId}
                            label={row.invoiceNumber}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <MektekPagination
              basePath="/mektek/finance/delivery-notes"
              page={currentDeliveryNotesPage}
              totalPages={deliveryNotesTotalPages}
              totalCount={synchronizedCount}
              pageSize={deliveryNotesPageSize}
              itemLabel="baris"
              query={query ? { q: query } : undefined}
            />
          </>
        ) : <Empty>Belum ada Surat Jalan yang terhubung ke invoice.</Empty>}
      </main>
    );
  }

  if (section === "receivables") {
    const synchronizedReport = await getFinanceSynchronizedReport();
    const months = [
      ["jan", "Jan"], ["feb", "Feb"], ["mar", "Mar"], ["apr", "Apr"],
      ["may", "Mei"], ["jun", "Jun"], ["jul", "Jul"], ["aug", "Agu"],
      ["sep", "Sep"], ["oct", "Okt"], ["nov", "Nov"], ["dec", "Des"],
    ] as const;
    const receivableRows = synchronizedReport.receivables.filter((row) =>
      matchesReportQuery(
        query,
        row.number,
        row.customer,
        row.notes,
      ),
    );
    const monthlyTotals = Object.fromEntries(
      months.map(([key]) => [
        key,
        receivableRows.reduce(
          (total, row) => total + demoNumber(row.monthly[key]),
          0,
        ),
      ]),
    );
    const monthlyPaidTotals = Object.fromEntries(
      months.map(([key]) => [
        key,
        receivableRows.reduce(
          (total, row) => total + demoNumber(row.monthlyPaid[key]),
          0,
        ),
      ]),
    );
    const monthlyBalanceTotals = Object.fromEntries(
      months.map(([key]) => [
        key,
        receivableRows.reduce(
          (total, row) => total + demoNumber(row.monthlyBalance[key]),
          0,
        ),
      ]),
    );
    return (
      <main className="space-y-6 px-4 pb-8 sm:px-6">
        <Header
          title="Rekapitulasi invoice jasa & part"
          description="Terbentuk otomatis dari rekap invoice dan pembayaran yang sudah diposting."
        />
        <StickyFilterBar>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <ReportFilter
              query={query}
              placeholder="Cari perusahaan atau status piutang"
            />
            <RecapCreateButton />
          </div>
        </StickyFilterBar>
        {receivableRows.length ? (
          <>
            <section className="space-y-2" aria-labelledby="invoice-customer-table">
              <h2 id="invoice-customer-table" className="text-base font-semibold">
                Rekapitulasi invoice per perusahaan
              </h2>
              <div className="overflow-hidden rounded-xl border bg-card">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[2000px] text-sm">
                    <thead className="bg-muted/50 text-left">
                      <tr>
                        <th className="p-3 text-center">No</th>
                        <th className="p-3">Nama perusahaan</th>
                        <th className="p-3 text-right">Total piutang</th>
                        <th className="p-3 text-right">Piutang dibayar</th>
                        <th className="p-3 text-right">Sisa piutang</th>
                        {months.map(([, label]) => (
                          <th key={label} className="p-3 text-right">{label}</th>
                        ))}
                        <th className="p-3 text-center">Keterangan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {receivableRows.map((row) => (
                        <tr key={row.id} className="border-t">
                          <td className="p-3 text-center">{row.number}</td>
                          <td className="p-3 font-medium">{row.customer}</td>
                          <td className="p-3 text-right">{money(row.totalReceivable)}</td>
                          <td className="p-3 text-right">{money(row.paid)}</td>
                          <td className="p-3 text-right font-semibold">{money(row.balance)}</td>
                          {months.map(([key]) => (
                            <td key={key} className="p-3 text-right">
                              {money(row.monthly[key])}
                            </td>
                          ))}
                          <td className="p-3 text-center">
                            {row.notes ? (
                              <Badge variant={row.notes === "LUNAS" ? "default" : "secondary"}>
                                {row.notes}
                              </Badge>
                            ) : ""}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>

            <section className="space-y-2" aria-labelledby="monthly-company-matrix">
              <h2 id="monthly-company-matrix" className="text-base font-semibold">
                Realisasi bulanan per perusahaan
              </h2>
              <div className="overflow-hidden rounded-xl border bg-card">
                <div className="overflow-x-auto">
                  <table className="min-w-max text-xs">
                    <thead>
                      <tr className="bg-muted/30">
                        <th className="sticky left-0 z-20 min-w-28 border-r bg-muted p-2 text-left">
                          No
                        </th>
                        {receivableRows.map((row) => (
                          <th key={row.id} className="min-w-44 border-r p-2 text-center">
                            {row.number}
                          </th>
                        ))}
                      </tr>
                      <tr className="bg-emerald-700 text-white">
                        <th className="sticky left-0 z-20 border-r bg-emerald-700 p-2 text-left">
                          Bulan
                        </th>
                        {receivableRows.map((row) => (
                          <th key={row.id} className="border-r p-2 text-left font-semibold">
                            {row.customer}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {months.map(([key, label]) => (
                        <tr key={key} className="border-t">
                          <th className="sticky left-0 z-10 border-r bg-card p-2 text-left text-blue-700">
                            {label}
                          </th>
                          {receivableRows.map((row) => (
                            <td key={row.id} className="border-r p-2 text-right">
                              {demoNumber(row.monthly[key]) === 0
                                ? "—"
                                : money(row.monthly[key])}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>

            <section className="space-y-2" aria-labelledby="customer-total-matrix">
              <h2 id="customer-total-matrix" className="text-base font-semibold">
                Total per perusahaan
              </h2>
              <div className="overflow-hidden rounded-xl border bg-card">
                <div className="overflow-x-auto">
                  <table className="min-w-max text-xs">
                    <thead>
                      <tr className="bg-muted/30">
                        <th className="sticky left-0 z-20 min-w-36 border-r bg-muted p-2" />
                        {receivableRows.map((row) => (
                          <th key={row.id} className="min-w-44 border-r p-2 text-center">
                            {row.number}
                          </th>
                        ))}
                      </tr>
                      <tr className="bg-emerald-700 text-white">
                        <th className="sticky left-0 z-20 border-r bg-emerald-700 p-2" />
                        {receivableRows.map((row) => (
                          <th key={row.id} className="border-r p-2 text-left font-semibold">
                            {row.customer}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        ["Total piutang", "totalReceivable"],
                        ["Piutang dibayar", "paid"],
                        ["Sisa piutang", "balance"],
                      ].map(([label, key]) => (
                        <tr key={key} className="border-t">
                          <th className="sticky left-0 z-10 border-r bg-card p-2 text-left uppercase">
                            {label}
                          </th>
                          {receivableRows.map((row) => (
                            <td key={row.id} className="border-r p-2 text-right">
                              {demoNumber(row[key as "totalReceivable" | "paid" | "balance"]) === 0
                                ? "—"
                                : money(row[key as "totalReceivable" | "paid" | "balance"])}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>

            <section className="space-y-2" aria-labelledby="monthly-total-table">
              <h2 id="monthly-total-table" className="text-base font-semibold">
                Total bulanan
              </h2>
              <div className="max-w-3xl overflow-hidden rounded-xl border bg-card">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="p-3 text-left">Bulan</th>
                        <th className="p-3 text-right">Total piutang</th>
                        <th className="p-3 text-right">Piutang dibayar</th>
                        <th className="p-3 text-right">Sisa piutang</th>
                      </tr>
                    </thead>
                    <tbody>
                      {months.map(([key, label]) => (
                        <tr key={key} className="border-t">
                          <th className="p-3 text-left">{label}</th>
                          <td className="p-3 text-right font-medium">
                            {demoNumber(monthlyTotals[key]) === 0
                              ? "—"
                              : money(monthlyTotals[key])}
                          </td>
                          <td className="p-3 text-right">
                            {demoNumber(monthlyPaidTotals[key]) === 0
                              ? "—"
                              : money(monthlyPaidTotals[key])}
                          </td>
                          <td className="p-3 text-right">
                            {demoNumber(monthlyBalanceTotals[key]) === 0
                              ? "—"
                              : money(monthlyBalanceTotals[key])}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          </>
        ) : <Empty>Belum ada invoice aktif untuk direkap.</Empty>}
      </main>
    );
  }

  if (section === "spare-parts") {
    const report = await getFinanceSynchronizedReport();
    const rows = report.revenueRows.filter(
      (row) =>
        row.category === "sparepart" &&
        matchesReportQuery(
          query,
          row.customer,
          row.deliveryNoteNumber,
          row.receiptNumber,
          row.invoiceNumber,
          row.purchaseOrderNumber,
          row.taxInvoiceNumber,
          row.description,
        ),
    );
    return (
      <main className="space-y-4 px-4 pb-8 sm:px-6">
        <Header
          title="Pendapatan spare part"
          description="Terbentuk otomatis dari baris spare part pada rekap invoice, termasuk invoice campuran."
        />
        <StickyFilterBar>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <ReportFilter
              query={query}
              placeholder="Cari pelanggan, invoice, SJ, PO, atau faktur pajak"
            />
            <RecapCreateButton />
          </div>
        </StickyFilterBar>
        {report.unclassifiedCount > 0 ? (
          <RevenueClassificationWarning
            count={report.unclassifiedCount}
            subtotal={report.unclassifiedSubtotal}
            invoices={report.unclassifiedInvoices}
          />
        ) : null}
        {rows.length ? (
          <div className="overflow-hidden rounded-xl border bg-card">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1400px] text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr>
                    <th className="p-3">Pelanggan</th>
                    <th className="p-3">Nomor SJ</th>
                    <th className="p-3">Tanggal SJ</th>
                    <th className="p-3">Kwitansi</th>
                    <th className="p-3">Nomor invoice</th>
                    <th className="p-3">Tanggal invoice</th>
                    <th className="p-3">Nomor PO</th>
                    <th className="p-3">Tanggal PO</th>
                    <th className="p-3 text-right">Harga</th>
                    <th className="p-3 text-right">PPN</th>
                    <th className="p-3 text-right">Total</th>
                    <th className="p-3">Faktur pajak</th>
                    <th className="p-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    return (
                      <tr key={row.key} className="border-t">
                        <td className="p-3 font-medium">{row.customer}</td>
                        <td className="p-3">{row.deliveryNoteNumber || "—"}</td>
                        <td className="p-3">{workbookDate(row.deliveryNoteDate)}</td>
                        <td className="p-3">{row.receiptNumber || "—"}</td>
                        <td className="p-3">{row.invoiceNumber}</td>
                        <td className="p-3">{workbookDate(row.invoiceDate)}</td>
                        <td className="p-3">{row.purchaseOrderNumber || "—"}</td>
                        <td className="p-3">{workbookDate(row.purchaseOrderDate)}</td>
                        <td className="p-3 text-right">{money(row.subtotal)}</td>
                        <td className="p-3 text-right">{money(row.taxAmount)}</td>
                        <td className="p-3 text-right font-semibold">{money(row.total)}</td>
                        <td className="p-3">{row.taxInvoiceNumber || "—"}</td>
                        <td className="p-3 text-right">
                          <RecapRowActions
                            invoiceId={row.invoiceId}
                            label={row.invoiceNumber}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : <Empty>Belum ada baris invoice yang terdeteksi sebagai spare part.</Empty>}
      </main>
    );
  }

  if (section === "services") {
    const report = await getFinanceSynchronizedReport();
    const rows = report.revenueRows.filter(
      (row) =>
        row.category === "service" &&
        matchesReportQuery(
          query,
          row.customer,
          row.receiptNumber,
          row.invoiceNumber,
          row.purchaseOrderNumber,
          row.taxInvoiceNumber,
          row.description,
        ),
    );
    return (
      <main className="space-y-4 px-4 pb-8 sm:px-6">
        <Header
          title="Pendapatan jasa"
          description="Terbentuk otomatis dari baris jasa pada rekap invoice, termasuk invoice campuran."
        />
        <StickyFilterBar>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <ReportFilter
              query={query}
              placeholder="Cari pelanggan, invoice, PO, atau keterangan"
            />
            <RecapCreateButton />
          </div>
        </StickyFilterBar>
        {report.unclassifiedCount > 0 ? (
          <RevenueClassificationWarning
            count={report.unclassifiedCount}
            subtotal={report.unclassifiedSubtotal}
            invoices={report.unclassifiedInvoices}
          />
        ) : null}
        {rows.length ? (
          <div className="overflow-hidden rounded-xl border bg-card">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1200px] text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr>
                    <th className="p-3">Pelanggan</th>
                    <th className="p-3">Kwitansi</th>
                    <th className="p-3">Nomor invoice</th>
                    <th className="p-3">Tanggal invoice</th>
                    <th className="p-3">Nomor PO</th>
                    <th className="p-3">Tanggal PO</th>
                    <th className="p-3 text-right">Harga</th>
                    <th className="p-3 text-right">PPN</th>
                    <th className="p-3 text-right">Total</th>
                    <th className="p-3">Faktur pajak</th>
                    <th className="p-3">Keterangan</th>
                    <th className="p-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    return (
                      <tr key={row.key} className="border-t">
                        <td className="p-3 font-medium">{row.customer}</td>
                        <td className="p-3">{row.receiptNumber || "—"}</td>
                        <td className="p-3">{row.invoiceNumber}</td>
                        <td className="p-3">{workbookDate(row.invoiceDate)}</td>
                        <td className="p-3">{row.purchaseOrderNumber || "—"}</td>
                        <td className="p-3">{workbookDate(row.purchaseOrderDate)}</td>
                        <td className="p-3 text-right">{money(row.subtotal)}</td>
                        <td className="p-3 text-right">{money(row.taxAmount)}</td>
                        <td className="p-3 text-right font-semibold">{money(row.total)}</td>
                        <td className="p-3">{row.taxInvoiceNumber || "—"}</td>
                        <td className="max-w-[360px] p-3">{row.description}</td>
                        <td className="p-3 text-right">
                          <RecapRowActions
                            invoiceId={row.invoiceId}
                            label={row.invoiceNumber}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : <Empty>Belum ada baris invoice yang terdeteksi sebagai jasa.</Empty>}
      </main>
    );
  }

  if (section === "revenue") {
    const report = await getFinanceSynchronizedReport();
    const totals = new Map<string, { jasa: number; sukuCadang: number; ppn: number }>();
    for (const row of report.revenueRows) {
      const current = totals.get(row.customer) ?? { jasa: 0, sukuCadang: 0, ppn: 0 };
      if (row.category === "sparepart") current.sukuCadang += row.subtotal;
      else current.jasa += row.subtotal;
      current.ppn += row.taxAmount;
      totals.set(row.customer, current);
    }
    const rows = [...totals.entries()]
      .filter(([customer]) => matchesReportQuery(query, customer))
      .sort(([a], [b]) => a.localeCompare(b, "id"));

    return (
      <main className="space-y-4 px-4 pb-8 sm:px-6">
        <Header
          title="Rekap pendapatan jasa & suku cadang"
          description="Rekap otomatis dari baris invoice; invoice campuran dibagi menurut nilai setiap baris."
        />
        <StickyFilterBar>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <ReportFilter query={query} placeholder="Cari pelanggan" />
            <RecapCreateButton />
          </div>
        </StickyFilterBar>
        {report.unclassifiedCount > 0 ? (
          <RevenueClassificationWarning
            count={report.unclassifiedCount}
            subtotal={report.unclassifiedSubtotal}
            invoices={report.unclassifiedInvoices}
          />
        ) : null}
        {rows.length ? (
          <div className="overflow-hidden rounded-xl border bg-card">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px] text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr>
                    <th className="p-3">Pelanggan</th>
                    <th className="p-3 text-right">Pendapatan suku cadang</th>
                    <th className="p-3 text-right">Pendapatan jasa</th>
                    <th className="p-3 text-right">PPN</th>
                    <th className="p-3 text-right">Total akhir</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(([customer, value]) => (
                    <tr key={customer} className="border-t">
                      <td className="p-3 font-medium">{customer}</td>
                      <td className="p-3 text-right">{money(value.sukuCadang)}</td>
                      <td className="p-3 text-right">{money(value.jasa)}</td>
                      <td className="p-3 text-right">{money(value.ppn)}</td>
                      <td className="p-3 text-right font-semibold">
                        {money(value.sukuCadang + value.jasa + value.ppn)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : <Empty>Belum ada pendapatan. Tambahkan invoice untuk membentuk rekap.</Empty>}
      </main>
    );
  }

  if (section === "payables") {
    const rows = await prismadb.financeSupplierBill.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        counterparty: { select: { legalName: true } },
        allocations: {
          where: { disbursement: { status: "POSTED" } },
          select: { amount: true },
        },
      },
    });
    return (
      <main className="space-y-4 px-4 pb-8 sm:px-6">
        <Header title="Tagihan pemasok" description="Pencocokan penerimaan, tagihan pemasok, dan pembayaran." />
        {rows.length ? (
          <div className="grid gap-3">
            {rows.map((row) => (
              <Card key={row.id}>
                <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
                  <div>
                    <p className="font-medium">{row.internalNumber} · {row.counterparty.legalName}</p>
                    <p className="text-sm text-muted-foreground">
                      Tagihan {row.supplierInvoiceNumber} · jatuh tempo {date(row.dueDate)}
                    </p>
                  </div>
                  <div className="text-right">
                    <Badge variant={row.matchException ? "destructive" : "outline"}>
                      {row.matchException ? "PERLU DIPERIKSA" : (statusLabel[row.status] ?? row.status)}
                    </Badge>
                    <p className="mt-1 font-semibold">
                      {money(Number(row.totalAmount) - row.allocations.reduce((sum, item) => sum + Number(item.amount), 0))}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : <Empty>Belum ada tagihan pemasok.</Empty>}
      </main>
    );
  }

  if (section === "cash") {
    const [receipts, payments] = await Promise.all([
      prismadb.financeReceipt.findMany({
        orderBy: { receivedAt: "desc" },
        take: 50,
        include: { counterparty: { select: { legalName: true } } },
      }),
      prismadb.financeDisbursement.findMany({
        orderBy: { paidAt: "desc" },
        take: 50,
        include: { counterparty: { select: { legalName: true } } },
      }),
    ]);
    const rows = [
      ...receipts.map((row) => ({
        id: row.id,
        direction: "IN",
        number: row.receiptNumber,
        party: row.counterparty.legalName,
        at: row.receivedAt,
        amount: row.amount,
        status: row.status,
      })),
      ...payments.map((row) => ({
        id: row.id,
        direction: "OUT",
        number: row.paymentNumber,
        party: row.counterparty.legalName,
        at: row.paidAt,
        amount: row.amount,
        status: row.status,
      })),
    ].sort((a, b) => b.at.getTime() - a.at.getTime());

    return (
      <main className="space-y-4 px-4 pb-8 sm:px-6">
        <Header title="Kas & pembayaran" description="Penerimaan dan pengeluaran yang dialokasikan ke dokumen." />
        {rows.length ? (
          <div className="grid gap-3">
            {rows.map((row) => (
              <div key={row.id} className="flex items-center justify-between rounded-xl border bg-card p-4">
                <div className="flex items-center gap-3">
                  {row.direction === "IN"
                    ? <ArrowDownLeft className="text-emerald-600" />
                    : <ArrowUpRight className="text-rose-600" />}
                  <div>
                    <p className="font-medium">{row.number} · {row.party}</p>
                    <p className="text-sm text-muted-foreground">
                      {date(row.at)} · {statusLabel[row.status] ?? row.status}
                    </p>
                  </div>
                </div>
                <p className="font-semibold">{row.direction === "IN" ? "+" : "−"}{money(row.amount)}</p>
              </div>
            ))}
          </div>
        ) : <Empty>Belum ada transaksi kas.</Empty>}
      </main>
    );
  }

  if (section === "contracts") {
    const [rows, workbookRows, contractCustomers] = await Promise.all([
      prismadb.financeContract.findMany({
        orderBy: { endDate: "asc" },
        take: 100,
        include: {
          counterparty: { select: { legalName: true } },
          lines: { orderBy: { position: "asc" } },
          _count: { select: { lines: true, purchaseOrders: true } },
        },
      }),
      prismadb.financeDemoRow.findMany({
        where: { sheetKey: "contracts" },
        orderBy: { sourceRow: "asc" },
        take: 500,
        select: { id: true, data: true },
      }),
      prismadb.financeCounterparty.findMany({
        where: { isActive: true, role: { in: ["CUSTOMER", "BOTH"] } },
        orderBy: { legalName: "asc" },
        select: { legalName: true },
      }),
    ]);
    // supersedesId has no declared relation, so the chain is resolved here.
    const contractIds = rows.map((row) => row.id);
    const predecessorIds = [
      ...new Set(
        rows.flatMap((row) => (row.supersedesId ? [row.supersedesId] : [])),
      ),
    ];
    const [successors, predecessors] = await Promise.all([
      contractIds.length
        ? prismadb.financeContract.findMany({
            where: { supersedesId: { in: contractIds } },
            select: { supersedesId: true },
          })
        : [],
      predecessorIds.length
        ? prismadb.financeContract.findMany({
            where: { id: { in: predecessorIds } },
            select: { id: true, contractNumber: true },
          })
        : [],
    ]);
    const renewedIds = new Set(
      successors.flatMap((row) => (row.supersedesId ? [row.supersedesId] : [])),
    );
    const predecessorNumbers = new Map(
      predecessors.map((row) => [row.id, row.contractNumber]),
    );
    const now = new Date();
    const expiringContracts = rows.flatMap((row) => {
      const daysRemaining = getContractDaysRemaining(row.endDate, now);
      return row.status === "ACTIVE" && daysRemaining >= 0 && daysRemaining <= 7
        ? [{
            key: row.id,
            contractNumber: row.contractNumber,
            customer: row.counterparty.legalName,
            endDate: row.endDate,
            daysRemaining,
          }]
        : [];
    });
    const workbookContracts = workbookRows.map((row) => {
      const value = demoData(row.data);
      const endDate = parseFinanceContractPeriodEnd(value.period);
      const daysRemaining = endDate
        ? getContractDaysRemaining(endDate, now)
        : null;
      if (
        endDate &&
        daysRemaining != null &&
        daysRemaining >= 0 &&
        daysRemaining <= 7
      ) {
        expiringContracts.push({
          key: row.id,
          contractNumber: demoText(value.contractNumber) || "Tanpa nomor",
          customer: demoText(value.customer) || "Tanpa nama user",
          endDate,
          daysRemaining,
        });
      }
      return { ...row, value, endDate, daysRemaining };
    });
    const reminderDemo = buildContractReminderDemo([
      ...rows.map((row) => ({
        contractNumber: row.contractNumber,
        customer: row.counterparty.legalName,
        endDate: row.endDate,
      })),
      ...workbookContracts.map((row) => ({
        contractNumber: workbookText(row.value.contractNumber) || "Tanpa nomor",
        customer: workbookText(row.value.customer) || "Tanpa nama user",
        endDate: row.endDate,
      })),
    ], now);
    return (
      <main className="space-y-4 px-4 pb-8 sm:px-6">
        <Header
          title="Data kontrak mekanik all site"
          description="User, vendor, nomor kontrak, penandatangan, periode, nilai, mekanik, jam kerja, dan catatan."
        />
        <ContractReminderDemo reminder={reminderDemo} />
        {expiringContracts.length ? (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950">
            <div className="flex items-start gap-3">
              <Clock3 className="mt-0.5 h-5 w-5 shrink-0" />
              <div className="space-y-2">
                <div>
                  <p className="font-semibold">Pengingat periode kontrak</p>
                  <p className="text-sm">
                    {expiringContracts.length.toLocaleString("id-ID")} kontrak akan
                    berakhir dalam tujuh hari. Segera periksa perpanjangan dan
                    pekerjaan yang masih terbuka.
                  </p>
                </div>
                <ul className="space-y-1 text-sm">
                  {expiringContracts.map((contract) => (
                    <li key={contract.key}>
                      <span className="font-medium">{contract.contractNumber}</span>
                      {" · "}
                      {contract.customer}
                      {" · "}
                      {contract.daysRemaining === 0
                        ? "berakhir hari ini"
                        : `berakhir ${contract.daysRemaining} hari lagi`}
                      {" ("}{date(contract.endDate)}{")"}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        ) : null}
        {workbookContracts.length ? (
          <div className="overflow-hidden rounded-xl border bg-card">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1500px] text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr>
                    <th className="p-3">User</th>
                    <th className="p-3">Vendor</th>
                    <th className="p-3">Nomor kontrak</th>
                    <th className="p-3">TTD kontrak / Direktur</th>
                    <th className="p-3">Periode kontrak</th>
                    <th className="p-3 text-right">Nilai kontrak</th>
                    <th className="p-3 text-right">Total mekanik</th>
                    <th className="p-3">Jam kerja</th>
                    <th className="p-3">Catatan</th>
                  </tr>
                </thead>
                <tbody>
                  {workbookContracts.map((row) => {
                    const { value } = row;
                    const contractValue = demoNumber(value.additionalValue) || demoNumber(value.contractValue);
                    return (
                      <tr
                        key={row.id}
                        className={
                          row.daysRemaining != null &&
                          row.daysRemaining >= 0 &&
                          row.daysRemaining <= 7
                            ? "border-t bg-amber-50 align-top"
                            : "border-t align-top"
                        }
                      >
                        <td className="p-3 font-medium">{demoText(value.customer)}</td>
                        <td className="p-3">{demoText(value.vendor)}</td>
                        <td className="p-3">{demoText(value.contractNumber)}</td>
                        <td className="p-3">{demoText(value.signatory)}</td>
                        <td className="p-3">
                          <p>{demoText(value.period)}</p>
                          {row.daysRemaining != null &&
                          row.daysRemaining >= 0 &&
                          row.daysRemaining <= 7 ? (
                            <Badge variant="destructive" className="mt-1">
                              {row.daysRemaining === 0
                                ? "Berakhir hari ini"
                                : `${row.daysRemaining} hari lagi`}
                            </Badge>
                          ) : null}
                        </td>
                        <td className="p-3 text-right">{contractValue ? money(contractValue) : "—"}</td>
                        <td className="p-3 text-right">{demoText(value.mechanicCount)}</td>
                        <td className="p-3">{demoText(value.workingHours)}</td>
                        <td className="p-3">{demoText(value.remarks)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
        <ContractCrudManager
          rows={rows.map((row) => ({
            id: row.id,
            contractNumber: row.contractNumber,
            customerName: row.counterparty.legalName,
            type: row.type,
            status: row.status,
            version: row.version,
            supersedesNumber: row.supersedesId
              ? predecessorNumbers.get(row.supersedesId) ?? ""
              : "",
            hasSuccessor: renewedIds.has(row.id),
            projectName: row.projectName ?? "",
            siteName: row.siteName ?? "",
            startDate: dateInput(row.startDate),
            endDate: dateInput(row.endDate),
            contractValue: Number(row.contractValue ?? 0),
            notes: row.notes ?? "",
            lineCount: row._count.lines,
            purchaseOrderCount: row._count.purchaseOrders,
            daysRemaining: getContractDaysRemaining(row.endDate, now),
            lines: row.lines.map((line) => ({
              itemName: line.itemName,
              partNumber: line.partNumber ?? "",
              quantity:
                line.contractedQuantity == null
                  ? ""
                  : String(line.contractedQuantity),
              unitPrice:
                line.unitPrice == null ? "" : String(Number(line.unitPrice)),
            })),
          }))}
          customers={contractCustomers.map((customer) => customer.legalName)}
        />
      </main>
    );
  }

  const [approvals, events] = await Promise.all([
    prismadb.financeApproval.findMany({ orderBy: { requestedAt: "desc" }, take: 50 }),
    prismadb.financeAuditEvent.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
  ]);
  return (
    <main className="space-y-5 px-4 pb-8 sm:px-6">
      <Header title="Persetujuan & riwayat audit" description="Persetujuan dan catatan perubahan data keuangan." />
      <Card>
        <CardHeader><CardTitle className="text-base">Persetujuan</CardTitle></CardHeader>
        <CardContent>
          {approvals.length ? (
            <div className="space-y-2">
              {approvals.map((row) => (
                <div key={row.id} className="flex items-center justify-between rounded-lg border p-3 text-sm">
                  <div>
                    <p className="font-medium">{actionLabel[row.action] ?? row.action}</p>
                    <p className="text-muted-foreground">
                      {entityLabel[row.entityType] ?? row.entityType} · {row.entityId.slice(0, 8)}
                    </p>
                  </div>
                  <Badge variant={row.status === "PENDING" ? "destructive" : "outline"}>
                    {statusLabel[row.status] ?? row.status}
                  </Badge>
                </div>
              ))}
            </div>
          ) : <Empty>Tidak ada persetujuan yang menunggu.</Empty>}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">Riwayat perubahan</CardTitle></CardHeader>
        <CardContent>
          {events.length ? (
            <div className="space-y-2">
              {events.map((row) => (
                <div key={row.id} className="flex items-start justify-between gap-4 border-b py-3 text-sm last:border-0">
                  <div>
                    <p className="font-medium">{actionLabel[row.action] ?? row.action}</p>
                    <p className="text-muted-foreground">
                      {entityLabel[row.entityType] ?? row.entityType} · {row.entityId}
                    </p>
                  </div>
                  <time className="whitespace-nowrap text-muted-foreground">{date(row.createdAt)}</time>
                </div>
              ))}
            </div>
          ) : <Empty>Belum ada riwayat perubahan.</Empty>}
        </CardContent>
      </Card>
    </main>
  );
}
