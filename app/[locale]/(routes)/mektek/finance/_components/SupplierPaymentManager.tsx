"use client";

import { FormEvent, useMemo, useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  AlertTriangle,
  Calculator,
  CheckCircle2,
  ClipboardCheck,
  ExternalLink,
  Loader2,
  ZoomIn,
  Send,
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  createMatchedFinanceSupplierBill,
  submitFinanceSupplierBillForApproval,
} from "@/actions/mektek/finance";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { calculateSupplierPayable } from "@/lib/mektek/supplier-payment";

export type SupplierPaymentSource = {
  id: string;
  purchaseOrderId: string | null;
  supplierName: string;
  receivingReference: string;
  receivedAt: string;
  poNumber: string;
  projectName: string;
  pricingComplete: boolean;
  supplierInvoiceImageAvailable: boolean;
  deliveryNoteImageAvailable: boolean;
  expectedSubtotal: number | null;
  pricingIssues: Array<{
    description: string;
    partNumber: string | null;
    quantity: number;
  }>;
  lines: Array<{
    description: string;
    partNumber: string | null;
    quantity: number;
    unitCost: number;
    lineTotal: number;
  }>;
};

export type SupplierPaymentRow = {
  id: string;
  internalNumber: string;
  supplierName: string;
  supplierInvoiceNumber: string;
  receivingReference: string;
  receivedAt: string;
  poNumber: string;
  billDate: string;
  dueDate: string;
  subtotal: number;
  taxAmount: number;
  grandTotal: number;
  remainingAmount: number;
  status:
    | "DRAFT"
    | "PENDING_APPROVAL"
    | "POSTED"
    | "PARTIALLY_PAID"
    | "PAID"
    | "VOID";
  matchException: string | null;
};

const rupiah = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

