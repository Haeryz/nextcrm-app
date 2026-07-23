from __future__ import annotations

import hashlib
import json
import math
import re
from datetime import date, datetime
from pathlib import Path
from typing import Any

from openpyxl import load_workbook


SOURCE = Path("data/format alur penginputan Accounting.xlsx")
OUTPUT = Path(".tmp/accounting-demo-data.json")


def clean(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, float) and math.isnan(value):
        return None
    if isinstance(value, str):
        compact = re.sub(r"\s+", " ", value).strip()
        return compact or None
    return value


def text(value: Any) -> str | None:
    value = clean(value)
    return str(value) if value is not None else None


def number(value: Any) -> float | None:
    if isinstance(value, bool) or value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value) if math.isfinite(float(value)) else None
    normalized = re.sub(r"[^\d.-]", "", str(value))
    if not normalized:
        return None
    try:
        parsed = float(normalized)
        return parsed if math.isfinite(parsed) else None
    except ValueError:
        return None


def classify(description: str | None) -> str:
    value = (description or "").lower()
    part = bool(re.search(r"spare\s*part|suku cadang|\bpart\b|weld|penjualan", value))
    service = bool(re.search(r"jasa|service|servis|rental|maint|repair|perbaikan|rekondisi|labour|lembur|contract", value))
    if part and service:
        return "mixed"
    if part:
        return "sparepart"
    if service:
        return "service"
    return "other"


workbook = load_workbook(SOURCE, read_only=True, data_only=True)
rows: list[dict[str, Any]] = []
invoices: list[dict[str, Any]] = []


invoice_sheet = workbook["rek. inv"]
seen_invoice_numbers: set[str] = set()
for source_row, values in enumerate(
    invoice_sheet.iter_rows(min_row=8, max_row=7300, max_col=16, values_only=True),
    start=8,
):
    customer = text(values[1])
    invoice_number = text(values[5])
    subtotal = number(values[10])
    description = text(values[9])
    if not customer or not invoice_number or subtotal is None or subtotal <= 0:
        continue
    tax = number(values[11]) or 0
    total = number(values[12])
    if total is None or total <= 0:
        total = subtotal + tax
    category = classify(description)
    data = {
        "customer": customer,
        "deliveryNoteNumber": text(values[2]),
        "deliveryNoteDate": clean(values[3]),
        "receiptNumber": text(values[4]),
        "invoiceNumber": invoice_number,
        "invoiceDate": clean(values[6]),
        "purchaseOrderNumber": text(values[7]),
        "purchaseOrderDate": clean(values[8]),
        "description": description or "Invoice Accounting",
        "subtotal": subtotal,
        "taxAmount": tax,
        "total": total,
        "taxInvoiceNumber": text(values[13]),
        "accountDestination": text(values[14]),
        "colorCode": text(values[15]),
        "category": category,
    }
    rows.append({"sheetKey": "invoice_register", "sourceRow": source_row, "data": data})
    if invoice_number in seen_invoice_numbers:
        continue
    seen_invoice_numbers.add(invoice_number)
    invoices.append(data | {"sourceRow": source_row})


delivery_sheet = workbook["rekap SJ ( dari Logistik)"]
for source_row, values in enumerate(
    delivery_sheet.iter_rows(min_row=7, max_row=17066, max_col=12, values_only=True),
    start=7,
):
    company = text(values[0])
    delivery_number = text(values[1])
    if not company or not delivery_number:
        continue
    data = {
        "company": company,
        "deliveryNoteNumber": delivery_number,
        "deliveryNoteDate": clean(values[2]),
        "invoiceNumber": text(values[3]),
        "invoiceDate": clean(values[4]),
        "purchaseOrderNumber": text(values[5]),
        "purchaseOrderDate": clean(values[6]),
        "description": text(values[7]),
        "subtotal": number(values[8]),
        "taxAmount": number(values[9]),
        "total": number(values[10]),
    }
    rows.append({"sheetKey": "delivery_notes", "sourceRow": source_row, "data": data})


receivable_sheet = workbook["rek. penapatan inv. jasa & part"]
months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"]
for source_row, values in enumerate(
    receivable_sheet.iter_rows(min_row=10, max_row=164, max_col=17, values_only=True),
    start=10,
):
    customer = text(values[1])
    if not customer:
        continue
    data = {
        "customer": customer,
        "totalReceivable": number(values[2]) or 0,
        "paid": number(values[3]) or 0,
        "balance": number(values[4]) or 0,
        "months": {
            month: number(values[index + 5]) or 0
            for index, month in enumerate(months)
        },
        "notes": text(values[17]) if len(values) > 17 else None,
    }
    if not any([data["totalReceivable"], data["paid"], data["balance"], *data["months"].values()]):
        continue
    rows.append({"sheetKey": "invoice_receivables", "sourceRow": source_row, "data": data})


