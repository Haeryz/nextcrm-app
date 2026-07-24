type PurchaseOrderPreviewItem = {
  position: number;
  partName: string;
  partNumber: string | null;
  orderedQuantity: number;
  unitPrice: number;
};

export type PurchaseOrderPreviewInput = {
  poNumber: string;
  supplierName: string;
  projectName: string;
  userName: string;
  inputDate: Date;
  dueDate: Date;
  poType: string;
  notes: string | null;
  items: PurchaseOrderPreviewItem[];
};

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

const escapeXml = (value: unknown) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const shorten = (value: string, maximum: number) =>
  value.length > maximum ? `${value.slice(0, maximum - 1)}…` : value;

export function renderPurchaseOrderPreviewSvg(input: PurchaseOrderPreviewInput) {
  const rowHeight = 68;
  const tableTop = 500;
  const tableBottom = tableTop + Math.max(input.items.length, 1) * rowHeight;
  const height = Math.max(1_420, tableBottom + 330);
  const subtotal = input.items.reduce(
    (total, item) => total + item.orderedQuantity * item.unitPrice,
    0,
  );
  const itemRows =
    input.items.length > 0
      ? input.items
          .map((item, index) => {
            const y = tableTop + index * rowHeight;
            const lineTotal = item.orderedQuantity * item.unitPrice;
            return `
              <rect x="70" y="${y}" width="1060" height="${rowHeight}" fill="${
                index % 2 === 0 ? "#ffffff" : "#f8fafc"
              }" stroke="#e2e8f0"/>
              <text x="96" y="${y + 40}" class="body center">${item.position}</text>
              <text x="154" y="${y + 30}" class="body strong">${escapeXml(
                shorten(item.partName, 54),
              )}</text>
              <text x="154" y="${y + 51}" class="caption">${escapeXml(
                item.partNumber || "Tanpa part number",
              )}</text>
              <text x="760" y="${y + 40}" class="body right">${item.orderedQuantity}</text>
              <text x="930" y="${y + 40}" class="body right">${escapeXml(
                rupiah.format(item.unitPrice),
              )}</text>
              <text x="1102" y="${y + 40}" class="body right strong">${escapeXml(
                rupiah.format(lineTotal),
              )}</text>
            `;
          })
          .join("")
      : `
        <rect x="70" y="${tableTop}" width="1060" height="${rowHeight}" fill="#ffffff" stroke="#e2e8f0"/>
        <text x="600" y="${tableTop + 42}" class="body muted center">Tidak ada item pada Purchase Order.</text>
      `;

  return `<?xml version="1.0" encoding="UTF-8"?>
    <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="${height}" viewBox="0 0 1200 ${height}">
      <style>
        text { font-family: Inter, Arial, sans-serif; fill: #172033; }
        .eyebrow { font-size: 18px; font-weight: 700; letter-spacing: 4px; fill: #6d28d9; }
        .title { font-size: 48px; font-weight: 800; }
        .document-number { font-size: 22px; font-weight: 700; fill: #ffffff; }
        .label { font-size: 15px; font-weight: 700; letter-spacing: 1px; fill: #64748b; }
        .value { font-size: 22px; font-weight: 650; }
        .body { font-size: 18px; }
        .strong { font-weight: 700; }
        .caption { font-size: 14px; fill: #64748b; }
        .muted { fill: #64748b; }
        .right { text-anchor: end; }
        .center { text-anchor: middle; }
        .table-head { font-size: 15px; font-weight: 750; letter-spacing: .5px; fill: #ffffff; }
      </style>
      <rect width="1200" height="${height}" fill="#f1f5f9"/>
      <rect x="42" y="36" width="1116" height="${height - 72}" rx="24" fill="#ffffff" stroke="#dbe3ef" stroke-width="2"/>
      <rect x="42" y="36" width="1116" height="20" rx="10" fill="#7c3aed"/>

      <text x="70" y="115" class="eyebrow">MEKTEK</text>
      <text x="70" y="172" class="title">PURCHASE ORDER</text>
      <rect x="780" y="88" width="350" height="84" rx="12" fill="#6d28d9"/>
      <text x="805" y="119" font-size="14" font-weight="700" fill="#ddd6fe">NOMOR PO</text>
      <text x="805" y="151" class="document-number">${escapeXml(input.poNumber)}</text>

      <line x1="70" y1="215" x2="1130" y2="215" stroke="#e2e8f0" stroke-width="2"/>

      <text x="70" y="266" class="label">PEMASOK</text>
      <text x="70" y="301" class="value">${escapeXml(input.supplierName)}</text>
      <text x="70" y="354" class="label">PROYEK</text>
      <text x="70" y="389" class="value">${escapeXml(input.projectName || "—")}</text>

      <text x="630" y="266" class="label">TANGGAL PO</text>
      <text x="630" y="301" class="value">${escapeXml(dateLabel(input.inputDate))}</text>
      <text x="880" y="266" class="label">JATUH TEMPO</text>
      <text x="880" y="301" class="value">${escapeXml(dateLabel(input.dueDate))}</text>
      <text x="630" y="354" class="label">DIBUAT OLEH</text>
      <text x="630" y="389" class="value">${escapeXml(
        shorten(input.userName || "—", 18),
      )}</text>
      <text x="880" y="354" class="label">JENIS PO</text>
      <text x="880" y="389" class="value">${escapeXml(input.poType || "Normal")}</text>

      <rect x="70" y="446" width="1060" height="54" rx="8" fill="#1e293b"/>
      <text x="96" y="480" class="table-head center">NO.</text>
      <text x="154" y="480" class="table-head">BARANG / PART</text>
      <text x="760" y="480" class="table-head right">QTY</text>
      <text x="930" y="480" class="table-head right">HARGA</text>
      <text x="1102" y="480" class="table-head right">JUMLAH</text>
      ${itemRows}

      <rect x="760" y="${tableBottom + 34}" width="370" height="86" rx="12" fill="#f5f3ff" stroke="#c4b5fd"/>
      <text x="786" y="${tableBottom + 68}" class="label">TOTAL PURCHASE ORDER</text>
      <text x="1102" y="${tableBottom + 100}" class="value right">${escapeXml(
        rupiah.format(subtotal),
      )}</text>

      <text x="70" y="${tableBottom + 70}" class="label">CATATAN</text>
      <text x="70" y="${tableBottom + 102}" class="body">${escapeXml(
        shorten(input.notes || "Tidak ada catatan.", 78),
      )}</text>
      <line x1="70" y1="${height - 125}" x2="1130" y2="${height - 125}" stroke="#e2e8f0"/>
      <text x="70" y="${height - 82}" class="caption">Dokumen sistem MekTek · ditampilkan langsung untuk pencocokan Finance.</text>
      <text x="1130" y="${height - 82}" class="caption right">${escapeXml(input.poNumber)}</text>
    </svg>`;
}
