import path from "node:path";
import { readFileSync } from "node:fs";
import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";

import { FINANCE_DESTINATION_BANK_OPTIONS } from "@/lib/mektek/finance-bank-accounts";
import type { FinanceInvoiceSigner } from "@/lib/mektek/finance-invoice-signers";

export type FinanceInvoicePdfData = {
  invoiceNumber: string;
  customerName: string;
  invoiceDate: Date | null;
  dueDate: Date | null;
  deliveryNoteNumber: string | null;
  purchaseOrderNumber: string | null;
  purchaseOrderDate: Date | null;
  accountDestination: string | null;
  currency: string;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  notes: string | null;
  authorizedSigner: FinanceInvoiceSigner;
  lines: Array<{
    description: string;
    partNumber: string | null;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }>;
};

const navy = "#1f2937";
const gray = "#6b7280";
const border = "#9ca3af";

const styles = StyleSheet.create({
  page: {
    paddingTop: 25,
    paddingHorizontal: 31,
    paddingBottom: 28,
    fontFamily: "Helvetica",
    fontSize: 8.5,
    color: navy,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 92,
  },
  brand: { flexDirection: "row", width: "64%" },
  logo: { width: 62, height: 62, objectFit: "contain", marginRight: 8 },
  companyName: { fontSize: 15, fontWeight: 700, marginTop: 3 },
  companyLine: { fontSize: 7.5, marginTop: 2 },
  invoiceHeading: { width: "32%" },
  invoiceTitle: {
    fontFamily: "Times-Roman",
    fontSize: 25,
    letterSpacing: 1,
    marginBottom: 7,
  },
  headingRow: { flexDirection: "row", marginTop: 2 },
  headingLabel: { width: 50, fontFamily: "Times-Bold", fontSize: 10 },
  headingValue: { flex: 1, fontFamily: "Times-Roman", fontSize: 10 },
  divider: {
    borderTopWidth: 0.8,
    borderTopColor: border,
    borderTopStyle: "dashed",
    marginBottom: 12,
  },
  recipientRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 63,
    paddingHorizontal: 20,
  },
  recipient: { width: "48%", fontFamily: "Times-Roman" },
  toLabel: { fontSize: 11, marginBottom: 7 },
  customerName: { fontSize: 14, marginLeft: 17 },
  poBlock: { width: "43%", fontFamily: "Times-Roman" },
  poRow: { flexDirection: "row", marginBottom: 4 },
  poLabel: { width: 66, fontSize: 10 },
  poValue: { flex: 1, fontSize: 10 },
  table: {
    borderWidth: 0.7,
    borderColor: border,
    minHeight: 362,
  },
  tableHeader: {
    flexDirection: "row",
    minHeight: 36,
    borderBottomWidth: 0.7,
    borderBottomColor: border,
    alignItems: "center",
    fontFamily: "Times-Bold",
    fontSize: 9.5,
    textAlign: "center",
  },
  tableBody: { paddingTop: 6 },
  tableRow: {
    flexDirection: "row",
    minHeight: 18,
    alignItems: "center",
    fontFamily: "Times-Roman",
    fontSize: 8.5,
  },
  cellNo: { width: "6%", textAlign: "center" },
  cellDescription: { width: "38%", paddingHorizontal: 4 },
  cellPart: { width: "21%", paddingHorizontal: 4, textAlign: "center" },
  cellQty: { width: "7%", textAlign: "center" },
  cellPrice: { width: "14%", paddingRight: 5, textAlign: "right" },
  verticalBorder: {
    borderLeftWidth: 0.7,
    borderLeftColor: border,
    alignSelf: "stretch",
    justifyContent: "center",
  },
  bottomArea: { flexDirection: "row", minHeight: 88 },
  remittance: {
    width: "64%",
    flexDirection: "row",
    borderLeftWidth: 0.7,
    borderBottomWidth: 0.7,
    borderColor: border,
  },
  bankBox: {
    width: "50%",
    padding: 6,
    borderRightWidth: 0.7,
    borderRightColor: border,
    fontSize: 7,
  },
  bankSelected: { backgroundColor: "#f3f4f6" },
  bankTitle: { fontFamily: "Times-Bold", fontSize: 7.5, marginBottom: 2 },
  bankLine: { fontFamily: "Times-Roman", marginTop: 2 },
  selectedText: { fontFamily: "Times-Bold", marginTop: 4 },
  totals: {
    width: "36%",
    borderRightWidth: 0.7,
    borderBottomWidth: 0.7,
    borderColor: border,
    padding: 5,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    fontFamily: "Times-Roman",
    fontSize: 9,
    marginBottom: 4,
  },
  grandTotal: {
    borderTopWidth: 0.7,
    borderTopColor: border,
    paddingTop: 5,
    fontFamily: "Times-Bold",
    fontSize: 11,
  },
  signatureArea: {
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 142,
    paddingTop: 18,
    paddingHorizontal: 35,
  },
  signatureBox: {
    width: "37%",
    alignItems: "center",
    fontFamily: "Times-Roman",
    fontSize: 11,
  },
  signatureSpace: { height: 72 },
  signatureLine: {
    width: "88%",
    borderTopWidth: 0.8,
    borderTopColor: navy,
    marginBottom: 4,
  },
  authorized: { fontFamily: "Times-Bold", letterSpacing: 2, fontSize: 11 },
  role: { fontSize: 10 },
  notes: {
    position: "absolute",
    left: 31,
    bottom: 25,
    width: "70%",
    fontSize: 6.5,
    color: gray,
  },
  pageNumber: {
    position: "absolute",
    bottom: 12,
    left: 0,
    right: 0,
    textAlign: "center",
    fontSize: 7,
  },
});

