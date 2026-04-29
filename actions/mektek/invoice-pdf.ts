// File 1: /actions/mektek/invoice-pdf.ts

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
  workOrder?: string;    // MR. number e.g. "MR. 300/26"
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
    unit?: string;       // e.g. "DA 8159 BS / GRANMAX"
    usage?: string;      // HM value e.g. "257346"
    technicians?: string; // e.g. "Sadewo, Candra, Rudi"
  };
  items: MektekInvoiceItem[];
  financials: {
    subtotal: number;
    discount: number;
    taxBase: number;     // DPP
    tax: number;         // PPN 11%
    pph: number;         // PPH 2%
    grandTotal: number;
    amountPaid: number;
    balanceDue: number;
  };
  payment: {
    method: string;
    status: "paid" | "partial" | "unpaid";
  };
  notes?: string;
  signatures?: {
    receiver?: string;
    logistics?: string;
    customerService?: string;
  };
};

// ─── Styles ──────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  page: {
    padding: 28,
    fontFamily: "Helvetica",
    fontSize: 9,
    color: "#000",
    backgroundColor: "#fff",
  },

  // ── Header ─────────────────────────────────────────────────────────────────
  headerRow: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: "#000",
    marginBottom: 0,
  },
  headerLeft: {
    width: "55%",
    borderRightWidth: 1,
    borderRightColor: "#000",
    flexDirection: "row",
    padding: 6,
    alignItems: "flex-start",
  },
  logoBox: {
    width: 64,
    height: 64,
    borderWidth: 1,
    borderColor: "#000",
    marginRight: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  logoText: { fontSize: 7, fontFamily: "Helvetica-Bold", textAlign: "center" },
  companyName: { fontSize: 16, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  companyAddress: { fontSize: 7.5, lineHeight: 1.4 },
  headerRight: {
    width: "45%",
    padding: 8,
  },
  kepada: { fontSize: 8.5, marginBottom: 2 },
  customerName: { fontSize: 13, fontFamily: "Helvetica-Bold" },

  // ── Document title ─────────────────────────────────────────────────────────
  titleRow: {
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: "#000",
    alignItems: "center",
    paddingVertical: 5,
    marginBottom: 0,
  },
  titleText: { fontSize: 11, fontFamily: "Helvetica-Bold", letterSpacing: 1 },
  titleUnderline: {
    marginTop: 1,
    borderBottomWidth: 1.5,
    borderBottomColor: "#000",
    width: 120,
  },

  // ── Info grid (No / Date / MR / Unit / HM) ─────────────────────────────────
  infoGrid: {
    flexDirection: "row",
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: "#000",
    marginBottom: 0,
  },
  infoLeft: {
    width: "30%",
    borderRightWidth: 1,
    borderRightColor: "#000",
    padding: 4,
  },
  infoMiddle: {
    width: "25%",
    borderRightWidth: 1,
    borderRightColor: "#000",
    alignItems: "center",
    justifyContent: "center",
    padding: 4,
  },
  infoRight: { width: "45%", padding: 4 },
  infoRow: { flexDirection: "row", marginBottom: 2 },
  infoLabel: { width: 36, fontSize: 8.5, fontFamily: "Helvetica-Bold" },
  infoColon: { width: 8, fontSize: 8.5 },
  infoValue: { fontSize: 8.5 },
  mrText: { fontSize: 9.5, fontFamily: "Helvetica-Bold" },

  // ── Mekanik row ────────────────────────────────────────────────────────────
  mekanikRow: {
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: "#000",
    flexDirection: "row",
    padding: 4,
    marginBottom: 0,
  },
  mekanikLabel: { fontSize: 8.5, fontFamily: "Helvetica-Bold", marginRight: 6 },
  mekanikValue: { fontSize: 8.5 },

  // ── Item table ─────────────────────────────────────────────────────────────
  table: {
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: "#000",
    marginBottom: 0,
  },
  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#000",
    backgroundColor: "#fff",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#000",
    minHeight: 16,
  },
  tableRowAlt: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#000",
    minHeight: 16,
    backgroundColor: "#f5f5f5",
  },
  // Column cells — all with right border except last
  cNo:    { width: "5%",  padding: 2, borderRightWidth: 0.5, borderRightColor: "#000", textAlign: "center" },
  cPart:  { width: "17%", padding: 2, borderRightWidth: 0.5, borderRightColor: "#000", textAlign: "center" },
  cName:  { width: "31%", padding: 2, borderRightWidth: 0.5, borderRightColor: "#000", textAlign: "center" },
  cQty:   { width: "7%",  padding: 2, borderRightWidth: 0.5, borderRightColor: "#000", textAlign: "center" },
  cUnit:  { width: "7%",  padding: 2, borderRightWidth: 0.5, borderRightColor: "#000", textAlign: "center" },
  cPrice: { width: "16%", padding: 2, borderRightWidth: 0.5, borderRightColor: "#000", textAlign: "right" },
  cTotal: { width: "17%", padding: 2, textAlign: "right" },
  thText: { fontSize: 8.5, fontFamily: "Helvetica-Bold", textAlign: "center" },
  tdText: { fontSize: 8.5 },
  tdBold: { fontSize: 8.5, fontFamily: "Helvetica-Bold" },

  // ── Totals section ─────────────────────────────────────────────────────────
  totalsSection: {
    flexDirection: "row",
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: "#000",
  },
  totalsSpacer: { width: "66%" },
  totalsBox: {
    width: "34%",
    borderLeftWidth: 1,
    borderLeftColor: "#000",
  },
  totalsRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#000",
  },
  totalsLabel: {
    width: "55%",
    padding: 2,
    borderRightWidth: 0.5,
    borderRightColor: "#000",
    fontSize: 8.5,
    fontFamily: "Helvetica-Bold",
  },
  totalsValue: { width: "45%", padding: 2, fontSize: 8.5, textAlign: "right" },
  totalsBold: {
    width: "55%",
    padding: 2,
    borderRightWidth: 0.5,
    borderRightColor: "#000",
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
  },
  totalsBoldValue: { width: "45%", padding: 2, fontSize: 9, textAlign: "right", fontFamily: "Helvetica-Bold" },

  // ── Signatures ─────────────────────────────────────────────────────────────
  sigSection: {
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: "#000",
    flexDirection: "row",
  },
  sigBox: {
    flex: 1,
    borderRightWidth: 0.5,
    borderRightColor: "#000",
    alignItems: "center",
    paddingTop: 6,
    paddingBottom: 4,
    minHeight: 80,
    justifyContent: "space-between",
  },
  sigBoxLast: {
    flex: 1,
    alignItems: "center",
    paddingTop: 6,
    paddingBottom: 4,
    minHeight: 80,
    justifyContent: "space-between",
  },
  sigTitle: { fontSize: 8.5, fontFamily: "Helvetica-Bold" },
  sigName: { fontSize: 8.5, borderTopWidth: 1, borderTopColor: "#000", paddingTop: 3, minWidth: 100, textAlign: "center" },
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  "Rp " +
  new Intl.NumberFormat("id-ID", { minimumFractionDigits: 0 }).format(n);

