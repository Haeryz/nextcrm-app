import "server-only";

// File 1: /actions/mektek/invoice-pdf.ts

import React from "react";
import {
  Document,
  Image,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
import {
  buildMektekFinancialSummary,
  type MektekPaymentDetail,
  type MektekPaymentRecord,
} from "@/lib/mektek/financials";
import { MEKTEK_PDF_LOGO_PATH } from "@/lib/mektek/pdf-assets";

export type MektekInvoiceItem = {
  kind?: "service" | "sparepart";
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
    type: "STANDARD" | "B2B";
  };
  service: {
    unit?: string;       // e.g. "DA 8159 BS / GRANMAX"
    usage?: string;      // HM value e.g. "257346"
    mileageKm?: number;
    fleetNumber?: string; // e.g. "12345"
    technicians?: string; // e.g. "Sadewo, Candra, Rudi"
  };
  items: MektekInvoiceItem[];
  financials: {
    serviceSubtotal: number;
    sparepartSubtotal: number;
    subtotal: number;
    discount: number;
    taxBase: number;     // DPP
    tax: number;         // PPN 11%
    pph: number;         // PPH 2%
    ppnEnabled: boolean;
    pphEnabled: boolean;
    ppnRate: number;
    pphRate: number;
    grossInvoiceTotal: number;
    netPayable: number;
    grandTotal: number;
    amountPaid: number;
    balanceDue: number;
  };
  payment: {
    method: string;
    status: "paid" | "partial" | "unpaid";
    providerAmountPaid: number;
    providerPayments: MektekPaymentDetail[];
  };
  notes?: string;
  taxDocumentPlaceholder: boolean;
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
    marginRight: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  logo: { width: 60, height: 60, objectFit: "contain" },
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
  taxAttachmentPage: {
    padding: 42,
    fontFamily: "Helvetica",
    color: "#111827",
    backgroundColor: "#fff",
  },
  taxAttachmentHeader: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
    marginBottom: 8,
  },
  taxAttachmentSubheader: {
    fontSize: 10,
    textAlign: "center",
    color: "#4b5563",
    marginBottom: 28,
  },
  taxAttachmentBox: {
    minHeight: 560,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "#9ca3af",
    alignItems: "center",
    justifyContent: "center",
    padding: 36,
  },
  taxAttachmentTitle: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    marginBottom: 12,
    textAlign: "center",
  },
  taxAttachmentText: {
    fontSize: 10,
    lineHeight: 1.6,
    color: "#4b5563",
    textAlign: "center",
  },
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  "Rp " +
  new Intl.NumberFormat("id-ID", { minimumFractionDigits: 0 }).format(n);

// ─── Document builder ─────────────────────────────────────────────────────────