const logoSource = `data:image/jpeg;base64,${readFileSync(
  path.join(
    process.cwd(),
    "public",
    "images",
    "logo-pt-mektek-tanjung-lestari.jpg",
  ),
).toString("base64")}`;

const formatDate = (value: Date | null) =>
  value
    ? new Intl.DateTimeFormat("id-ID", {
        day: "2-digit",
        month: "short",
        year: "2-digit",
        timeZone: "UTC",
      }).format(value)
    : "-";

const amount = (value: number) =>
  new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);

const accountNumber = (bank: string) => {
  const match = /\(([^)]+)\)/.exec(bank);
  return match?.[1] ?? bank;
};

function FinanceInvoiceDocument({ data }: { data: FinanceInvoicePdfData }) {
  const dppOther =
    data.taxAmount > 0 && Math.abs(data.taxRate - 11) < 0.001
      ? data.subtotal * (11 / 12)
      : data.subtotal;

  return (
    <Document
      title={`Invoice ${data.invoiceNumber}`}
      author="PT. Mektek Tanjung Lestari"
      subject="Invoice siap cetak dan ditandatangani"
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.brand}>
            {/* React PDF's Image component does not expose an HTML alt prop. */}
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <Image src={logoSource} style={styles.logo} />
            <View>
              <Text style={styles.companyName}>
                PT. MEKTEK TANJUNG LESTARI
              </Text>
              <Text style={styles.companyLine}>
                Jl. Jend. A. Yani RT 01 Kel. Mabuun
              </Text>
              <Text style={styles.companyLine}>
                Kec. Murung Pudak, Tanjung - Tabalong
              </Text>
              <Text style={styles.companyLine}>Telp./Fax. (0526) 2023535</Text>
              <Text style={styles.companyLine}>
                E-mail: mektek.ac@yahoo.com
              </Text>
            </View>
          </View>
          <View style={styles.invoiceHeading}>
            <Text style={styles.invoiceTitle}>INVOICE</Text>
            <View style={styles.headingRow}>
              <Text style={styles.headingLabel}>Nomor</Text>
              <Text style={styles.headingValue}>: {data.invoiceNumber}</Text>
            </View>
            <View style={styles.headingRow}>
              <Text style={styles.headingLabel}>Tanggal</Text>
              <Text style={styles.headingValue}>
                : {formatDate(data.invoiceDate)}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.recipientRow}>
          <View style={styles.recipient}>
            <Text style={styles.toLabel}>To.</Text>
            <Text style={styles.customerName}>{data.customerName}</Text>
          </View>
          <View style={styles.poBlock}>
            <View style={styles.poRow}>
              <Text style={styles.poLabel}>Nomor PO</Text>
              <Text style={styles.poValue}>
                : {data.purchaseOrderNumber || "-"}
              </Text>
            </View>
            <View style={styles.poRow}>
              <Text style={styles.poLabel}>Tanggal</Text>
              <Text style={styles.poValue}>
                : {formatDate(data.purchaseOrderDate)}
              </Text>
            </View>
            {data.deliveryNoteNumber ? (
              <View style={styles.poRow}>
                <Text style={styles.poLabel}>Surat Jalan</Text>
                <Text style={styles.poValue}>
                  : {data.deliveryNoteNumber}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.cellNo}>NO</Text>
            <View style={[styles.cellDescription, styles.verticalBorder]}>
              <Text>DESCRIPTION</Text>
            </View>
            <View style={[styles.cellPart, styles.verticalBorder]}>
              <Text>PART NUMBER</Text>
            </View>
            <View style={[styles.cellQty, styles.verticalBorder]}>
              <Text>QTY</Text>
            </View>
            <View style={[styles.cellPrice, styles.verticalBorder]}>
              <Text>UNIT PRICE</Text>
            </View>
            <View style={[styles.cellPrice, styles.verticalBorder]}>
              <Text>TOTAL PRICE</Text>
            </View>
          </View>
          <View style={styles.tableBody}>
            {data.lines.map((line, index) => (
              <View
                key={`${index}-${line.description}-${line.partNumber ?? ""}`}
                style={styles.tableRow}
              >
                <Text style={styles.cellNo}>{index + 1}</Text>
                <Text style={styles.cellDescription}>{line.description}</Text>
                <Text style={styles.cellPart}>{line.partNumber || "-"}</Text>
                <Text style={styles.cellQty}>{amount(line.quantity)}</Text>
                <Text style={styles.cellPrice}>{amount(line.unitPrice)}</Text>
                <Text style={styles.cellPrice}>{amount(line.lineTotal)}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.bottomArea}>
          <View style={styles.remittance}>
            {FINANCE_DESTINATION_BANK_OPTIONS.map((bank) => {
              const selected = data.accountDestination === bank;
              const bankName = bank.startsWith("Mandiri") ? "Mandiri" : "BRI";
              return (
                <View
                  key={bank}
                  style={[styles.bankBox, selected ? styles.bankSelected : {}]}
                >
                  <Text style={styles.bankTitle}>Remittance Address :</Text>
                  <Text style={styles.bankLine}>
                    PT. MEKTEK TANJUNG LESTARI
                  </Text>
                  <Text style={styles.bankLine}>Bank {bankName} Cabang Tanjung</Text>
                  <Text style={styles.bankLine}>
                    A/c {accountNumber(bank)}
                  </Text>
                  {selected ? (
                    <Text style={styles.selectedText}>REKENING DIPILIH</Text>
                  ) : null}
                </View>
              );
            })}
          </View>
          <View style={styles.totals}>
            <View style={styles.totalRow}>
              <Text>Total</Text>
              <Text>{amount(data.subtotal)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text>DPP Nilai Lain/DPP</Text>
              <Text>{amount(dppOther)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text>PPN</Text>
              <Text>{amount(data.taxAmount)}</Text>
            </View>
            <View style={[styles.totalRow, styles.grandTotal]}>
              <Text>GRAND TOTAL</Text>
              <Text>{amount(data.total)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.signatureArea}>
          <View style={styles.signatureBox}>
            <Text>Received by :</Text>
            <View style={styles.signatureSpace} />
            <View style={styles.signatureLine} />
            <Text style={styles.role}>Finance Dept. Head</Text>
          </View>
          <View style={styles.signatureBox}>
            <Text>AUTHORIZED PERSON</Text>
            <View style={styles.signatureSpace} />
            <View style={styles.signatureLine} />
            <Text style={styles.authorized}>{data.authorizedSigner}</Text>
            <Text style={styles.role}>Management</Text>
          </View>
        </View>

        {data.notes ? (
          <Text style={styles.notes}>Catatan: {data.notes}</Text>
        ) : null}
        <Text
          style={styles.pageNumber}
          render={({ pageNumber, totalPages }) =>
            `Page ${pageNumber} of ${totalPages}`
          }
          fixed
        />
      </Page>
    </Document>
  );
}

export async function renderFinanceInvoicePdf(data: FinanceInvoicePdfData) {
  return renderToBuffer(<FinanceInvoiceDocument data={data} />);
}
