import React from "react";
import { resolve } from "node:path";
import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";

export type MektekPurchaseOrderPdfData = {
  poNumber: string;
  supplierName: string;
  projectName: string;
  inputDate: Date;
  dueDate: Date;
  poType: string;
  notes?: string | null;
  items: Array<{
    position: number;
    partName: string;
    partNumber?: string | null;
    orderedQuantity: number;
    unitPrice: number;
    note?: string | null;
  }>;
};

const borderColor = "#202020";

const logoPath = resolve(
  process.cwd(),
  "public/images/logo-pt-mektek-tanjung-lestari.jpg",
);

const styles = StyleSheet.create({
  page: {
    paddingHorizontal: 28,
    paddingVertical: 24,
    fontFamily: "Helvetica",
    fontSize: 8.5,
    color: "#171717",
  },
  companyHeader: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    borderBottomWidth: 1.5,
    borderBottomColor: borderColor,
    paddingBottom: 7,
  },
  logo: {
    width: 52,
    height: 38,
    objectFit: "contain",
    marginRight: 10,
  },
  companyRow: { flexDirection: "row", alignItems: "center" },
  companyName: { fontFamily: "Helvetica-Bold", fontSize: 13 },
  companyMeta: { width: 245, lineHeight: 1.35 },
  documentTitle: {
    textAlign: "center",
    fontFamily: "Helvetica-Bold",
    fontSize: 13,
    letterSpacing: 0.7,
    marginVertical: 7,
  },
  headerBox: {
    borderWidth: 1,
    borderColor,
    flexDirection: "row",
    minHeight: 112,
  },
  supplierBox: { width: "48%", padding: 8, borderRightWidth: 1, borderColor },
  orderBox: { width: "52%", padding: 8 },
  bold: { fontFamily: "Helvetica-Bold" },
  line: { flexDirection: "row", marginBottom: 4 },
  lineLabel: { width: 75 },
  lineSeparator: { width: 10 },
  lineValue: { flex: 1, fontFamily: "Helvetica-Bold" },
  metaBox: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor,
    padding: 7,
    minHeight: 52,
  },
  table: { borderLeftWidth: 1, borderRightWidth: 1, borderColor },
  row: { flexDirection: "row", borderBottomWidth: 1, borderColor },
  tableHeader: { backgroundColor: "#f2f2f2", fontFamily: "Helvetica-Bold" },
  cell: { paddingHorizontal: 4, paddingVertical: 6 },
  no: { width: "7%", textAlign: "center" },
  description: { width: "35%" },
  partNumber: { width: "17%" },
  quantity: { width: "9%", textAlign: "right" },
  price: { width: "15%", textAlign: "right" },
  amount: { width: "17%", textAlign: "right" },
  subtotalLabel: {
    width: "83%",
    textAlign: "center",
    fontFamily: "Helvetica-Bold",
  },
  subtotalAmount: {
    width: "17%",
    textAlign: "right",
    fontFamily: "Helvetica-Bold",
  },
  confirmation: {
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor,
    minHeight: 178,
    padding: 8,
  },
  remarksBox: {
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor,
    padding: 7,
    minHeight: 40,
  },
  remarksTitle: { fontFamily: "Helvetica-Bold", marginBottom: 4 },
  remarkLine: { flexDirection: "row", marginBottom: 2 },
  remarkNumber: { width: 22 },
  remarkText: { flex: 1 },
  confirmationText: { fontFamily: "Helvetica-Oblique", lineHeight: 1.35 },
  signatureRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 46,
  },
  signature: { width: "30%", textAlign: "center" },
  signatureLine: {
    marginTop: 34,
    borderBottomWidth: 1,
    borderColor,
    paddingBottom: 2,
    fontFamily: "Helvetica-Bold",
  },
  footer: {
    position: "absolute",
    bottom: 10,
    left: 28,
    right: 28,
    textAlign: "right",
    fontSize: 6.5,
    color: "#555",
  },
});

const formatDate = (value: Date) =>
  new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
    timeZone: "Asia/Makassar",
  }).format(value);

const formatMoney = (value: number) =>
  new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 0,
  }).format(value);

function InfoLine({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <View style={styles.line}>
      <Text style={styles.lineLabel}>{label}</Text>
      <Text style={styles.lineSeparator}>:</Text>
      <Text style={styles.lineValue}>{value}</Text>
    </View>
  );
}

