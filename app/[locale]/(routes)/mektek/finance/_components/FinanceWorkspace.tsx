import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Clock3,
  FileCheck2,
  Landmark,
  ReceiptText,
  ShieldCheck,
} from "lucide-react";

import { getFinanceOverview } from "@/actions/mektek/finance";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prismadb } from "@/lib/prisma";

import InvoiceCrudManager, { type FinanceInvoiceCrudRow } from "./InvoiceCrudManager";

export type FinanceSection =
  | "overview"
  | "invoices"
  | "delivery-notes"
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

export default async function FinanceWorkspace({ section }: { section: FinanceSection }) {
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
        orderBy: { createdAt: "desc" },
        take: 200,
        include: {
          counterparty: { select: { legalName: true } },
          lines: { orderBy: { position: "asc" }, take: 1 },
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
        subtotal: Number(row.subtotal),
        taxRate: Number(row.taxRate) * 100,
        taxInvoiceNumber: row.taxInvoiceNumber ?? "",
        accountDestination: row.accountDestination ?? "",
        notes: row.notes ?? "",
        total: Number(row.netAmount),
        balance: Math.max(0, Number(row.netAmount) - paid),
        hasPayment: row.allocations.length > 0,
      };
    });

    return (
      <main className="space-y-4 px-4 pb-8 sm:px-6">
        <Header
          title="Rekap invoice"
          description="Tambah, lihat, ubah, dan hapus data invoice sesuai format kerja akuntansi."
        />
        <InvoiceCrudManager rows={rows} customerNames={customers.map((row) => row.legalName)} />
      </main>
    );
  }

  if (section === "delivery-notes") {
    const rows = await prismadb.financeInvoice.findMany({
      where: { deliveryNoteNumber: { not: null } },
      orderBy: [{ deliveryNoteDate: "desc" }, { invoiceDate: "desc" }],
      take: 300,
      include: { counterparty: { select: { legalName: true } } },
    });
    return (
      <main className="space-y-4 px-4 pb-8 sm:px-6">
        <Header
          title="Rekap surat jalan"
          description="Daftar surat jalan atau berita acara yang terhubung ke invoice dan PO."
        />
        {rows.length ? (
          <div className="overflow-hidden rounded-xl border bg-card">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr>
                    <th className="p-3">Pelanggan</th>
                    <th className="p-3">Nomor SJ / BA</th>
                    <th className="p-3">Tanggal SJ</th>
                    <th className="p-3">Nomor invoice</th>
                    <th className="p-3">Nomor PO</th>
                    <th className="p-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-t">
                      <td className="p-3">{row.counterparty.legalName}</td>
                      <td className="p-3 font-medium">{row.deliveryNoteNumber}</td>
                      <td className="p-3">{date(row.deliveryNoteDate)}</td>
                      <td className="p-3">{row.invoiceNumber ?? "—"}</td>
                      <td className="p-3">{row.purchaseOrderNumber ?? "—"}</td>
                      <td className="p-3 text-right font-medium">{money(row.netAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : <Empty>Belum ada surat jalan. Data dimasukkan melalui Rekap Invoice.</Empty>}
      </main>
    );
  }

  if (section === "revenue") {
    const invoices = await prismadb.financeInvoice.findMany({
      where: { status: { not: "VOID" } },
      include: {
        counterparty: { select: { legalName: true } },
        lines: { select: { description: true, lineTotal: true } },
      },
    });
    const totals = new Map<string, { jasa: number; sukuCadang: number; ppn: number }>();
    for (const invoice of invoices) {
      const current = totals.get(invoice.counterparty.legalName) ?? { jasa: 0, sukuCadang: 0, ppn: 0 };
      for (const line of invoice.lines) {
        const isPart = /(spare\s*part|suku cadang|part|weld|penjualan)/i.test(line.description);
        if (isPart) current.sukuCadang += Number(line.lineTotal);
        else current.jasa += Number(line.lineTotal);
      }
      current.ppn += Number(invoice.taxAmount);
      totals.set(invoice.counterparty.legalName, current);
    }
    const rows = [...totals.entries()].sort(([a], [b]) => a.localeCompare(b, "id"));

    return (
      <main className="space-y-4 px-4 pb-8 sm:px-6">
        <Header
          title="Rekap pendapatan jasa & suku cadang"
          description="Rekap otomatis dari data invoice; nilai tidak perlu diketik ulang."
        />
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
    const rows = await prismadb.financeContract.findMany({
      orderBy: { endDate: "asc" },
      take: 100,
      include: {
        counterparty: { select: { legalName: true } },
        _count: { select: { lines: true, purchaseOrders: true } },
      },
    });
    return (
      <main className="space-y-4 px-4 pb-8 sm:px-6">
        <Header title="Kontrak" description="Nomor kontrak, periode, nilai, dan cakupan pekerjaan." />
        {rows.length ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {rows.map((row) => (
              <Card key={row.id}>
                <CardContent className="p-5">
                  <div className="flex justify-between gap-3">
                    <div>
                      <p className="font-semibold">{row.contractNumber}</p>
                      <p className="text-sm text-muted-foreground">
                        {row.counterparty.legalName} · {contractTypeLabel[row.type] ?? row.type}
                      </p>
                    </div>
                    <Badge variant="outline">{statusLabel[row.status] ?? row.status}</Badge>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div><p className="text-muted-foreground">Periode</p><p>{date(row.startDate)} – {date(row.endDate)}</p></div>
                    <div>
                      <p className="text-muted-foreground">Cakupan</p>
                      <p>{row._count.lines} item · {row._count.purchaseOrders} PO</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : <Empty>Belum ada kontrak.</Empty>}
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
