import React from "react";
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";

export type MektekInvoiceItem = {
  sku?: string;
  name: string;
  quantity: number;
  unit?: string;
  unitPrice: number;
  total: number;
};

export type MektekInvoiceData = {
  type: "invoice" | "receipt";
  invoiceNumber: string;
  invoiceDate: string;
  reference?: string;
  company: {
    name: string;
    address?: string;
    contact?: string;
  };
  customer: {
    name: string;
    address?: string;
    phone?: string;
  };
  service: {
    unit?: string;
    usage?: string;
    technicians?: string;
  };
  items: MektekInvoiceItem[];
  financials: {
    subtotal: number;
    discount: number;
    taxBase: number;
    tax: number;
    grandTotal: number;
    amountPaid: number;
    balanceDue: number;
  };
  payment: {
    method: string;
    status: "paid" | "partial" | "unpaid";
  };
  notes?: string;
};

const styles = StyleSheet.create({
  page: { padding: 32, fontFamily: "Helvetica", fontSize: 10, color: "#1f2937" },
  title: { fontSize: 16, fontFamily: "Helvetica-Bold" },
  subtitle: { fontSize: 9, color: "#6b7280" },
  section: { marginTop: 16 },
  row: { flexDirection: "row", justifyContent: "space-between" },
  label: { fontSize: 9, color: "#6b7280" },
  value: { fontSize: 10, fontFamily: "Helvetica-Bold" },
  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#d1d5db",
    paddingBottom: 4,
    marginTop: 10,
  },
  tableRow: { flexDirection: "row", paddingVertical: 4, borderBottomWidth: 0.5, borderBottomColor: "#e5e7eb" },
  cellIndex: { width: "6%" },
  cellSku: { width: "18%" },
  cellName: { width: "34%" },
  cellQty: { width: "10%", textAlign: "right" },
  cellUnit: { width: "8%", textAlign: "right" },
  cellPrice: { width: "12%", textAlign: "right" },
  cellTotal: { width: "12%", textAlign: "right" },
  totalsRow: { flexDirection: "row", justifyContent: "flex-end", marginTop: 4 },
  totalsLabel: { width: "70%", textAlign: "right", color: "#6b7280" },
  totalsValue: { width: "20%", textAlign: "right", fontFamily: "Helvetica-Bold" },
  grandTotalLabel: { width: "70%", textAlign: "right", color: "#111827", fontFamily: "Helvetica-Bold" },
  grandTotalValue: { width: "20%", textAlign: "right", fontFamily: "Helvetica-Bold", fontSize: 12 },
  paymentBox: {
    marginTop: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "#f9fafb",
  },
  paymentTitle: { fontSize: 10, fontFamily: "Helvetica-Bold", marginBottom: 6 },
  signatureRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 24 },
  signatureBox: { width: "42%", borderTopWidth: 1, borderTopColor: "#d1d5db", paddingTop: 6 },
  footnote: { marginTop: 12, fontSize: 8, color: "#6b7280" },
});

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);

