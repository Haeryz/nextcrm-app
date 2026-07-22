import React from "react";
import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";

export type MektekCustomerSummaryPdfData = {
  customer: {
    name: string;
    phone: string;
    email?: string | null;
    type: "STANDARD" | "B2B";
    createdAt: Date;
  };
  vehicles: Array<{
    name: string;
    plateNumber: string;
    fleetNumber?: string | null;
  }>;
  orders: Array<{
    number: string;
    createdAt: Date;
    vehicle: string;
    mileageKm?: number | null;
    status: string;
    service: string;
  }>;
};

const styles = StyleSheet.create({
  page: { padding: 32, fontFamily: "Helvetica", fontSize: 9, color: "#111827" },
  header: { borderBottomWidth: 2, borderBottomColor: "#0f172a", paddingBottom: 10, marginBottom: 14 },
  brand: { fontSize: 18, fontFamily: "Helvetica-Bold" },
  title: { marginTop: 3, fontSize: 11, color: "#475569" },
  section: { marginBottom: 14 },
  sectionTitle: { fontSize: 10, fontFamily: "Helvetica-Bold", marginBottom: 6, color: "#0f172a" },
  infoGrid: { flexDirection: "row", flexWrap: "wrap", borderWidth: 1, borderColor: "#cbd5e1" },
  infoCell: { width: "50%", padding: 7, borderBottomWidth: 0.5, borderBottomColor: "#e2e8f0" },
  label: { fontSize: 7, color: "#64748b", marginBottom: 2 },
  value: { fontFamily: "Helvetica-Bold" },
  vehicleRow: { flexDirection: "row", borderWidth: 1, borderColor: "#e2e8f0", padding: 7, marginBottom: 4 },
  vehiclePlate: { width: "25%", fontFamily: "Helvetica-Bold" },
  vehicleName: { width: "50%" },
  vehicleFleet: { width: "25%", textAlign: "right", color: "#475569" },
  table: { borderWidth: 1, borderColor: "#cbd5e1" },
  tableHeader: { flexDirection: "row", backgroundColor: "#e2e8f0", fontFamily: "Helvetica-Bold" },
  tableRow: { flexDirection: "row", borderTopWidth: 0.5, borderTopColor: "#cbd5e1", minHeight: 28 },
  cell: { padding: 5 },
  cDate: { width: "15%" },
  cNumber: { width: "18%" },
  cVehicle: { width: "25%" },
  cService: { width: "30%" },
  cStatus: { width: "12%" },
  empty: { padding: 10, color: "#64748b", textAlign: "center" },
  footer: { position: "absolute", bottom: 18, left: 32, right: 32, flexDirection: "row", justifyContent: "space-between", fontSize: 7, color: "#64748b" },
});

const formatDate = (value: Date) =>
  new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Makassar",
  }).format(value);

function CustomerSummaryDocument({ data }: { data: MektekCustomerSummaryPdfData }) {
  return (
    <Document title={`Riwayat Servis - ${data.customer.name}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.brand}>MEKTEK</Text>
          <Text style={styles.title}>RINGKASAN PELANGGAN DAN RIWAYAT SERVIS</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Data Pelanggan</Text>
          <View style={styles.infoGrid}>
            <View style={styles.infoCell}><Text style={styles.label}>Nama</Text><Text style={styles.value}>{data.customer.name}</Text></View>
            <View style={styles.infoCell}><Text style={styles.label}>Jenis</Text><Text style={styles.value}>{data.customer.type === "B2B" ? "Perusahaan" : "Pribadi"}</Text></View>
            <View style={styles.infoCell}><Text style={styles.label}>Telepon</Text><Text style={styles.value}>{data.customer.phone}</Text></View>
            <View style={styles.infoCell}><Text style={styles.label}>Email</Text><Text style={styles.value}>{data.customer.email || "-"}</Text></View>
            <View style={styles.infoCell}><Text style={styles.label}>Pelanggan sejak</Text><Text style={styles.value}>{formatDate(data.customer.createdAt)}</Text></View>
            <View style={styles.infoCell}><Text style={styles.label}>Total servis</Text><Text style={styles.value}>{data.orders.length}</Text></View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Kendaraan</Text>
          {data.vehicles.length ? data.vehicles.map((vehicle) => (
            <View key={`${vehicle.plateNumber}-${vehicle.name}`} style={styles.vehicleRow} wrap={false}>
              <Text style={styles.vehiclePlate}>{vehicle.plateNumber}</Text>
              <Text style={styles.vehicleName}>{vehicle.name}</Text>
              <Text style={styles.vehicleFleet}>{vehicle.fleetNumber ? `Lambung ${vehicle.fleetNumber}` : "-"}</Text>
            </View>
          )) : <Text style={styles.empty}>Belum ada kendaraan tersimpan.</Text>}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Riwayat Servis</Text>
          <View style={styles.table}>
            <View style={styles.tableHeader} fixed>
              <Text style={[styles.cell, styles.cDate]}>Tanggal</Text>
              <Text style={[styles.cell, styles.cNumber]}>No. Servis</Text>
              <Text style={[styles.cell, styles.cVehicle]}>Kendaraan / KM</Text>
              <Text style={[styles.cell, styles.cService]}>Jasa</Text>
              <Text style={[styles.cell, styles.cStatus]}>Status</Text>
            </View>
            {data.orders.length ? data.orders.map((order) => (
              <View key={order.number} style={styles.tableRow} wrap={false}>
                <Text style={[styles.cell, styles.cDate]}>{formatDate(order.createdAt)}</Text>
                <Text style={[styles.cell, styles.cNumber]}>{order.number}</Text>
                <Text style={[styles.cell, styles.cVehicle]}>{order.vehicle}{order.mileageKm != null ? ` / ${order.mileageKm.toLocaleString("id-ID")} KM` : ""}</Text>
                <Text style={[styles.cell, styles.cService]}>{order.service}</Text>
                <Text style={[styles.cell, styles.cStatus]}>{order.status}</Text>
              </View>
            )) : <Text style={styles.empty}>Belum ada riwayat servis.</Text>}
          </View>
        </View>

        <View style={styles.footer} fixed>
          <Text>Dicetak dari MekTek CRM</Text>
          <Text render={({ pageNumber, totalPages }) => `Halaman ${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

export async function renderMektekCustomerSummaryPdf(
  data: MektekCustomerSummaryPdfData,
): Promise<Uint8Array> {
  const buffer = await renderToBuffer(<CustomerSummaryDocument data={data} />);
  return new Uint8Array(buffer);
}