function buildPdfDocument(data: MektekInvoiceData) {
  const { company, customer, service, items, financials, signatures } = data;
  const isBusiness = customer.type === "B2B";
  const hasServiceDetails = Boolean(
    service.unit ||
      service.usage ||
      service.mileageKm !== undefined ||
      service.fleetNumber ||
      service.technicians,
  );
  const documentTitle =
    data.type === "receipt"
      ? "BUKTI PEMBAYARAN"
      : isBusiness
        ? "INVOICE PERUSAHAAN"
        : "INVOICE PRIBADI";

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
    { label: "DISKON (-)", value: financials.discount,  bold: false },
    { label: "DPP",        value: financials.taxBase,   bold: false },
    {
      label: `PPN ${Math.round(financials.ppnRate * 100)}%${financials.ppnEnabled ? "" : " (NONAKTIF)"}`,
      value: financials.tax,
      bold: false,
    },
    ...(isBusiness
      ? [
          {
            label: "TOTAL SEBELUM PPH",
            value: financials.grossInvoiceTotal,
            bold: false,
          },
          {
            label: `PPH 23 DIPOTONG (-) ${Math.round(financials.pphRate * 100)}%${financials.pphEnabled ? "" : " (NONAKTIF)"}`,
            value: financials.pph,
            bold: false,
          },
          {
            label: "GRAND TOTAL",
            value: financials.netPayable,
            bold: true,
          },
        ]
      : [{ label: "GRAND TOTAL", value: financials.grandTotal, bold: true }]),
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
            React.createElement(Image, {
              src: MEKTEK_PDF_LOGO_PATH,
              style: S.logo,
            }),
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
        React.createElement(Text, { style: S.titleText }, documentTitle),
        React.createElement(View, { style: S.titleUnderline })
      ),

      // ── Info Grid: No / Date / MR / Unit / HM ─────────────────────────────
      React.createElement(
        View,
        { style: S.infoGrid },
        // Left: No + Date
        React.createElement(
          View,
          {
            style: {
              ...S.infoLeft,
              width: hasServiceDetails ? "30%" : "40%",
            },
          },
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
            React.createElement(Text, { style: S.infoLabel }, "Tanggal"),
            React.createElement(Text, { style: S.infoColon }, ":"),
            React.createElement(Text, { style: S.infoValue }, data.invoiceDate)
          )
        ),
        // Middle: MR / Work Order
        React.createElement(
          View,
          {
            style: {
              ...S.infoMiddle,
              width: hasServiceDetails ? "25%" : "60%",
              borderRightWidth: hasServiceDetails ? 1 : 0,
            },
          },
          React.createElement(Text, { style: S.mrText }, data.workOrder || data.reference || "")
        ),
        // Right: Unit + HM (+ No. Lambung for business invoices)
        hasServiceDetails
          ? React.createElement(
              View,
              { style: S.infoRight },
              React.createElement(
                View,
                { style: S.infoRow },
                React.createElement(
                  Text,
                  { style: { ...S.infoLabel, width: 30 } },
                  "Unit :",
                ),
                React.createElement(
                  Text,
                  {
                    style: {
                      ...S.infoValue,
                      fontFamily: "Helvetica-Bold",
                    },
                  },
                  service.unit || "",
                ),
              ),
              React.createElement(
                View,
                { style: S.infoRow },
                React.createElement(
                  Text,
                  { style: { ...S.infoLabel, width: 30 } },
                  service.mileageKm !== undefined ? "KM :" : "HM :",
                ),
                React.createElement(
                  Text,
                  { style: S.infoValue },
                  service.mileageKm !== undefined
                    ? service.mileageKm.toLocaleString("id-ID")
                    : service.usage || "",
                ),
              ),
              ...(isBusiness && service.fleetNumber
                ? [
                    React.createElement(
                      View,
                      { style: S.infoRow, key: "fleet-number" },
                      React.createElement(
                        Text,
                        { style: { ...S.infoLabel, width: 30 } },
                        "No. Lam :",
                      ),
                      React.createElement(
                        Text,
                        { style: S.infoValue },
                        service.fleetNumber,
                      ),
                    ),
                  ]
                : []),
            )
          : null,
      ),

      // ── Mekanik ────────────────────────────────────────────────────────────
      service.technicians
        ? React.createElement(
            View,
            { style: S.mekanikRow },
            React.createElement(
              Text,
              { style: S.mekanikLabel },
              "Mekanik :",
            ),
            React.createElement(
              Text,
              { style: S.mekanikValue },
              service.technicians,
            ),
          )
        : null,

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
          React.createElement(Text, { style: S.sigTitle }, "Diterima"),
          React.createElement(
            Text,
            { style: S.sigName },
            signatures?.receiver ? `( ${signatures.receiver} )` : "( ………………………… )"
          )
        ),
        React.createElement(
          View,
          { style: S.sigBox },
          React.createElement(Text, { style: S.sigTitle }, "Dept. Logistik"),
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
    ),
    data.type === "invoice" && isBusiness && data.taxDocumentPlaceholder
      ? React.createElement(
          Page,
          { size: "A4", style: S.taxAttachmentPage },
          React.createElement(
            Text,
            { style: S.taxAttachmentHeader },
            "LAMPIRAN DOKUMEN PAJAK",
          ),
          React.createElement(
            Text,
            { style: S.taxAttachmentSubheader },
            `Invoice ${data.invoiceNumber} - ${customer.name}`,
          ),
          React.createElement(
            View,
            { style: S.taxAttachmentBox },
            React.createElement(
              Text,
              { style: S.taxAttachmentTitle },
              "PLACEHOLDER DOKUMEN PAJAK",
            ),
            React.createElement(
              Text,
              { style: S.taxAttachmentText },
              "Dokumen pajak perusahaan akan dilampirkan pada halaman ini setelah jenis, format, dan detail dokumen dikonfirmasi.",
            ),
          ),
        )
      : null
  );
}

// ─── Data parsers (unchanged logic, extended for pph) ─────────────────────────

type ServiceOrderSummary = {
  id: string;
  serviceNumber?: string | null;
  createdAt?: Date | null;
  content?: string | null;
  tags?: unknown;
  mektekPayments?: MektekPaymentRecord[];
};