// FIX 1: renderToBuffer expects a ReactElement<DocumentProps>.
// Wrap the component output directly in <Document> so the top-level element
// IS the Document, making the props compatible with DocumentProps.
function buildPdfDocument(data: MektekInvoiceData) {
  return React.createElement(
    Document,
    null,
    React.createElement(
      Page,
      { size: "A4", style: styles.page },
      React.createElement(
        View,
        null,
        React.createElement(Text, { style: styles.title },
          data.type === "invoice" ? "INVOICE" : "STRUK"
        ),
        React.createElement(Text, { style: styles.subtitle }, data.company.name)
      ),
      React.createElement(
        View,
        { style: styles.section },
        React.createElement(View, { style: styles.row },
          React.createElement(View, null,
            React.createElement(Text, { style: styles.label }, "Company"),
            React.createElement(Text, { style: styles.value }, data.company.name),
            data.company.address && React.createElement(Text, { style: styles.subtitle }, data.company.address),
            data.company.contact && React.createElement(Text, { style: styles.subtitle }, data.company.contact)
          ),
          React.createElement(View, null,
            React.createElement(Text, { style: styles.label }, "Invoice No"),
            React.createElement(Text, { style: styles.value }, data.invoiceNumber),
            React.createElement(Text, { style: styles.label }, "Date"),
            React.createElement(Text, { style: styles.value }, data.invoiceDate),
            data.reference && React.createElement(Text, { style: styles.subtitle }, `Ref: ${data.reference}`)
          )
        )
      ),
      React.createElement(
        View,
        { style: styles.section },
        React.createElement(View, { style: styles.row },
          React.createElement(View, null,
            React.createElement(Text, { style: styles.label }, "Customer"),
            React.createElement(Text, { style: styles.value }, data.customer.name),
            data.customer.address && React.createElement(Text, { style: styles.subtitle }, data.customer.address),
            data.customer.phone && React.createElement(Text, { style: styles.subtitle }, data.customer.phone)
          ),
          React.createElement(View, null,
            React.createElement(Text, { style: styles.label }, "Service Unit"),
            React.createElement(Text, { style: styles.value }, data.service.unit || "-"),
            data.service.usage && React.createElement(Text, { style: styles.subtitle }, `Usage: ${data.service.usage}`),
            data.service.technicians && React.createElement(Text, { style: styles.subtitle }, `Tech: ${data.service.technicians}`)
          )
        )
      ),
      React.createElement(
        View,
        { style: styles.section },
        React.createElement(View, { style: styles.tableHeader },
          React.createElement(Text, { style: styles.cellIndex }, "No"),
          React.createElement(Text, { style: styles.cellSku }, "Part No"),
          React.createElement(Text, { style: styles.cellName }, "Item"),
          React.createElement(Text, { style: styles.cellQty }, "Qty"),
          React.createElement(Text, { style: styles.cellUnit }, "Unit"),
          React.createElement(Text, { style: styles.cellPrice }, "Price"),
          React.createElement(Text, { style: styles.cellTotal }, "Total")
        ),
        ...data.items.map((item, index) =>
          React.createElement(View, { key: `${item.name}-${index}`, style: styles.tableRow },
            React.createElement(Text, { style: styles.cellIndex }, String(index + 1)),
            React.createElement(Text, { style: styles.cellSku }, item.sku || "-"),
            React.createElement(Text, { style: styles.cellName }, item.name),
            React.createElement(Text, { style: styles.cellQty }, String(item.quantity)),
            React.createElement(Text, { style: styles.cellUnit }, item.unit || "-"),
            React.createElement(Text, { style: styles.cellPrice }, formatCurrency(item.unitPrice)),
            React.createElement(Text, { style: styles.cellTotal }, formatCurrency(item.total))
          )
        )
      ),
      React.createElement(
        View,
        { style: styles.section },
        React.createElement(View, { style: styles.totalsRow },
          React.createElement(Text, { style: styles.totalsLabel }, "Subtotal"),
          React.createElement(Text, { style: styles.totalsValue }, formatCurrency(data.financials.subtotal))
        ),
        React.createElement(View, { style: styles.totalsRow },
          React.createElement(Text, { style: styles.totalsLabel }, "Discount"),
          React.createElement(Text, { style: styles.totalsValue }, formatCurrency(data.financials.discount))
        ),
        React.createElement(View, { style: styles.totalsRow },
          React.createElement(Text, { style: styles.totalsLabel }, "Tax Base"),
          React.createElement(Text, { style: styles.totalsValue }, formatCurrency(data.financials.taxBase))
        ),
        React.createElement(View, { style: styles.totalsRow },
          React.createElement(Text, { style: styles.totalsLabel }, "Tax"),
          React.createElement(Text, { style: styles.totalsValue }, formatCurrency(data.financials.tax))
        ),
        React.createElement(View, { style: styles.totalsRow },
          React.createElement(Text, { style: styles.grandTotalLabel }, "Total Tagihan"),
          React.createElement(Text, { style: styles.grandTotalValue }, formatCurrency(data.financials.grandTotal))
        ),
        React.createElement(View, { style: styles.totalsRow },
          React.createElement(Text, { style: styles.totalsLabel }, "Sudah Dibayar"),
          React.createElement(Text, { style: styles.totalsValue }, formatCurrency(data.financials.amountPaid))
        ),
        React.createElement(View, { style: styles.totalsRow },
          React.createElement(Text, { style: styles.grandTotalLabel }, "Sisa Pembayaran"),
          React.createElement(Text, { style: styles.grandTotalValue }, formatCurrency(data.financials.balanceDue))
        )
      ),
      React.createElement(
        View,
        { style: styles.paymentBox },
        React.createElement(Text, { style: styles.paymentTitle }, "Ringkasan Pembayaran"),
        React.createElement(View, { style: styles.row },
          React.createElement(Text, { style: styles.label }, "Metode"),
          React.createElement(Text, { style: styles.value }, data.payment.method.toUpperCase())
        ),
        React.createElement(View, { style: styles.row },
          React.createElement(Text, { style: styles.label }, "Status"),
          React.createElement(
            Text,
            { style: styles.value },
            data.payment.status === "paid"
              ? "LUNAS"
              : data.payment.status === "partial"
              ? "DIBAYAR SEBAGIAN"
              : "BELUM BAYAR"
          )
        )
      ),
      React.createElement(
        View,
        { style: styles.signatureRow },
        React.createElement(View, { style: styles.signatureBox },
          React.createElement(Text, { style: styles.label }, "Receiver")
        ),
        React.createElement(View, { style: styles.signatureBox },
          React.createElement(Text, { style: styles.label }, "Company")
        )
      ),
      data.notes && React.createElement(Text, { style: styles.footnote }, data.notes)
    )
  );
}

