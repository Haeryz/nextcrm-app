import { AlertTriangle, ArrowDownLeft, ArrowUpRight, Banknote, Clock3, FileCheck2, Landmark, ReceiptText, ShieldCheck } from "lucide-react";
import { getFinanceOverview } from "@/actions/mektek/finance";
import { prismadb } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type FinanceSection = "overview" | "invoices" | "payables" | "cash" | "contracts" | "audit";

const money = (value: unknown) => Number(value ?? 0).toLocaleString("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
const date = (value: Date | null | undefined) => value ? new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(value) : "â€”";

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">{children}</div>;
}

function Header({ title, description }: { title: string; description: string }) {
  return <div><h2 className="text-xl font-semibold">{title}</h2><p className="text-sm text-muted-foreground">{description}</p></div>;
}

export default async function FinanceWorkspace({ section }: { section: FinanceSection }) {
  if (section === "overview") {
    const result = await getFinanceOverview();
    if (!("data" in result)) return <Empty>Finance tidak dapat dimuat.</Empty>;
    const value = result.data;
    const cards = [
      ["Cash in", money(value.cashIn), ArrowDownLeft],
      ["Cash out", money(value.cashOut), ArrowUpRight],
      ["Piutang terbuka", money(value.receivable), ReceiptText],
      ["Hutang terbuka", money(value.payable), Landmark],
    ] as const;
    const queues = [
      ["Approval menunggu", value.pendingApprovals, ShieldCheck],
      ["Sumber belum ditagih", value.unbilledSources, FileCheck2],
      ["Receiving belum dicocokkan", value.unmatchedPayables, AlertTriangle],
      ["Kontrak berakhir â‰¤30 hari", value.expiringContracts, Clock3],
    ] as const;
    return <main className="space-y-6 px-4 pb-8 sm:px-6">
      <Header title="Financial command center" description="Prioritas kerja dan posisi kas yang dihitung dari dokumen sumber." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards.map(([label, amount, Icon]) => <Card key={label}><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm">{label}</CardTitle><Icon className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><p className="text-2xl font-semibold">{amount}</p></CardContent></Card>)}</div>
      <Card><CardHeader><CardTitle className="text-base">Action queue</CardTitle></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2">{queues.map(([label, count, Icon]) => <div key={label} className="flex items-center justify-between rounded-lg border p-4"><div className="flex items-center gap-3"><Icon className="h-5 w-5 text-muted-foreground" /><span className="text-sm font-medium">{label}</span></div><Badge variant={Number(count) ? "destructive" : "secondary"}>{count}</Badge></div>)}</CardContent></Card>
    </main>;
  }

  if (section === "invoices") {
    const rows = await prismadb.financeInvoice.findMany({ orderBy: { createdAt: "desc" }, take: 100, include: { counterparty: { select: { legalName: true } }, allocations: { where: { receipt: { status: "POSTED" } }, select: { amount: true } } } });
    return <main className="space-y-4 px-4 pb-8 sm:px-6"><Header title="Accounts receivable" description="Invoice persistent, saldo, dan jatuh tempoâ€”terhubung ke surat jalan atau service order." />{rows.length ? <div className="overflow-hidden rounded-xl border bg-card"><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-muted/50 text-left"><tr><th className="p-3">Invoice</th><th className="p-3">Customer</th><th className="p-3">Due</th><th className="p-3">Status</th><th className="p-3 text-right">Balance</th></tr></thead><tbody>{rows.map((row) => { const paid = row.allocations.reduce((sum, item) => sum + Number(item.amount), 0); return <tr key={row.id} className="border-t"><td className="p-3 font-medium">{row.invoiceNumber ?? `Draft ${row.draftNumber.slice(0, 8)}`}</td><td className="p-3">{row.counterparty.legalName}</td><td className="p-3">{date(row.dueDate)}</td><td className="p-3"><Badge variant="outline">{row.status}</Badge></td><td className="p-3 text-right font-medium">{money(Math.max(0, Number(row.netAmount) - paid))}</td></tr>; })}</tbody></table></div></div> : <Empty>Belum ada invoice. Sumber tagihan akan muncul dari surat jalan atau service order.</Empty>}</main>;
  }

  if (section === "payables") {
    const rows = await prismadb.financeSupplierBill.findMany({ orderBy: { createdAt: "desc" }, take: 100, include: { counterparty: { select: { legalName: true } }, allocations: { where: { disbursement: { status: "POSTED" } }, select: { amount: true } } } });
    return <main className="space-y-4 px-4 pb-8 sm:px-6"><Header title="Accounts payable" description="Three-way matching receiving, supplier invoice, dan pembayaran." />{rows.length ? <div className="grid gap-3">{rows.map((row) => <Card key={row.id}><CardContent className="flex flex-wrap items-center justify-between gap-4 p-4"><div><p className="font-medium">{row.internalNumber} Â· {row.counterparty.legalName}</p><p className="text-sm text-muted-foreground">Supplier invoice {row.supplierInvoiceNumber} Â· due {date(row.dueDate)}</p></div><div className="text-right"><Badge variant={row.matchException ? "destructive" : "outline"}>{row.matchException ? "MATCH EXCEPTION" : row.status}</Badge><p className="mt-1 font-semibold">{money(Number(row.totalAmount) - row.allocations.reduce((sum, item) => sum + Number(item.amount), 0))}</p></div></CardContent></Card>)}</div> : <Empty>Belum ada supplier bill. Receiving akan menjadi sumber payable untuk dicocokkan.</Empty>}</main>;
  }

  if (section === "cash") {
    const [receipts, payments] = await Promise.all([prismadb.financeReceipt.findMany({ orderBy: { receivedAt: "desc" }, take: 50, include: { counterparty: { select: { legalName: true } } } }), prismadb.financeDisbursement.findMany({ orderBy: { paidAt: "desc" }, take: 50, include: { counterparty: { select: { legalName: true } } } })]);
    const rows = [...receipts.map((row) => ({ id: row.id, direction: "IN", number: row.receiptNumber, party: row.counterparty.legalName, at: row.receivedAt, amount: row.amount, status: row.status })), ...payments.map((row) => ({ id: row.id, direction: "OUT", number: row.paymentNumber, party: row.counterparty.legalName, at: row.paidAt, amount: row.amount, status: row.status }))].sort((a, b) => b.at.getTime() - a.at.getTime());
    return <main className="space-y-4 px-4 pb-8 sm:px-6"><Header title="Cash ledger" description="Penerimaan dan pengeluaran dengan alokasi ke dokumen, bukan total yang diedit manual." />{rows.length ? <div className="grid gap-3">{rows.map((row) => <div key={row.id} className="flex items-center justify-between rounded-xl border bg-card p-4"><div className="flex items-center gap-3">{row.direction === "IN" ? <ArrowDownLeft className="text-emerald-600" /> : <ArrowUpRight className="text-rose-600" />}<div><p className="font-medium">{row.number} Â· {row.party}</p><p className="text-sm text-muted-foreground">{date(row.at)} Â· {row.status}</p></div></div><p className="font-semibold">{row.direction === "IN" ? "+" : "âˆ’"}{money(row.amount)}</p></div>)}</div> : <Empty>Belum ada transaksi kas.</Empty>}</main>;
  }

  if (section === "contracts") {
    const rows = await prismadb.financeContract.findMany({ orderBy: { endDate: "asc" }, take: 100, include: { counterparty: { select: { legalName: true } }, _count: { select: { lines: true, purchaseOrders: true } } } });
    return <main className="space-y-4 px-4 pb-8 sm:px-6"><Header title="Contracts & commercial terms" description="Sumber harga dan periode supply untuk mencegah order ganda Manual/Consignment." />{rows.length ? <div className="grid gap-3 lg:grid-cols-2">{rows.map((row) => <Card key={row.id}><CardContent className="p-5"><div className="flex justify-between gap-3"><div><p className="font-semibold">{row.contractNumber}</p><p className="text-sm text-muted-foreground">{row.counterparty.legalName} Â· {row.type}</p></div><Badge variant="outline">{row.status}</Badge></div><div className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><p className="text-muted-foreground">Period</p><p>{date(row.startDate)} â€“ {date(row.endDate)}</p></div><div><p className="text-muted-foreground">Coverage</p><p>{row._count.lines} items Â· {row._count.purchaseOrders} PO</p></div></div></CardContent></Card>)}</div> : <Empty>Belum ada kontrak. Tambahkan kontrak sebagai sumber harga dan window supply.</Empty>}</main>;
  }

  const [approvals, events] = await Promise.all([prismadb.financeApproval.findMany({ orderBy: { requestedAt: "desc" }, take: 50 }), prismadb.financeAuditEvent.findMany({ orderBy: { createdAt: "desc" }, take: 100 })]);
  return <main className="space-y-5 px-4 pb-8 sm:px-6"><Header title="Approval & audit trail" description="Maker-checker dan riwayat immutable untuk setiap perubahan material." /><Card><CardHeader><CardTitle className="text-base">Pending approvals</CardTitle></CardHeader><CardContent>{approvals.length ? <div className="space-y-2">{approvals.map((row) => <div key={row.id} className="flex items-center justify-between rounded-lg border p-3 text-sm"><div><p className="font-medium">{row.action}</p><p className="text-muted-foreground">{row.entityType} Â· {row.entityId.slice(0, 8)}</p></div><Badge variant={row.status === "PENDING" ? "destructive" : "outline"}>{row.status}</Badge></div>)}</div> : <Empty>Tidak ada approval.</Empty>}</CardContent></Card><Card><CardHeader><CardTitle className="text-base">Audit events</CardTitle></CardHeader><CardContent>{events.length ? <div className="space-y-2">{events.map((row) => <div key={row.id} className="flex items-start justify-between gap-4 border-b py-3 text-sm last:border-0"><div><p className="font-medium">{row.action}</p><p className="text-muted-foreground">{row.entityType} Â· {row.entityId}</p></div><time className="whitespace-nowrap text-muted-foreground">{date(row.createdAt)}</time></div>)}</div> : <Empty>Belum ada audit event.</Empty>}</CardContent></Card></main>;
}
