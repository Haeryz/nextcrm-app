import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("Invoice preview action", () => {
  const actionsSource = readFileSync(
    resolve(
      process.cwd(),
      "app/[locale]/(routes)/mektek/_components/InvoiceActions.tsx",
    ),
    "utf8",
  );
  const invoiceRouteSource = readFileSync(
    resolve(
      process.cwd(),
      "app/api/mektek/service-orders/[id]/invoice/route.ts",
    ),
    "utf8",
  );

  it("opens the staff invoice inline with a view action", () => {
    expect(actionsSource).toContain('label="Lihat Invoice"');
    expect(actionsSource).toContain("icon={Eye}");
    expect(actionsSource).toContain(
      "`/api/mektek/service-orders/${serviceOrderId}/invoice`",
    );
    expect(actionsSource).not.toContain(
      "`/api/mektek/service-orders/${serviceOrderId}/invoice?download=1`",
    );
  });

  it("keeps the PDF route capable of inline browser rendering", () => {
    expect(invoiceRouteSource).toContain(
      '${download ? "attachment" : "inline"}',
    );
  });
});