function parseTags(tags: unknown): Record<string, unknown> {
  if (!tags || typeof tags !== "object" || Array.isArray(tags)) return {};
  return tags as Record<string, unknown>;
}

export function buildMektekInvoiceData(order: ServiceOrderSummary): MektekInvoiceData {
  const tags = parseTags(order.tags);
  const isSparepartOnly = tags.orderType === "SPAREPART_ONLY";
  const serviceNumber = order.serviceNumber ?? order.id.slice(0, 8);
  const financialSummary = buildMektekFinancialSummary(
    tags,
    order.content,
    order.mektekPayments
  );
  const normalizedItems = financialSummary.normalizedItems;
  const items: MektekInvoiceItem[] = [
    ...normalizedItems.sparepartItems,
    ...normalizedItems.serviceItems,
  ].map((item) => ({
    kind: item.kind,
    name: item.name,
    sku: item.catalogPartNumber || item.partNumber || undefined,
    unit: item.unit,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    total: item.total,
  }));

  if (items.length === 0)
    items.push({ name: "Service", quantity: 1, unit: "JOB", unitPrice: 0, total: 0 });

  const subtotal =
    financialSummary.subtotal || items.reduce((sum, item) => sum + item.total, 0);

  // Parse signature names if stored in tags
  const sigTags =
    tags.signatures && typeof tags.signatures === "object" && !Array.isArray(tags.signatures)
      ? (tags.signatures as Record<string, unknown>)
      : {};

  return {
    type: "invoice",
    invoiceNumber: String(
      tags.invoiceNumber ??
        (order.serviceNumber
          ? order.serviceNumber.replace(/^SRV-/, "INV-")
          : `INV-${order.id.slice(0, 8)}`),
    ),
    invoiceDate: new Intl.DateTimeFormat("id-ID").format(order.createdAt ?? new Date()),
    reference: typeof tags.reference === "string" ? tags.reference : serviceNumber,
    workOrder: typeof tags.workOrder === "string" ? tags.workOrder : serviceNumber,
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
      name: String(tags.customerName ?? "Customer"),
      address: typeof tags.address === "string" ? tags.address : undefined,
      phone: typeof tags.phone === "string" ? tags.phone : undefined,
      type: financialSummary.customerType,
    },
    service: {
      unit:
        !isSparepartOnly && typeof tags.vehicle === "string"
          ? [
              typeof tags.vehiclePlateNumber === "string"
                ? tags.vehiclePlateNumber
                : null,
              tags.vehicle,
            ]
              .filter(Boolean)
              .join(" / ")
          : undefined,
      usage:
        !isSparepartOnly && typeof tags.usage === "string"
          ? tags.usage
          : undefined,
      mileageKm:
        !isSparepartOnly && typeof tags.vehicleMileageKm === "number"
          ? tags.vehicleMileageKm
          : undefined,
      fleetNumber:
        !isSparepartOnly && typeof tags.vehicleFleetNumber === "string"
          ? tags.vehicleFleetNumber
          : undefined,
      technicians:
        !isSparepartOnly && typeof tags.technicians === "string"
          ? tags.technicians
          : undefined,
    },
    items,
    financials: {
      serviceSubtotal: normalizedItems.serviceSubtotal,
      sparepartSubtotal: normalizedItems.sparepartSubtotal,
      subtotal,
      discount: financialSummary.discount,
      taxBase: financialSummary.taxBase,
      tax: financialSummary.tax,
      pph: financialSummary.pph,
      ppnEnabled: financialSummary.ppnEnabled,
      pphEnabled: financialSummary.pphEnabled,
      ppnRate: financialSummary.ppnRate,
      pphRate: financialSummary.pphRate,
      grossInvoiceTotal: financialSummary.grossInvoiceTotal,
      netPayable: financialSummary.netPayable,
      grandTotal: financialSummary.grandTotal,
      amountPaid: financialSummary.amountPaid,
      balanceDue: financialSummary.balanceDue,
    },
    payment: {
      method: financialSummary.payment.method,
      status: financialSummary.payment.status,
      providerAmountPaid: financialSummary.payment.providerAmountPaid,
      providerPayments: financialSummary.payment.providerPayments,
    },
    notes:
      typeof tags.invoiceNotes === "string" ? tags.invoiceNotes : undefined,
    taxDocumentPlaceholder: financialSummary.customerType === "B2B",
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