// ─── Document builder ─────────────────────────────────────────────────────────

function buildPdfDocument(data: MektekInvoiceData) {
  const { company, customer, service, items, financials, signatures } = data;

  const renderTableRow = (item: MektekInvoiceItem, index: number) => {
    const rowStyle = index % 2 === 0 ? S.tableRow : S.tableRowAlt;
    return React.createElement(
      View,
      { key: `row-${index}`, style: rowStyle },
      React.createElement(Text, { style: S.cNo }, String(index + 1)),
      React.createElement(Text, { style: S.cPart }, item.sku || "-"),
      React.createElement(Text, { style: { ...S.cName, textAlign: "left" } }, item.name),
      React.createElement(Text, { style: S.cQty }, String(item.quantity)),
      React.createElement(Text, { style: S.cUnit }, item.unit || "-"),
      React.createElement(Text, { style: S.cPrice }, fmt(item.unitPrice)),
      React.createElement(Text, { style: S.cTotal }, fmt(item.total))
    );
  };

  const totalsRows = [
    { label: "SUBTOTAL",   value: financials.subtotal,  bold: false },
    { label: "DISCOUNT",   value: financials.discount,  bold: false },
    { label: "DPP",        value: financials.taxBase,   bold: false },
    { label: "PPN 11%",    value: financials.tax,       bold: false },
    { label: "PPH 2%",     value: financials.pph ?? 0, bold: false },
    { label: "GRAND TOTAL",value: financials.grandTotal, bold: true },
  ];

  return React.createElement(
    Document,
    null,
    React.createElement(
      Page,
      { size: "A4", style: S.page },

      // ── Header ──────────────────────────────────────────────────────────────
      React.createElement(
        View,
        { style: S.headerRow },
        // Left: logo + company info
        React.createElement(
          View,
          { style: S.headerLeft },
          React.createElement(
            View,
            { style: S.logoBox },
            React.createElement(Text, { style: S.logoText }, "MEKTEK")
          ),
          React.createElement(
            View,
            null,
            React.createElement(Text, { style: S.companyName }, company.name),
            company.address &&
              React.createElement(Text, { style: S.companyAddress }, company.address),
            company.contact &&
              React.createElement(Text, { style: S.companyAddress }, company.contact)
          )
        ),
        // Right: Kepada Yth + customer name
        React.createElement(
          View,
          { style: S.headerRight },
          React.createElement(Text, { style: S.kepada }, "Kepada Yth :"),
          React.createElement(Text, { style: S.customerName }, customer.name),
          customer.address &&
            React.createElement(Text, { style: { fontSize: 8, marginTop: 4 } }, customer.address),
          customer.phone &&
            React.createElement(Text, { style: { fontSize: 8 } }, customer.phone)
        )
      ),

      // ── Title ──────────────────────────────────────────────────────────────
      React.createElement(
        View,
        { style: S.titleRow },
        React.createElement(Text, { style: S.titleText }, "DELIVERY SHEET"),
        React.createElement(View, { style: S.titleUnderline })
      ),

      // ── Info Grid: No / Date / MR / Unit / HM ─────────────────────────────
      React.createElement(
        View,
        { style: S.infoGrid },
        // Left: No + Date
        React.createElement(
          View,
          { style: S.infoLeft },
          React.createElement(
            View,
            { style: S.infoRow },
            React.createElement(Text, { style: S.infoLabel }, "No."),
            React.createElement(Text, { style: S.infoColon }, ":"),
            React.createElement(Text, { style: S.infoValue }, data.invoiceNumber)
          ),
          React.createElement(
            View,
            { style: S.infoRow },
            React.createElement(Text, { style: S.infoLabel }, "Date"),
            React.createElement(Text, { style: S.infoColon }, ":"),
            React.createElement(Text, { style: S.infoValue }, data.invoiceDate)
          )
        ),
        // Middle: MR / Work Order
        React.createElement(
          View,
          { style: S.infoMiddle },
          React.createElement(Text, { style: S.mrText }, data.workOrder || data.reference || "")
        ),
        // Right: Unit + HM
        React.createElement(
          View,
          { style: S.infoRight },
          React.createElement(
            View,
            { style: S.infoRow },
            React.createElement(Text, { style: { ...S.infoLabel, width: 30 } }, "Unit :"),
            React.createElement(Text, { style: { ...S.infoValue, fontFamily: "Helvetica-Bold" } }, service.unit || "")
          ),
          React.createElement(
            View,
            { style: S.infoRow },
            React.createElement(Text, { style: { ...S.infoLabel, width: 30 } }, "HM :"),
            React.createElement(Text, { style: S.infoValue }, service.usage || "")
          )
        )
      ),

      // ── Mekanik ────────────────────────────────────────────────────────────
      React.createElement(
        View,
        { style: S.mekanikRow },
        React.createElement(Text, { style: S.mekanikLabel }, "Mekanik :"),
        React.createElement(Text, { style: S.mekanikValue }, service.technicians || "")
      ),

      // ── Item Table ─────────────────────────────────────────────────────────
      React.createElement(
        View,
        { style: S.table },
        // Table header
        React.createElement(
          View,
          { style: S.tableHeader },
          React.createElement(Text, { style: { ...S.cNo,   ...{ fontFamily: "Helvetica-Bold" } } }, "No."),
          React.createElement(Text, { style: { ...S.cPart, ...{ fontFamily: "Helvetica-Bold" } } }, "Part Number"),
          React.createElement(Text, { style: { ...S.cName, ...{ fontFamily: "Helvetica-Bold" } } }, "Item Name"),
          React.createElement(Text, { style: { ...S.cQty,  ...{ fontFamily: "Helvetica-Bold" } } }, "Qty"),
          React.createElement(Text, { style: { ...S.cUnit, ...{ fontFamily: "Helvetica-Bold" } } }, "Unit"),
          React.createElement(Text, { style: { ...S.cPrice,...{ fontFamily: "Helvetica-Bold", textAlign: "center" } } }, "Price"),
          React.createElement(Text, { style: { ...S.cTotal,...{ fontFamily: "Helvetica-Bold", textAlign: "center" } } }, "Total Price")
        ),
        // Data rows
        ...items.map((item, i) => renderTableRow(item, i))
      ),

      // ── Totals ─────────────────────────────────────────────────────────────
      React.createElement(
        View,
        { style: S.totalsSection },
        React.createElement(View, { style: S.totalsSpacer }),
        React.createElement(
          View,
          { style: S.totalsBox },
          ...totalsRows.map((r, i) =>
            React.createElement(
              View,
              {
                key: `tot-${i}`,
                style: {
                  ...S.totalsRow,
                  ...(i === totalsRows.length - 1 ? { borderBottomWidth: 0 } : {}),
                },
              },
              React.createElement(
                Text,
                { style: r.bold ? S.totalsBold : S.totalsLabel },
                r.label
              ),
              React.createElement(
                Text,
                { style: r.bold ? S.totalsBoldValue : S.totalsValue },
                fmt(r.value)
              )
            )
          )
        )
      ),

      // ── Signatures ─────────────────────────────────────────────────────────
      React.createElement(
        View,
        { style: S.sigSection },
        React.createElement(
          View,
          { style: S.sigBox },
          React.createElement(Text, { style: S.sigTitle }, "Received"),
          React.createElement(
            Text,
            { style: S.sigName },
            signatures?.receiver ? `( ${signatures.receiver} )` : "( ………………………… )"
          )
        ),
        React.createElement(
          View,
          { style: S.sigBox },
          React.createElement(Text, { style: S.sigTitle }, "Dept. Logistic"),
          React.createElement(
            Text,
            { style: S.sigName },
            signatures?.logistics ? `( ${signatures.logistics} )` : "( ………………………… )"
          )
        ),
        React.createElement(
          View,
          { style: S.sigBoxLast },
          React.createElement(Text, { style: S.sigTitle }, "Customer Service"),
          React.createElement(
            Text,
            { style: S.sigName },
            signatures?.customerService
              ? `( ${signatures.customerService} )`
              : "( ………………………… )"
          )
        )
      ),

      // ── Notes (optional) ───────────────────────────────────────────────────
      data.notes
        ? React.createElement(
            Text,
            { style: { fontSize: 7.5, color: "#555", marginTop: 6 } },
            data.notes
          )
        : null
    )
  );
}