function PurchaseOrderDocument({ data }: { data: MektekPurchaseOrderPdfData }) {
  const items = data.items.map((item) => ({
    ...item,
    amount: item.orderedQuantity * item.unitPrice,
  }));
  const subtotal = items.reduce((total, item) => total + item.amount, 0);

  return (
    <Document title={`Purchase Order ${data.poNumber}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.companyHeader}>
          <View style={styles.companyRow}>
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <Image style={styles.logo} src={logoPath} />
            <Text style={styles.companyName}>PT. MEKTEK TANJUNG LESTARI</Text>
          </View>
          <View style={styles.companyMeta}>
            <Text>
              Alamat : Jl. Jend. A. Yani RT. 01 No. 16 Mabu&apos;un, Murung
              Pudak, Tabalong 71571
            </Text>
            <Text>Telp / Fax : (0526) 2023535</Text>
            <Text>Email : mektek.ac@yahoo.com</Text>
          </View>
        </View>

        <Text style={styles.documentTitle}>PURCHASE ORDER</Text>

        <View style={styles.headerBox}>
          <View style={styles.supplierBox}>
            <Text style={styles.bold}>TO :</Text>
            <Text style={[styles.bold, { marginTop: 7, fontSize: 10 }]}>
              {data.supplierName}
            </Text>
            <Text style={{ marginTop: 14 }}>Project / Site:</Text>
            <Text style={[styles.bold, { marginTop: 3 }]}>
              {data.projectName}
            </Text>
          </View>
          <View style={styles.orderBox}>
            <InfoLine label="PO NO" value={data.poNumber} />
            <InfoLine label="DATE" value={formatDate(data.inputDate)} />
            <InfoLine label="DUE DATE" value={formatDate(data.dueDate)} />
            <InfoLine label="PO TYPE" value={data.poType} />
            <InfoLine label="VALUTA" value="IDR" />
          </View>
        </View>

        <View style={styles.metaBox}>
          <InfoLine label="Product" value="Spare Part / Material" />
          <InfoLine label="Category" value={data.projectName} />
        </View>

        <View style={styles.table}>
          <View style={[styles.row, styles.tableHeader]} fixed>
            <Text style={[styles.cell, styles.no]}>NO</Text>
            <Text style={[styles.cell, styles.description]}>DESCRIPTION</Text>
            <Text style={[styles.cell, styles.partNumber]}>PART NUMBER</Text>
            <Text style={[styles.cell, styles.quantity]}>QTY</Text>
            <Text style={[styles.cell, styles.price]}>HARGA SUPPLIER</Text>
            <Text style={[styles.cell, styles.amount]}>AMOUNT</Text>
          </View>
          {items.map((item) => (
            <View
              key={`${item.position}-${item.partName}`}
              style={styles.row}
              wrap={false}
            >
              <Text style={[styles.cell, styles.no]}>{item.position}</Text>
              <Text style={[styles.cell, styles.description]}>
                {item.partName}
              </Text>
              <Text style={[styles.cell, styles.partNumber]}>
                {item.partNumber || "-"}
              </Text>
              <Text style={[styles.cell, styles.quantity]}>
                {item.orderedQuantity}
              </Text>
              <Text style={[styles.cell, styles.price]}>
                Rp {formatMoney(item.unitPrice)}
              </Text>
              <Text style={[styles.cell, styles.amount]}>
                {formatMoney(item.amount)}
              </Text>
            </View>
          ))}
          <View style={styles.row} wrap={false}>
            <Text style={[styles.cell, styles.subtotalLabel]}>Sub Total</Text>
            <Text style={[styles.cell, styles.subtotalAmount]}>
              Rp {formatMoney(subtotal)}
            </Text>
          </View>
        </View>

        <View style={styles.remarksBox} wrap={false}>
          <Text style={styles.remarksTitle}>Remarks</Text>
          {items.some((item) => item.note && item.note.trim())
            ? items
                .filter((item) => item.note && item.note.trim())
                .map((item) => (
                  <View
                    key={`remark-${item.position}`}
                    style={styles.remarkLine}
                  >
                    <Text style={styles.remarkNumber}>{item.position}.</Text>
                    <Text style={styles.remarkText}>
                      {item.partName}
                      {item.note ? ` — ${item.note}` : ""}
                    </Text>
                  </View>
                ))
            : <Text>-</Text>}
        </View>

        <View style={styles.confirmation} wrap={false}>
          <Text style={styles.confirmationText}>Supplier confirmation :</Text>
          <Text style={styles.confirmationText}>
            We acknowledge receipt of this purchase order and confirm our
            compliance with details and other terms and conditions.
          </Text>
          <View style={styles.signatureRow}>
            <View style={styles.signature}>
              <Text>SIGNED / NAME / DATE</Text>
              <Text style={styles.signatureLine}>Dept. FA</Text>
            </View>
            <View style={styles.signature}>
              <Text>APPROVED BY</Text>
              <Text style={styles.signatureLine}>Dept. Purch</Text>
            </View>
            <View style={styles.signature}>
              <Text>AUTHORIZED PERSON</Text>
              <Text style={styles.signatureLine}>Purchasing Adm.</Text>
            </View>
          </View>
        </View>

        <Text
          style={styles.footer}
          fixed
          render={({ pageNumber, totalPages }) =>
            `Purchase Order ${data.poNumber} · Halaman ${pageNumber} / ${totalPages}`
          }
        />
      </Page>
    </Document>
  );
}

export async function renderMektekPurchaseOrderPdf(
  data: MektekPurchaseOrderPdfData,
): Promise<Uint8Array> {
  const buffer = await renderToBuffer(<PurchaseOrderDocument data={data} />);
  return new Uint8Array(buffer);
}