const dateLabel = (value: string) =>
  new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00.000Z`));

const statusLabel: Record<SupplierPaymentRow["status"], string> = {
  DRAFT: "Draf",
  PENDING_APPROVAL: "Menunggu persetujuan",
  POSTED: "Siap dibayar",
  PARTIALLY_PAID: "Dibayar sebagian",
  PAID: "Lunas",
  VOID: "Dibatalkan",
};

const emptyChecks = {
  purchaseOrder: false,
  supplierInvoice: false,
  goodsReceipt: false,
};

function InlineDocumentPreview({
  title,
  reference,
  href,
  available,
  unavailableMessage,
  recoveryHref,
}: {
  title: string;
  reference: string;
  href: string;
  available: boolean;
  unavailableMessage: string;
  recoveryHref?: string | null;
}) {
  return (
    <div className="overflow-hidden rounded-xl border bg-muted/20">
      <div className="border-b bg-background px-4 py-3">
        <p className="font-medium">{title}</p>
        <p className="truncate text-xs text-muted-foreground">{reference}</p>
      </div>
      {available ? (
        <>
          <Link
            href={href}
            target="_blank"
            rel="noreferrer"
            className="group relative block h-[420px] overflow-hidden bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label={`Buka ${title} ${reference} ukuran penuh`}
          >
              <Image
                src={href}
                alt={`Pratinjau ${title} ${reference}`}
                fill
                unoptimized
                sizes="(min-width: 1024px) 33vw, 100vw"
                className="object-contain transition-transform duration-200 group-hover:scale-[1.015]"
              />
            <span className="absolute inset-0 flex items-center justify-center bg-slate-950/0 transition group-hover:bg-slate-950/15">
              <span className="flex translate-y-2 items-center gap-2 rounded-full bg-slate-950/85 px-3 py-2 text-xs font-medium text-white opacity-0 shadow-lg transition group-hover:translate-y-0 group-hover:opacity-100">
                <ZoomIn className="size-4" />
                Klik untuk memperbesar
              </span>
            </span>
          </Link>
          <div className="border-t bg-background p-3">
            <Button asChild type="button" size="sm" variant="outline">
              <Link href={href} target="_blank" rel="noreferrer">
                Buka ukuran penuh
                <ExternalLink className="ml-2 size-3.5" />
              </Link>
            </Button>
          </div>
        </>
      ) : (
        <div className="flex h-[420px] flex-col items-center justify-center gap-4 p-6 text-center text-sm text-muted-foreground">
          <p>{unavailableMessage}</p>
          {recoveryHref ? (
            <Button asChild type="button" size="sm" variant="outline">
              <Link href={recoveryHref}>Buka Receiving</Link>
            </Button>
          ) : null}
        </div>
      )}
    </div>
  );
}

export default function SupplierPaymentManager({
  sources,
  rows,
}: {
  sources: SupplierPaymentSource[];
  rows: SupplierPaymentRow[];
}) {
  const router = useRouter();
  const { locale = "id" } = useParams<{ locale?: string }>();
  const [pending, startTransition] = useTransition();
  const [sourceId, setSourceId] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [billDate, setBillDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [taxAmount, setTaxAmount] = useState("");
  const [expenseCategory, setExpenseCategory] = useState("Pembelian barang");
  const [notes, setNotes] = useState("");
  const [checks, setChecks] = useState(emptyChecks);
  const selected = sources.find((source) => source.id === sourceId) ?? null;
  const receivingHref =
    selected?.purchaseOrderId
      ? `/${locale}/mektek/receiving?q=${encodeURIComponent(
          selected.poNumber,
        )}&detail=${encodeURIComponent(selected.purchaseOrderId)}`
      : null;
  const sourceDocumentHref = (
    document: "purchase-order" | "supplier-invoice" | "delivery-note",
  ) =>
    selected
      ? `/api/mektek/finance/payables/sources/${encodeURIComponent(
          selected.id,
        )}/documents/${document}`
      : "";
  const calculated = calculateSupplierPayable(
    selected?.expectedSubtotal ?? 0,
    taxAmount,
  );
  const documentsComplete = Object.values(checks).every(Boolean);

  const summary = useMemo(
    () => ({
      pendingDocuments: sources.length,
      waitingApproval: rows.filter((row) => row.status === "PENDING_APPROVAL")
        .length,
      outstanding: rows
        .filter((row) => !["PAID", "VOID"].includes(row.status))
        .reduce((sum, row) => sum + row.remainingAmount, 0),
    }),
    [rows, sources.length],
  );

  const reset = () => {
    setSourceId("");
    setInvoiceNumber("");
    setBillDate("");
    setDueDate("");
    setTaxAmount("");
    setExpenseCategory("Pembelian barang");
    setNotes("");
    setChecks(emptyChecks);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!selected || !documentsComplete || !selected.pricingComplete) return;
    startTransition(async () => {
      const result = await createMatchedFinanceSupplierBill({
        payableSourceId: selected.id,
        supplierInvoiceNumber: invoiceNumber,
        billDate,
        dueDate,
        taxAmount,
        expenseCategory,
        notes,
        purchaseOrderVerified: checks.purchaseOrder,
        supplierInvoiceVerified: checks.supplierInvoice,
        goodsReceiptVerified: checks.goodsReceipt,
      });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Tagihan pemasok berhasil dicatat");
      reset();
      router.refresh();
    });
  };

  const requestApproval = (billId: string) => {
    startTransition(async () => {
      try {
        const result = await submitFinanceSupplierBillForApproval(billId);
        if ("error" in result) {
          toast.error(result.error);
          return;
        }
        toast.success("Tagihan dikirim untuk persetujuan");
        router.refresh();
      } catch {
        toast.error("Status tagihan sudah berubah. Muat ulang halaman.");
      }
    });
  };

  return (
    <main className="space-y-6 px-4 pb-10 sm:px-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
          Finance · Utang Usaha
        </p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight">
          Pembayaran Pemasok
        </h2>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Cocokkan Purchase Order, Invoice Pemasok, dan Surat Jalan / Tanda
          Terima dari Logistics sebelum menghitung jumlah yang harus dibayar.
        </p>
      </div>

      <section className="grid gap-3 md:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Dokumen belum dicatat</p>
            <p className="mt-1 text-2xl font-semibold">
              {summary.pendingDocuments}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">
              Menunggu persetujuan
            </p>
            <p className="mt-1 text-2xl font-semibold">
              {summary.waitingApproval}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Sisa harus dibayar</p>
            <p className="mt-1 text-2xl font-semibold">
              {rupiah.format(summary.outstanding)}
            </p>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardCheck className="size-5 text-primary" />
            Pencocokan tiga dokumen
          </CardTitle>
          <CardDescription>
            Pilih penerimaan Logistics. Data supplier, PO, surat jalan, barang,
            kuantitas, dan harga akan diambil otomatis.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-6" onSubmit={submit}>
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="space-y-2 lg:col-span-2">
                <Label htmlFor="supplier-source">Dokumen dari Logistics</Label>
                <select
                  id="supplier-source"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={sourceId}
                  onChange={(event) => {
                    setSourceId(event.target.value);
                    setChecks(emptyChecks);
                  }}
                  required
                >
                  <option value="">Pilih PO dan surat jalan...</option>
                  {sources.map((source) => (
                    <option key={source.id} value={source.id}>
                      {source.supplierName} · {source.poNumber} ·{" "}
                      {source.receivingReference} · {dateLabel(source.receivedAt)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Proyek</Label>
                <Input
                  value={selected?.projectName || "—"}
                  readOnly
                  className="bg-muted/40"
                />
              </div>
            </div>

            {selected ? (
              <>
                <div className="grid gap-3 md:grid-cols-3">
                  {[
                    {
                      key: "purchaseOrder" as const,
                      title: "Purchase Order",
                      value: selected.poNumber,
                      available: Boolean(selected.purchaseOrderId),
                    },
                    {
                      key: "supplierInvoice" as const,
                      title: "Invoice Pemasok",
                      value: invoiceNumber || "Masukkan nomor invoice",
                      available: selected.supplierInvoiceImageAvailable,
                    },
                    {
                      key: "goodsReceipt" as const,
                      title: "Surat Jalan / Tanda Terima",
                      value: `${selected.receivingReference} · Tanggal terima: ${dateLabel(selected.receivedAt)}`,
                      available: selected.deliveryNoteImageAvailable,
                    },
                  ].map((document) => (
                    <label
                      key={document.key}
                      className={`flex gap-3 rounded-xl border p-4 transition ${
                        document.available
                          ? "cursor-pointer"
                          : "cursor-not-allowed opacity-70"
                      } ${
                        checks[document.key]
                          ? "border-emerald-500/60 bg-emerald-500/5"
                          : "hover:border-primary/40"
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="mt-1 size-4 accent-emerald-600"
                        checked={checks[document.key]}
                        disabled={!document.available}
                        onChange={(event) =>
                          setChecks((current) => ({
                            ...current,
                            [document.key]: event.target.checked,
                          }))
                        }
                      />
                      <span className="min-w-0">
                        <span className="flex items-center gap-1.5 font-medium">
                          {checks[document.key] ? (
                            <CheckCircle2 className="size-4 text-emerald-600" />
                          ) : null}
                          {document.title}
                        </span>
                        <span className="mt-1 block truncate text-xs text-muted-foreground">
                          {document.value}
                        </span>
                        {!document.available ? (
                          <span className="mt-1 block text-xs font-medium text-amber-600">
                            Dokumen belum tersedia dari Logistics
                          </span>
                        ) : null}
                      </span>
                    </label>
                  ))}
                </div>
                <div className="grid gap-4 rounded-xl border border-emerald-300 bg-emerald-50/70 p-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="supplier-logistics-received-at">
                      Tanggal terima Logistics
                    </Label>
                    <Input
                      id="supplier-logistics-received-at"
                      type="date"
                      value={selected.receivedAt}
                      readOnly
                      aria-readonly="true"
                      className="bg-background font-medium"
                    />
                  </div>
                  <div className="self-end text-sm text-emerald-900">
                    Diisi oleh Logistics saat barang diterima dan disinkronkan
                    otomatis. Finance tidak perlu menginput ulang.
                  </div>
                </div>
                <section className="space-y-3">
                  <div>
                    <h3 className="font-semibold">Pratinjau dokumen</h3>
                    <p className="text-sm text-muted-foreground">
                      Periksa isi ketiga dokumen langsung sebelum mencentang
                      pencocokan.
                    </p>
                  </div>
                  <div className="grid gap-4 lg:grid-cols-3">
                    <InlineDocumentPreview
                      title="Purchase Order"
                      reference={selected.poNumber}
                      href={sourceDocumentHref("purchase-order")}
                      available={Boolean(selected.purchaseOrderId)}
                      unavailableMessage="Purchase Order tidak ditemukan."
                      recoveryHref={receivingHref}
                    />
                    <InlineDocumentPreview
                      title="Invoice Pemasok"
                      reference={invoiceNumber || selected.poNumber}
                      href={sourceDocumentHref("supplier-invoice")}
                      available={selected.supplierInvoiceImageAvailable}
                      unavailableMessage="Gambar invoice pemasok belum diunggah oleh Logistics."
                      recoveryHref={receivingHref}
                    />
                    <InlineDocumentPreview
                      title="Surat Jalan / Tanda Terima"
                      reference={selected.receivingReference}
                      href={sourceDocumentHref("delivery-note")}
                      available={selected.deliveryNoteImageAvailable}
                      unavailableMessage="Gambar Surat Jalan belum diunggah oleh Logistics."
                      recoveryHref={receivingHref}
                    />
                  </div>
                </section>
                {receivingHref ? (
                  <Button asChild type="button" size="sm" variant="outline">
                    <Link href={receivingHref}>
                      Periksa dokumen di Receiving
                    </Link>
                  </Button>
                ) : null}

                {!selected.pricingComplete ? (
                  <div className="flex gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
                    <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">Harga PO belum lengkap</p>
                      <p className="text-muted-foreground">
                        Dokumen yang perlu diperbaiki: PO{" "}
                        <strong>{selected.poNumber}</strong> dari{" "}
                        <strong>{selected.supplierName}</strong>, Surat Jalan{" "}
                        <strong>{selected.receivingReference}</strong>.
                      </p>
                      {selected.pricingIssues.length ? (
                        <p className="mt-2 text-muted-foreground">
                          Item tanpa harga:{" "}
                          {selected.pricingIssues
                            .map(
                              (issue) =>
                                `${issue.description}${
                                  issue.partNumber
                                    ? ` (${issue.partNumber})`
                                    : ""
                                }`,
                            )
                            .join(", ")}
                          .
                        </p>
                      ) : null}
                      <Button
                        asChild
                        type="button"
                        size="sm"
                        variant="outline"
                        className="mt-3 bg-background"
                      >
                        <Link
                          href={`/${locale}/mektek/finance/payables/sources/${selected.id}`}
                        >
                          Lihat detail dokumen
                        </Link>
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-xl border">
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[720px] text-sm">
                        <thead className="bg-muted/50 text-left">
                          <tr>
                            <th className="p-3">Barang</th>
                            <th className="p-3">Part Number</th>
                            <th className="p-3 text-right">QTY</th>
                            <th className="p-3 text-right">Harga</th>
                            <th className="p-3 text-right">Jumlah</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selected.lines.map((line, index) => (
                            <tr
                              key={`${line.description}-${index}`}
                              className="border-t"
                            >
                              <td className="p-3 font-medium">
                                {line.description}
                              </td>
                              <td className="p-3 text-muted-foreground">
                                {line.partNumber || "—"}
                              </td>
                              <td className="p-3 text-right">
                                {line.quantity}
                              </td>
                              <td className="p-3 text-right">
                                {rupiah.format(line.unitCost)}
                              </td>
                              <td className="p-3 text-right font-medium">
                                {rupiah.format(line.lineTotal)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            ) : null}

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <Label htmlFor="supplier-invoice-number">
                  Nomor invoice pemasok
                </Label>
                <Input
                  id="supplier-invoice-number"
                  value={invoiceNumber}
                  onChange={(event) => setInvoiceNumber(event.target.value)}
                  placeholder="Contoh: INV.FRG-001"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="supplier-bill-date">Tanggal invoice</Label>
                <Input
                  id="supplier-bill-date"
                  type="date"
                  value={billDate}
                  onChange={(event) => setBillDate(event.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="supplier-due-date">Jatuh tempo</Label>
                <Input
                  id="supplier-due-date"
                  type="date"
                  value={dueDate}
                  min={billDate || undefined}
                  onChange={(event) => setDueDate(event.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="supplier-tax">PPN / pajak (Rp)</Label>
                <Input
                  id="supplier-tax"
                  type="number"
                  min="0"
                  step="1"
                  value={taxAmount}
                  onChange={(event) => setTaxAmount(event.target.value)}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="supplier-expense">Kategori biaya</Label>
                <Input
                  id="supplier-expense"
                  value={expenseCategory}
                  onChange={(event) => setExpenseCategory(event.target.value)}
                />
              </div>
              <div className="space-y-2 md:col-span-2 lg:col-span-3">
                <Label htmlFor="supplier-notes">Catatan</Label>
                <Textarea
                  id="supplier-notes"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Keterangan tambahan (opsional)"
                  rows={2}
                />
              </div>
            </div>

            <div className="flex flex-col gap-4 rounded-xl bg-slate-950 p-5 text-white sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="flex items-center gap-2 text-sm text-slate-300">
                  <Calculator className="size-4" />
                  Perhitungan pembayaran
                </p>
                <div className="mt-3 flex flex-wrap gap-x-8 gap-y-2 text-sm">
                  <span>
                    Subtotal{" "}
                    <strong>{rupiah.format(calculated.subtotal)}</strong>
                  </span>
                  <span>
                    Pajak <strong>{rupiah.format(calculated.taxAmount)}</strong>
                  </span>
                </div>
                <p className="mt-2 text-2xl font-semibold">
                  {rupiah.format(calculated.grandTotal)}
                </p>
              </div>
              <Button
                type="submit"
                disabled={
                  pending ||
                  !selected ||
                  !selected.pricingComplete ||
                  !documentsComplete
                }
                className="bg-white text-slate-950 hover:bg-slate-200"
              >
                {pending ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <ClipboardCheck className="mr-2 size-4" />
                )}
                Simpan tagihan
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Register Pembayaran Pemasok</CardTitle>
          <CardDescription>
            Rekap digital mengikuti kolom buku: tanggal, supplier, nomor
            invoice/surat jalan, nomor PO, dan grand total.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {rows.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-sm">
                <thead className="border-y bg-muted/50 text-left">
                  <tr>
                    <th className="p-3 pl-6">Tanggal invoice</th>
                    <th className="p-3">Tanggal terima</th>
                    <th className="p-3">Nama Supplier</th>
                    <th className="p-3">No. Invoice / No. SJ</th>
                    <th className="p-3">No. PO</th>
                    <th className="p-3 text-right">Grand Total</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 pr-6 text-right">Tindakan</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-b last:border-0">
                      <td className="p-3 pl-6 align-top">
                        {dateLabel(row.billDate)}
                        <p className="mt-1 text-xs text-muted-foreground">
                          {row.internalNumber}
                        </p>
                      </td>
                      <td className="p-3 align-top">
                        {row.receivedAt ? dateLabel(row.receivedAt) : "—"}
                        <p className="mt-1 text-xs text-muted-foreground">
                          Dari Logistics
                        </p>
                      </td>
                      <td className="p-3 align-top font-medium">
                        {row.supplierName}
                      </td>
                      <td className="p-3 align-top">
                        <p>{row.supplierInvoiceNumber}</p>
                        <p className="text-xs text-muted-foreground">
                          SJ: {row.receivingReference || "—"}
                        </p>
                      </td>
                      <td className="p-3 align-top">{row.poNumber || "—"}</td>
                      <td className="p-3 text-right align-top font-semibold">
                        {rupiah.format(row.grandTotal)}
                        {row.remainingAmount !== row.grandTotal ? (
                          <p className="text-xs font-normal text-muted-foreground">
                            Sisa {rupiah.format(row.remainingAmount)}
                          </p>
                        ) : null}
                      </td>
                      <td className="p-3 align-top">
                        <Badge
                          variant={
                            row.matchException ? "destructive" : "outline"
                          }
                        >
                          {row.matchException
                            ? "Perlu diperiksa"
                            : statusLabel[row.status]}
                        </Badge>
                      </td>
                      <td className="p-3 pr-6 text-right align-top">
                        {row.status === "DRAFT" ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={pending}
                            onClick={() => requestApproval(row.id)}
                          >
                            <Send className="mr-2 size-3.5" />
                            Ajukan
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            Jatuh tempo {dateLabel(row.dueDate)}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="px-6 py-12 text-center text-sm text-muted-foreground">
              Belum ada tagihan pemasok. Pilih dokumen Logistics di atas untuk
              membuat catatan pertama.
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
