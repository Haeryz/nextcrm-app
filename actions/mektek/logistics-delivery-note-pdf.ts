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

export type MektekDeliveryNoteData = {
  deliveryNoteNumber: string;
  receivedAt: Date;
  recipientName: string;
  projectName: string;
  poNumber: string;
  picName: string;
  items: Array<{
    description: string;
    partNumber: string | null;
    quantity: number;
    note: string | null;
  }>;
};

const logoPath = resolve(process.cwd(), "public/images/logo-pt-mektek-tanjung-lestari.jpg");

const styles = StyleSheet.create({
  page: {
    paddingHorizontal: 30,
    paddingVertical: 26,
    fontFamily: "Helvetica",
    fontSize: 9,
    color: "#111827",
    backgroundColor: "#ffffff",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  identity: { width: "59%", flexDirection: "row", alignItems: "flex-start" },
  logo: { width: 72, height: 72, objectFit: "contain", marginRight: 10 },
  company: { flex: 1 },
  companyName: { fontFamily: "Helvetica-Bold", fontSize: 15, marginBottom: 4 },
  companyLine: { fontSize: 8, lineHeight: 1.35 },
  recipient: { width: "37%", paddingTop: 4 },
  recipientLabel: { fontFamily: "Helvetica-Bold", fontSize: 9, marginBottom: 4 },
  recipientLine: {
    borderBottomWidth: 0.8,
    borderBottomColor: "#111827",
    paddingBottom: 3,
    marginBottom: 4,
    fontSize: 9,
  },
  documentBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  documentTitle: { fontFamily: "Helvetica-Bold", fontSize: 13 },
  documentNumber: { fontFamily: "Helvetica-Bold", fontSize: 12 },
  documentDate: { fontSize: 8.5 },
  table: { borderWidth: 1, borderColor: "#111827" },
  row: { flexDirection: "row" },
  headerRow: { flexDirection: "row", backgroundColor: "#f3f4f6" },
  cell: {
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#111827",
    paddingHorizontal: 5,
    paddingVertical: 7,
    minHeight: 31,
    justifyContent: "center",
  },
  lastRowCell: { borderBottomWidth: 0 },
  lastColumn: { borderRightWidth: 0 },
  headerText: { fontFamily: "Helvetica-Bold", fontSize: 8, textAlign: "center" },
  numberCell: { width: "7%", alignItems: "center" },
  descriptionCell: { width: "39%" },
  partNumberCell: { width: "26%" },
  quantityCell: { width: "10%", alignItems: "center" },
  noteCell: { width: "18%" },
  footer: {
    marginTop: 42,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  signature: { width: "34%", alignItems: "center" },
  signatureSpace: { height: 62 },
  signatureLine: { width: "90%", borderTopWidth: 0.8, borderTopColor: "#111827" },
  signatureLabel: { marginTop: 4, fontSize: 8.5 },
  footerNote: { marginTop: 24, fontSize: 7.5, color: "#4b5563", textAlign: "center" },
});

const dateFormatter = new Intl.DateTimeFormat("id-ID", {
  day: "2-digit",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

function DeliveryNoteDocument({ data }: { data: MektekDeliveryNoteData }) {
  return React.createElement(
    Document,
    null,
    React.createElement(
      Page,
      { size: "A4", style: styles.page },
      React.createElement(
        View,
        { style: styles.header },
        React.createElement(
          View,
          { style: styles.identity },
          React.createElement(Image, { src: logoPath, style: styles.logo }),
          React.createElement(
            View,
            { style: styles.company },
            React.createElement(Text, { style: styles.companyName }, "PT. MEKTEK TANJUNG LESTARI"),
            React.createElement(Text, { style: styles.companyLine }, "Jl. Jend. A. Yani RT. 01 Kel. Mabu'un"),
            React.createElement(Text, { style: styles.companyLine }, "Kec. Murung Pudak, Kab. Tabalong KAL-SEL"),
            React.createElement(Text, { style: styles.companyLine }, "Telp./Fax. (0526) 2023535"),
            React.createElement(Text, { style: styles.companyLine }, "HP. 0813 5118 2765 - 0812 5011 516"),
            React.createElement(Text, { style: styles.companyLine }, "E-mail: mektek.ac@yahoo.com"),
          ),
        ),
        React.createElement(
          View,
          { style: styles.recipient },
          React.createElement(Text, { style: styles.recipientLabel }, "KEPADA YTH:"),
          React.createElement(Text, { style: styles.recipientLine }, data.recipientName),
          React.createElement(Text, { style: styles.recipientLine }, `PROJECT: ${data.projectName}`),
          React.createElement(Text, { style: styles.recipientLine }, `PO: ${data.poNumber}`),
          React.createElement(Text, { style: styles.recipientLine }, `PIC: ${data.picName}`),
        ),
      ),
      React.createElement(
        View,
        { style: styles.documentBar },
        React.createElement(
          View,
          { style: { flexDirection: "row", alignItems: "baseline" } },
          React.createElement(Text, { style: styles.documentTitle }, "SURAT JALAN : "),
          React.createElement(Text, { style: styles.documentNumber }, data.deliveryNoteNumber),
        ),
        React.createElement(
          Text,
          { style: styles.documentDate },
          dateFormatter.format(data.receivedAt),
        ),
      ),
      React.createElement(
        View,
        { style: styles.table },
        React.createElement(
          View,
          { style: styles.headerRow },
          React.createElement(View, { style: [styles.cell, styles.numberCell] }, React.createElement(Text, { style: styles.headerText }, "NO.")),
          React.createElement(View, { style: [styles.cell, styles.descriptionCell] }, React.createElement(Text, { style: styles.headerText }, "DESCRIPTION")),
          React.createElement(View, { style: [styles.cell, styles.partNumberCell] }, React.createElement(Text, { style: styles.headerText }, "PART NUMBER")),
          React.createElement(View, { style: [styles.cell, styles.quantityCell] }, React.createElement(Text, { style: styles.headerText }, "QTY")),
          React.createElement(View, { style: [styles.cell, styles.noteCell, styles.lastColumn] }, React.createElement(Text, { style: styles.headerText }, "KET.")),
        ),
        ...data.items.map((item, index) => {
          const isLast = index === data.items.length - 1;
          const cellStyles = isLast ? [styles.cell, styles.lastRowCell] : [styles.cell];
          return React.createElement(
            View,
            { key: `${item.partNumber ?? item.description}-${index}`, style: styles.row },
            React.createElement(View, { style: [...cellStyles, styles.numberCell] }, React.createElement(Text, null, String(index + 1))),
            React.createElement(View, { style: [...cellStyles, styles.descriptionCell] }, React.createElement(Text, null, item.description)),
            React.createElement(View, { style: [...cellStyles, styles.partNumberCell] }, React.createElement(Text, null, item.partNumber || "-")),
            React.createElement(View, { style: [...cellStyles, styles.quantityCell] }, React.createElement(Text, null, String(item.quantity))),
            React.createElement(View, { style: [...cellStyles, styles.noteCell, styles.lastColumn] }, React.createElement(Text, null, item.note || "")),
          );
        }),
      ),
      React.createElement(
        View,
        { style: styles.footer },
        React.createElement(
          View,
          { style: styles.signature },
          React.createElement(Text, null, "Penerima"),
          React.createElement(View, { style: styles.signatureSpace }),
          React.createElement(View, { style: styles.signatureLine }),
          React.createElement(Text, { style: styles.signatureLabel }, "Nama & tanda tangan"),
        ),
        React.createElement(
          View,
          { style: styles.signature },
          React.createElement(Text, null, "Logistics MekTek"),
          React.createElement(View, { style: styles.signatureSpace }),
          React.createElement(View, { style: styles.signatureLine }),
          React.createElement(Text, { style: styles.signatureLabel }, "Nama & tanda tangan"),
        ),
      ),
      React.createElement(
        Text,
        { style: styles.footerNote },
        "Dokumen operasional Logistics PT. MekTek Tanjung Lestari",
      ),
    ),
  );
}

export async function renderMektekDeliveryNotePdf(
  data: MektekDeliveryNoteData,
): Promise<Uint8Array> {
  const buffer = await renderToBuffer(DeliveryNoteDocument({ data }));
  return new Uint8Array(buffer);
}
