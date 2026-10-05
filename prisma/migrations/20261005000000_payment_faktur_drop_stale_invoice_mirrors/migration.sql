-- Editing an invoice's customer used to leave its old Payment Faktur row
-- behind, so the invoice was counted twice (once under the old customer).
-- Drop those stale copies: same invoice number, sheet not belonging to the
-- invoice's customer, no payment recorded, and a correct copy already exists.
DELETE FROM "PaymentFakturEntry" e
USING "PaymentFakturCustomer" c, "FinanceInvoice" i, "FinanceCounterparty" cp
WHERE c.id = e."customerId"
  AND lower(i."invoiceNumber") = lower(e."invoiceNumber")
  AND cp.id = i."counterpartyId"
  AND btrim(regexp_replace(upper(btrim(c."customerName")), '[^A-Z0-9]+', '-', 'g'), '-') <> cp."normalizedName"
  AND e."transferDate" IS NULL
  AND e."installment1" + e."installment2" + e."installment3" = 0
  AND EXISTS (
    SELECT 1
    FROM "PaymentFakturEntry" o
    JOIN "PaymentFakturCustomer" oc ON oc.id = o."customerId"
    WHERE o.id <> e.id
      AND lower(o."invoiceNumber") = lower(e."invoiceNumber")
      AND btrim(regexp_replace(upper(btrim(oc."customerName")), '[^A-Z0-9]+', '-', 'g'), '-') = cp."normalizedName"
  );
