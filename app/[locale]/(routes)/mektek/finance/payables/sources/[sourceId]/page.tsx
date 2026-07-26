import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  FileText,
} from "lucide-react";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { parseSupplierPayableSnapshot } from "@/lib/mektek/supplier-payment";
import { prismadb } from "@/lib/prisma";

const rupiah = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

const dateLabel = (value: Date) =>
  new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(value);

export default async function SupplierPayableSourceDetailPage({
  params,
}: {
  params: Promise<{ locale: string; sourceId: string }>;
}) {
  const { locale, sourceId } = await params;
  const source = await prismadb.financePayableSource.findUnique({
    where: { id: sourceId },
    include: {
      counterparty: { select: { legalName: true } },
    },
  });
  if (!source) notFound();

  const snapshot = parseSupplierPayableSnapshot(source.snapshot);
  const purchaseOrder = snapshot.purchaseOrderId
    ? await prismadb.logisticsPurchaseOrder.findFirst({
        where: { id: snapshot.purchaseOrderId, flow: "RECEIVING" },
        select: {
          id: true,
          supplierInvoiceImageUpdatedAt: true,
          deliveryNoteImageUpdatedAt: true,
          receivingDeliveryNoteSource: true,
        },
      })
    : null;
  const documentHref = (
    document: "purchase-order" | "supplier-invoice" | "delivery-note",
  ) =>
    `/api/mektek/finance/payables/sources/${encodeURIComponent(
      source.id,
    )}/documents/${document}`;
  const receivingHref = `/${locale}/mektek/receiving?q=${encodeURIComponent(
    snapshot.poNumber,
  )}&detail=${encodeURIComponent(snapshot.purchaseOrderId || "")}`;
  const reportText = [
    "Mohon lengkapi harga item pada dokumen Receiving berikut:",
    `Supplier: ${source.counterparty.legalName}`,
    `No. PO: ${snapshot.poNumber || "-"}`,
    `No. Surat Jalan / Tanda Terima: ${source.sourceReference || "-"}`,
    `Item tanpa harga: ${
      snapshot.pricingIssues
        .map(
          (issue) =>
            `${issue.description}${
              issue.partNumber ? ` (${issue.partNumber})` : ""
            } - QTY ${issue.quantity}`,
        )
        .join("; ") || "-"
    }`,
  ].join("\n");

  return (
    <main className="space-y-6 px-4 pb-10 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            Finance · Pemeriksaan Dokumen
          </p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight">
            Dokumen yang perlu dilaporkan
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Gunakan identitas berikut saat meminta Logistics melengkapi harga.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href={`/${locale}/mektek/finance/payables`}>
            <ArrowLeft className="mr-2 size-4" />
            Kembali
          </Link>
        </Button>
      </div>

      <section className="grid gap-3 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Purchase Order</CardDescription>
            <CardTitle className="break-words text-base">
              {snapshot.poNumber || "Nomor PO tidak tersedia"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>{source.counterparty.legalName}</p>
            {purchaseOrder ? (
              <Button asChild size="sm" variant="outline">
                <Link
                  href={documentHref("purchase-order")}
                  target="_blank"
                  rel="noreferrer"
                >
                  Lihat Purchase Order
                  <ExternalLink className="ml-2 size-3.5" />
                </Link>
              </Button>
            ) : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Invoice Pemasok</CardDescription>
            <CardTitle className="text-base">Belum diinput Finance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {purchaseOrder?.supplierInvoiceImageUpdatedAt ? (
              <Button asChild size="sm" variant="outline">
                <Link
                  href={documentHref("supplier-invoice")}
                  target="_blank"
                  rel="noreferrer"
                >
                  Lihat Invoice Pemasok
                  <ExternalLink className="ml-2 size-3.5" />
                </Link>
              </Button>
            ) : (
              <Badge variant="outline">Gambar belum diunggah Logistics</Badge>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Surat Jalan / Tanda Terima</CardDescription>
            <CardTitle className="break-words text-base">
              {source.sourceReference || "Nomor tidak tersedia"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              Diterima {dateLabel(source.occurredAt)}
              {purchaseOrder?.receivingDeliveryNoteSource
                ? ` · Sumber ${purchaseOrder.receivingDeliveryNoteSource}`
                : ""}
            </p>
            {purchaseOrder?.deliveryNoteImageUpdatedAt ? (
              <Button asChild size="sm" variant="outline">
                <Link
                  href={documentHref("delivery-note")}
                  target="_blank"
                  rel="noreferrer"
                >
                  Lihat Surat Jalan
                  <ExternalLink className="ml-2 size-3.5" />
                </Link>
              </Button>
            ) : (
              <Badge variant="outline">Gambar belum diunggah Logistics</Badge>
            )}
          </CardContent>
        </Card>
      </section>

      <Card className="border-amber-500/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <AlertTriangle className="size-5 text-amber-600" />
            Item tanpa harga
          </CardTitle>
          <CardDescription>
            Harga satuan berikut belum tersedia sehingga tagihan belum dapat
            dihitung.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* The rounded border needs overflow-hidden, but that CLIPS the 560px
              table rather than scrolling it — the "Masalah" column was unreachable
              below ~592px. Scroll on an inner wrapper instead. */}
          {snapshot.pricingIssues.length ? (
            <div className="overflow-hidden rounded-lg border">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead className="bg-muted/50 text-left">
                    <tr>
                      <th className="p-3">Item</th>
                      <th className="p-3">Part Number</th>
                      <th className="p-3 text-right">QTY</th>
                      <th className="p-3">Masalah</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshot.pricingIssues.map((issue, index) => (
                      <tr
                        key={`${issue.description}-${index}`}
                        className="border-t"
                      >
                        <td className="p-3 font-medium">{issue.description}</td>
                        <td className="p-3">{issue.partNumber || "—"}</td>
                        <td className="p-3 text-right">{issue.quantity}</td>
                        <td className="p-3 text-amber-700">
                          Harga satuan belum diisi
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-emerald-700">
              <CheckCircle2 className="size-5" />
              Semua item pada snapshot dokumen memiliki harga.
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Teks laporan ke Logistics</CardTitle>
            <CardDescription>
              Salin teks ini untuk melaporkan dokumen yang harus diperbaiki.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <textarea
              readOnly
              value={reportText}
              className="min-h-40 w-full resize-y rounded-md border bg-muted/30 p-3 text-sm"
              aria-label="Teks laporan dokumen"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileText className="size-5" />
              Ringkasan nilai dokumen
            </CardTitle>
            <CardDescription>
              Nilai hanya tersedia setelah seluruh harga satuan dilengkapi.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between border-b pb-3 text-sm">
              <span className="text-muted-foreground">Subtotal PO</span>
              <strong>
                {snapshot.expectedSubtotal === null
                  ? "Belum dapat dihitung"
                  : rupiah.format(snapshot.expectedSubtotal)}
              </strong>
            </div>
            <Button asChild className="w-full">
              <Link href={receivingHref}>
                Buka PO di Logistics Receiving
                <ExternalLink className="ml-2 size-4" />
              </Link>
            </Button>
            <p className="text-xs text-muted-foreground">
              Tautan Logistics memerlukan hak akses Receiving. Finance tetap
              dapat melihat identitas dan rincian masalah pada halaman ini.
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
