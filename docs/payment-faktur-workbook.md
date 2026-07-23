# Payment Faktur 2026 workbook mapping

Source: `data/PAYMENT FAKTUR 2026.xlsx`
Source SHA-256: `3d67c610ce41456914527dbd57942fb2d08d2e723e1922caf06edae1ae7f8071`

Sheets 1–2 (`MENU` and `DIAGRAM `) are navigation/report helpers. Sheets
3–45 are 43 customer ledgers. An invoice row starts at row 15 and is real only
when column C contains an invoice number. This excludes 97 preformatted formula
rows and imports 1,584 actual invoices.

## Row columns

| Column | Workbook meaning | System behavior |
| --- | --- | --- |
| A | Sequential number | Derived from source row; not stored as business data |
| B | Nomor kwitansi | Editable `receiptNumber` |
| C | Nomor invoice | Required, editable, intentionally not unique |
| D | Tanggal invoice | Editable date |
| E | Nomor PO | Editable; may contain more than one PO |
| F | Tanggal pengiriman | Editable date |
| G | Description | Required, editable |
| H | Total before tax | Editable money amount |
| I | PPN amount | Editable money amount; never hardcoded from the header label |
| J | Grand total | Preserved on import; calculated as H + I for new/edited rows |
| K | Tanggal transfer | Editable; a date means the invoice is paid in full |
| L | Nomor faktur pajak | Editable |
| M | Unlabeled separator | Not mapped; one stray value exists at `TU!M19` |
| N | Delivery month number | Derived from F |
| O | Transfer month number | Derived from K |
| P | Hutang dibayar | Derived: J when K exists, otherwise Q + R + S |
| Q | Cicilan 1 | Editable money amount |
| R | Cicilan 2 | Editable money amount |
| S | Cicilan 3 | Editable money amount |
| T | Sisa hutang | Derived as J - P, floored at zero |
| U | Duplicate invoice helper | Derived from C; not stored twice |
| V onward | Month/status report helpers | Rebuilt as summaries, not editable row data |

The workbook has two header labels for column I (`PPN 10%` and `PPN 11%`),
while actual amounts are predominantly 11%. The system therefore preserves and
edits the tax amount rather than trusting the sheet label.

## Sheet-level report cells

- `J11` / `O11`: customer name.
- `P11`: total grand total.
- `Q11`: total paid.
- `R11`: total unpaid.
- `S11:AD11`: January–December invoice totals, grouped by delivery month.
- `R7`: paid invoice count.
- `R9`: pending invoice count.

These are calculated from ledger rows in the application. They are not imported
as independent values.

## Import identity

Imported rows are uniquely identified by customer sheet plus Excel source row.
This preserves six duplicate invoice-number groups, including five rows for
`MTL0053026`. Re-running the importer uses that identity to skip existing rows
and does not overwrite edits made after the legacy upload.