type ServiceOrderSummary = {
  id: string;
  createdAt?: Date | null;
  content?: string | null;
  tags?: unknown;
  crm_accounts?: { name?: string | null; office_phone?: string | null; billing_street?: string | null } | null;
};

function parseTags(tags: unknown): Record<string, unknown> {
  if (!tags || typeof tags !== "object" || Array.isArray(tags)) return {};
  return tags as Record<string, unknown>;
}

function parseMoney(value: unknown): number {
  const cleaned = String(value ?? "").replace(/\D/g, "");
  const amount = Number(cleaned);
  return Number.isFinite(amount) && amount > 0 ? amount : 0;
}

function parsePayment(tags: Record<string, unknown>) {
  const payment =
    tags.payment && typeof tags.payment === "object" && !Array.isArray(tags.payment)
      ? (tags.payment as Record<string, unknown>)
      : {};
  const method = typeof payment.method === "string" ? payment.method : "cash";
  const amountPaid = parseMoney(payment.amountPaid);
  const status = typeof payment.status === "string" ? payment.status : "";

  return {
    method,
    amountPaid,
    status,
  };
}

function parseContentItems(content?: string | null): MektekInvoiceItem[] {
  if (!content) return [];

  return content
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const estimateMatch = line.match(/\(Est\.\s*Rp\s*([^)]+)\)\s*$/i);
      const unitPrice = estimateMatch ? parseMoney(estimateMatch[1]) : 0;
      const name = estimateMatch ? line.replace(estimateMatch[0], "").trim() : line;
      return {
        name,
        quantity: 1,
        unit: "JOB",
        unitPrice,
        total: unitPrice,
      };
    });
}