// ─── Data parsers (unchanged logic, extended for pph) ─────────────────────────

type ServiceOrderSummary = {
  id: string;
  createdAt?: Date | null;
  content?: string | null;
  tags?: unknown;
  crm_accounts?: {
    name?: string | null;
    office_phone?: string | null;
    billing_street?: string | null;
  } | null;
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
  return {
    method: typeof payment.method === "string" ? payment.method : "cash",
    amountPaid: parseMoney(payment.amountPaid),
    status: typeof payment.status === "string" ? payment.status : "",
  };
}

function parseContentItems(content?: string | null): MektekInvoiceItem[] {
  if (!content) return [];
  return content
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const m = line.match(/\(Est\.\s*Rp\s*([^)]+)\)\s*$/i);
      const unitPrice = m ? parseMoney(m[1]) : 0;
      const name = m ? line.replace(m[0], "").trim() : line;
      return { name, quantity: 1, unit: "JOB", unitPrice, total: unitPrice };
    });
}

export function buildMektekInvoiceData(order: ServiceOrderSummary): MektekInvoiceData {
  const tags = parseTags(order.tags);
  const itemsRaw = Array.isArray(tags.items) ? tags.items : [];

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
        total:
          parseMoney(row.total) ||
          parseMoney(row.unitPrice) * (Number(row.quantity ?? 1) || 1),
      };
    })
    .filter((i): i is MektekInvoiceItem => i !== null && !!i.name);

  if (items.length === 0) items.push(...parseContentItems(order.content));
  if (items.length === 0)
    items.push({ name: "Service", quantity: 1, unit: "JOB", unitPrice: 0, total: 0 });

  const subtotal = items.reduce((s, i) => s + i.total, 0);
  const discount = parseMoney(tags.discount);
  const taxBase = Math.max(0, subtotal - discount);
  const tax = parseMoney(tags.tax) || Math.round(taxBase * 0.11);
  const pph = parseMoney(tags.pph) || Math.round(taxBase * 0.02);
  const grandTotal = Math.max(0, taxBase + tax - pph);
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

  // Parse signature names if stored in tags
  const sigTags =
    tags.signatures && typeof tags.signatures === "object" && !Array.isArray(tags.signatures)
      ? (tags.signatures as Record<string, unknown>)
      : {};

  return {
    type: "invoice",
    invoiceNumber: String(tags.invoiceNumber ?? `INV-${order.id.slice(0, 8)}`),
    invoiceDate: new Intl.DateTimeFormat("id-ID").format(order.createdAt ?? new Date()),
    reference: typeof tags.reference === "string" ? tags.reference : undefined,
    workOrder: typeof tags.workOrder === "string" ? tags.workOrder : undefined,
    company: {
      name: String(
        tags.companyName ??
          process.env.MEKTEK_COMPANY_NAME ??
          "PT. Mektek Tanjung Lestari"
      ),
      address:
        typeof tags.companyAddress === "string"
          ? tags.companyAddress
          : process.env.MEKTEK_COMPANY_ADDRESS,
      contact:
        typeof tags.companyContact === "string"
          ? tags.companyContact
          : process.env.MEKTEK_COMPANY_CONTACT,
    },
    customer: {
      name: order.crm_accounts?.name || String(tags.customerName ?? "Customer"),
      address:
        typeof tags.address === "string"
          ? tags.address
          : order.crm_accounts?.billing_street || undefined,
      phone:
        typeof tags.phone === "string"
          ? tags.phone
          : order.crm_accounts?.office_phone || undefined,
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
      pph,
      grandTotal,
      amountPaid,
      balanceDue,
    },
    payment: {
      method: payment.method,
      status: paymentStatus,
    },
    notes:
      typeof tags.invoiceNotes === "string" ? tags.invoiceNotes : undefined,
    signatures: {
      receiver:
        typeof sigTags.receiver === "string" ? sigTags.receiver : undefined,
      logistics:
        typeof sigTags.logistics === "string" ? sigTags.logistics : undefined,
      customerService:
        typeof sigTags.customerService === "string"
          ? sigTags.customerService
          : undefined,
    },
  };
}

// ─── Render exports ───────────────────────────────────────────────────────────

export async function renderMektekInvoicePdf(
  data: MektekInvoiceData
): Promise<Uint8Array> {
  const doc = buildPdfDocument({ ...data, type: "invoice" });
  const buffer = await renderToBuffer(doc);
  return new Uint8Array(buffer);
}

export async function renderMektekReceiptPdf(
  data: MektekInvoiceData
): Promise<Uint8Array> {
  const doc = buildPdfDocument({ ...data, type: "receipt" });
  const buffer = await renderToBuffer(doc);
  return new Uint8Array(buffer);
}