part_sheet = workbook["pend. part ( sesuai invoice)"]
for source_row, values in enumerate(
    part_sheet.iter_rows(min_row=8, max_row=182, max_col=13, values_only=True),
    start=8,
):
    customer = text(values[1])
    invoice_number = text(values[5])
    if not customer or not invoice_number:
        continue
    data = {
        "customer": customer,
        "deliveryNoteNumber": text(values[2]),
        "deliveryNoteDate": clean(values[3]),
        "receiptNumber": text(values[4]),
        "invoiceNumber": invoice_number,
        "invoiceDate": clean(values[6]),
        "purchaseOrderNumber": text(values[7]),
        "purchaseOrderDate": clean(values[8]),
        "subtotal": number(values[9]) or 0,
        "taxAmount": number(values[10]) or 0,
        "total": number(values[11]) or 0,
        "taxInvoiceNumber": text(values[12]),
    }
    rows.append({"sheetKey": "spare_part_income", "sourceRow": source_row, "data": data})


service_sheet = workbook["pend. jasa ( sesuai invoice)"]
for source_row, values in enumerate(
    service_sheet.iter_rows(min_row=9, max_row=68, max_col=12, values_only=True),
    start=9,
):
    customer = text(values[1])
    invoice_number = text(values[3])
    if not customer or not invoice_number:
        continue
    data = {
        "customer": customer,
        "receiptNumber": text(values[2]),
        "invoiceNumber": invoice_number,
        "invoiceDate": clean(values[4]),
        "purchaseOrderNumber": text(values[5]),
        "purchaseOrderDate": clean(values[6]),
        "subtotal": number(values[7]) or 0,
        "taxAmount": number(values[8]) or 0,
        "total": number(values[9]) or 0,
        "taxInvoiceNumber": text(values[10]),
        "notes": text(values[11]),
    }
    rows.append({"sheetKey": "service_income", "sourceRow": source_row, "data": data})


summary_sheet = workbook["pend. jasa & part"]
for source_row, values in enumerate(
    summary_sheet.iter_rows(min_row=8, max_row=79, max_col=7, values_only=True),
    start=8,
):
    customer = text(values[1])
    if not customer:
        continue
    data = {
        "customer": customer,
        "partIncome": number(values[2]) or 0,
        "serviceIncome": number(values[3]) or 0,
        "combinedIncome": number(values[4]) or 0,
        "taxAmount": number(values[5]) or 0,
        "total": number(values[6]) or 0,
    }
    if not any(value for key, value in data.items() if key != "customer"):
        continue
    rows.append({"sheetKey": "service_part_summary", "sourceRow": source_row, "data": data})


contract_sheet = workbook["kontrak"]
last_customer: str | None = None
for source_row, values in enumerate(
    contract_sheet.iter_rows(min_row=7, max_row=167, max_col=14, values_only=True),
    start=7,
):
    customer = text(values[1])
    if customer:
        last_customer = customer
    contract_number = text(values[3])
    period = text(values[5])
    if not last_customer or not any(text(value) for value in values[2:12]):
        continue
    data = {
        "number": text(values[0]),
        "customer": last_customer,
        "vendor": text(values[2]),
        "contractNumber": contract_number,
        "signatory": text(values[4]),
        "period": period,
        "contractValue": number(values[6]),
        "additionalValue": number(values[7]),
        "mechanicCount": number(values[8]),
        "mechanicUnit": text(values[9]),
        "workingHours": text(values[10]),
        "remarks": text(values[11]),
        "raw": [clean(value) for value in values],
    }
    rows.append({"sheetKey": "contracts", "sourceRow": source_row, "data": data})


source_hash = hashlib.sha256(SOURCE.read_bytes()).hexdigest()
counts: dict[str, int] = {}
for row in rows:
    counts[row["sheetKey"]] = counts.get(row["sheetKey"], 0) + 1

OUTPUT.parent.mkdir(parents=True, exist_ok=True)
OUTPUT.write_text(
    json.dumps(
        {
            "sourceFileName": SOURCE.name,
            "sourceSha256": source_hash,
            "counts": counts,
            "invoices": invoices,
            "rows": rows,
        },
        ensure_ascii=False,
        indent=2,
    ),
    encoding="utf-8",
)
print(json.dumps({"output": str(OUTPUT), "counts": counts, "invoices": len(invoices)}))