export function buildMektekInvoiceData(order: ServiceOrderSummary): MektekInvoiceData {
  const tags = parseTags(order.tags);
  const itemsRaw = Array.isArray(tags.items) ? tags.items : [];

  // FIX 2: The mapped object uses `sku: string | undefined` but MektekInvoiceItem
  // has `sku?: string` (optional). These are structurally different to TypeScript.
  // Solution: cast the mapped result to MektekInvoiceItem directly, then filter nulls.
  const items: MektekInvoiceItem[] = itemsRaw
    .map((item): MektekInvoiceItem | null => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return null;
      const row = item as Record<string, unknown>;
      return {
        name: String(row.name ?? ""),
        sku: row.sku ? String(row.sku) : undefined,
        unit: row.unit ? String(row.unit) : undefined,
        quantity: Number(row.quantity ?? 1) || 1,
        unitPrice: parseMoney(row.unitPrice),
        total: parseMoney(row.total) || parseMoney(row.unitPrice) * (Number(row.quantity ?? 1) || 1),
      };
    })
    .filter((item): item is MektekInvoiceItem => item !== null && !!item.name);

  if (items.length === 0) {
    items.push(...parseContentItems(order.content));
  }

  if (items.length === 0) {
    items.push({ name: "Service", quantity: 1, unit: "JOB", unitPrice: 0, total: 0 });
  }

  const subtotal = items.reduce((sum, item) => sum + item.total, 0);
  const discount = parseMoney(tags.discount);
  const taxBase = Math.max(0, subtotal - discount);
  const tax = parseMoney(tags.tax);
  const grandTotal = Math.max(0, taxBase + tax);
  const payment = parsePayment(tags);
  const amountPaid =
    payment.status === "paid" && payment.amountPaid === 0
      ? grandTotal
      : Math.min(payment.amountPaid, grandTotal);
  const balanceDue = Math.max(0, grandTotal - amountPaid);
  const paymentStatus =
    amountPaid >= grandTotal && grandTotal > 0
      ? "paid"
      : amountPaid > 0
      ? "partial"
      : "unpaid";

  return {
    type: "invoice",
    invoiceNumber: String(tags.invoiceNumber ?? `INV-${order.id.slice(0, 8)}`),
    invoiceDate: new Intl.DateTimeFormat("id-ID").format(order.createdAt ?? new Date()),
    reference: typeof tags.reference === "string" ? tags.reference : undefined,
    company: {
      name: String(tags.companyName ?? process.env.MEKTEK_COMPANY_NAME ?? "PT. Mektek Tanjung Lestari"),
      address: typeof tags.companyAddress === "string" ? tags.companyAddress : process.env.MEKTEK_COMPANY_ADDRESS,
      contact: typeof tags.companyContact === "string" ? tags.companyContact : process.env.MEKTEK_COMPANY_CONTACT,
    },
    customer: {
      name: order.crm_accounts?.name || String(tags.customerName ?? "Customer"),
      address: typeof tags.address === "string" ? tags.address : order.crm_accounts?.billing_street || undefined,
      phone: typeof tags.phone === "string" ? tags.phone : order.crm_accounts?.office_phone || undefined,
    },
    service: {
      unit: typeof tags.vehicle === "string" ? tags.vehicle : undefined,
      usage: typeof tags.usage === "string" ? tags.usage : undefined,
      technicians: typeof tags.technicians === "string" ? tags.technicians : undefined,
    },
    items,
    financials: {
      subtotal,
      discount,
      taxBase,
      tax,
      grandTotal,
      amountPaid,
      balanceDue,
    },
    payment: {
      method: payment.method,
      status: paymentStatus,
    },
    notes: typeof tags.invoiceNotes === "string" ? tags.invoiceNotes : "Thank you for your business.",
  };
}

export async function renderMektekInvoicePdf(data: MektekInvoiceData): Promise<Uint8Array> {
  const doc = buildPdfDocument({ ...data, type: "invoice" });
  const buffer = await renderToBuffer(doc);
  return new Uint8Array(buffer);
}

export async function renderMektekReceiptPdf(data: MektekInvoiceData): Promise<Uint8Array> {
  const doc = buildPdfDocument({ ...data, type: "receipt" });
  const buffer = await renderToBuffer(doc);
  return new Uint8Array(buffer);
}
