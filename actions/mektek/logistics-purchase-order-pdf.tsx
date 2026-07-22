import React from "react";
import {
  Document,
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
  }>;
};

const styles = StyleSheet.create({
  page: { padding: 32, fontFamily: "Helvetica", fontSize: 9, color: "#111827" },
  header: { flexDirection: "row", justifyContent: "space-between", borderBottomWidth: 2, borderBottomColor: "#111827", paddingBottom: 10, marginBottom: 14 },
  brand: { fontFamily: "Helvetica-Bold", fontSize: 18 },
  title: { fontFamily: "Helvetica-Bold", fontSize: 14, textAlign: "right" },
  number: { marginTop: 3, color: "#475569", textAlign: "right" },
  info: { flexDirection: "row", flexWrap: "wrap", borderWidth: 1, borderColor: "#cbd5e1", marginBottom: 14 },
  infoCell: { width: "50%", padding: 7, borderBottomWidth: 0.5, borderBottomColor: "#e2e8f0" },
  infoCellFull: { width: "100%" },
  label: { fontSize: 7, color: "#64748b", marginBottom: 2 },
  value: { fontFamily: "Helvetica-Bold" },
  table: { borderWidth: 1, borderColor: "#94a3b8" },
  tableHeader: { flexDirection: "row", backgroundColor: "#e2e8f0", fontFamily: "Helvetica-Bold" },
  tableRow: { flexDirection: "row", borderTopWidth: 0.5, borderTopColor: "#cbd5e1", minHeight: 24 },
  cell: { padding: 5 },
  cNo: { width: "8%", textAlign: "center" },
  cPart: { width: "52%" },
  cNumber: { width: "25%" },
  cQty: { width: "15%", textAlign: "right" },
  notes: { marginTop: 14, borderWidth: 1, borderColor: "#cbd5e1", padding: 8 },
  signatureRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 30 },
  signature: { width: "30%", textAlign: "center" },
  signatureLine: { marginTop: 46, borderTopWidth: 1, borderTopColor: "#111827", paddingTop: 4 },
  footer: { position: "absolute", left: 32, right: 32, bottom: 18, flexDirection: "row", justifyContent: "space-between", fontSize: 7, color: "#64748b" },
});

const date = (value: Date) =>
  new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Makassar",
  }).format(value);

function PurchaseOrderDocument({ data }: { data: MektekPurchaseOrderPdfData }) {
  return (
    <Document title={`Purchase Order ${data.poNumber}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View><Text style={styles.brand}>MEKTEK</Text><Text>PT. Mektek Tanjung Lestari</Text></View>
          <View><Text style={styles.title}>PURCHASE ORDER</Text><Text style={styles.number}>{data.poNumber}</Text></View>
        </View>
        <View style={styles.info}>
          <View style={[styles.infoCell, styles.infoCellFull]}><Text style={styles.label}>Supplier</Text><Text style={styles.value}>{data.supplierName}</Text></View>
          <View style={styles.infoCell}><Text style={styles.label}>Job Site / Project</Text><Text style={styles.value}>{data.projectName}</Text></View>
          <View style={styles.infoCell}><Text style={styles.label}>Jenis PO</Text><Text style={styles.value}>{data.poType}</Text></View>
          <View style={styles.infoCell}><Text style={styles.label}>Tanggal Input</Text><Text style={styles.value}>{date(data.inputDate)}</Text></View>
          <View style={styles.infoCell}><Text style={styles.label}>Batas Waktu</Text><Text style={styles.value}>{date(data.dueDate)}</Text></View>
        </View>
        <View style={styles.table}>
          <View style={styles.tableHeader} fixed>
            <Text style={[styles.cell, styles.cNo]}>No.</Text>
            <Text style={[styles.cell, styles.cPart]}>Part</Text>
            <Text style={[styles.cell, styles.cNumber]}>Part Number</Text>
            <Text style={[styles.cell, styles.cQty]}>QTY</Text>
          </View>
          {data.items.map((item) => (
            <View key={`${item.position}-${item.partName}`} style={styles.tableRow} wrap={false}>
              <Text style={[styles.cell, styles.cNo]}>{item.position}</Text>
              <Text style={[styles.cell, styles.cPart]}>{item.partName}</Text>
              <Text style={[styles.cell, styles.cNumber]}>{item.partNumber || "-"}</Text>
              <Text style={[styles.cell, styles.cQty]}>{item.orderedQuantity}</Text>
            </View>
          ))}
        </View>
        {data.notes && <View style={styles.notes}><Text style={styles.label}>Catatan</Text><Text>{data.notes}</Text></View>}
        <View style={styles.signatureRow} wrap={false}>
          <View style={styles.signature}><Text>Mengetahui</Text><Text style={styles.signatureLine}>Finance Accounting</Text></View>
          <View style={styles.signature}><Text>Disetujui</Text><Text style={styles.signatureLine}>Department Purchasing</Text></View>
          <View style={styles.signature}><Text>Dibuat / Order oleh</Text><Text style={styles.signatureLine}>Purchasing Admin</Text></View>
        </View>
        <View style={styles.footer} fixed>
          <Text>Dokumen Purchase Order MekTek</Text>
          <Text render={({ pageNumber, totalPages }) => `Halaman ${pageNumber} / ${totalPages}`} />
        </View>
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
