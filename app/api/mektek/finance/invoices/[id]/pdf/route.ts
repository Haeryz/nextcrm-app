import { NextResponse } from "next/server";

import { renderFinanceInvoicePdf } from "@/actions/mektek/finance-invoice-pdf";
import { canViewMektekFinance } from "@/lib/mektek/permissions";
import { isFinanceInvoiceSigner } from "@/lib/mektek/finance-invoice-signers";
import { prismadb } from "@/lib/prisma";
import { getRequestSessionUser } from "@/lib/request-session";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getRequestSessionUser(request);
  if (!user?.id || !canViewMektekFinance(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const requestedSigner = new URL(request.url).searchParams.get("signer");
  const authorizedSigner = isFinanceInvoiceSigner(requestedSigner)
    ? requestedSigner
    : "SUYADI";
  const invoice = await prismadb.financeInvoice.findUnique({
    where: { id },
    include: {
      counterparty: { select: { legalName: true } },
      lines: {
        orderBy: { position: "asc" },
        select: {
          description: true,
          partNumber: true,
          quantity: true,
          unitPrice: true,
          lineTotal: true,
        },
      },
      sources: {
        orderBy: { occurredAt: "asc" },
        select: { snapshot: true },
      },
    },
  });
  if (!invoice) {
    return NextResponse.json(
      { error: "Invoice tidak ditemukan" },
      { status: 404 },
    );
  }

  const invoiceNumber = invoice.invoiceNumber || invoice.draftNumber;
  const sourceLines = invoice.sources.flatMap((source) => {
    const snapshot =
      source.snapshot &&
      typeof source.snapshot === "object" &&
      !Array.isArray(source.snapshot)
        ? (source.snapshot as Record<string, unknown>)
        : {};
    const items = Array.isArray(snapshot.items) ? snapshot.items : [];
    return items.flatMap((value) => {
      if (!value || typeof value !== "object" || Array.isArray(value)) {
        return [];
      }
      const item = value as Record<string, unknown>;
      const description = String(
        item.description ?? item.name ?? "",
      ).trim();
      const quantity = Number(item.quantity ?? 0);
      const unitPrice = Number(item.unitPrice ?? 0);
      if (
        !description ||
        !Number.isFinite(quantity) ||
        quantity <= 0 ||
        !Number.isFinite(unitPrice)
      ) {
        return [];
      }
      return [{
        description,
        partNumber: String(item.partNumber ?? "").trim() || null,
        quantity,
        unitPrice,
        lineTotal: quantity * unitPrice,
      }];
    });
  });
  const invoiceLines = invoice.lines.map((line) => ({
    description: line.description,
    partNumber: line.partNumber,
    quantity: Number(line.quantity),
    unitPrice: Number(line.unitPrice),
    lineTotal: Number(line.lineTotal),
  }));
  // Legacy manual invoices stored a single synthetic line holding the whole
  // pre-PPN value (qty 1, no part number). Those carry no per-item detail, so
  // the Surat Jalan snapshot is the better source. Anything else means the
  // invoice has real line items — including edits — and must win.
  const hasItemDetail =
    invoiceLines.length > 1 ||
    (invoiceLines.length === 1 &&
      (invoiceLines[0].quantity !== 1 || Boolean(invoiceLines[0].partNumber)));
  const lines =
    hasItemDetail || sourceLines.length === 0 ? invoiceLines : sourceLines;
  const pdf = await renderFinanceInvoicePdf({
    invoiceNumber,
    customerName: invoice.counterparty.legalName,
    invoiceDate: invoice.invoiceDate,
    dueDate: invoice.dueDate,
    deliveryNoteNumber: invoice.deliveryNoteNumber,
    purchaseOrderNumber: invoice.purchaseOrderNumber,
    purchaseOrderDate: invoice.purchaseOrderDate,
    accountDestination: invoice.accountDestination,
    currency: invoice.currency,
    subtotal: Number(invoice.subtotal),
    taxRate: Number(invoice.taxRate) * 100,
    taxAmount: Number(invoice.taxAmount),
    total: Number(invoice.netAmount),
    notes: invoice.notes,
    authorizedSigner,
    lines,
  });
  const safeNumber = invoiceNumber.replace(/[^A-Za-z0-9_-]+/g, "-");

  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(pdf.byteLength),
      "Content-Disposition": `inline; filename="invoice-${safeNumber}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
