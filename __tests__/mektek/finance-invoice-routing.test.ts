import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { isUuid } from "@/lib/uuid";

const readSource = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("finance invoice routing", () => {
  const financeWorkspace = readSource(
    "app/[locale]/(routes)/mektek/finance/_components/FinanceWorkspace.tsx",
  );
  const recapCreateButton = readSource(
    "app/[locale]/(routes)/mektek/finance/_components/RecapCreateButton.tsx",
  );
  const recapRowActions = readSource(
    "app/[locale]/(routes)/mektek/finance/_components/RecapRowActions.tsx",
  );
  const orderDetailPage = readSource(
    "app/[locale]/(routes)/mektek/[id]/page.tsx",
  );
  const serviceOrderActions = readSource("actions/mektek/service-orders.ts");

  it("uses the canonical invoice route from every finance workspace", () => {
    for (const source of [
      financeWorkspace,
      recapCreateButton,
      recapRowActions,
    ]) {
      expect(source).not.toMatch(/href=\{?`?["']?\.{1,2}\/invoices/);
    }

    expect(financeWorkspace).toContain("/mektek/finance/invoices");
    expect(recapCreateButton).toContain("/mektek/finance/invoices");
    expect(recapRowActions).toContain("/mektek/finance/invoices");
  });

  it("rejects a static route name before querying an order UUID", () => {
    expect(isUuid("invoices")).toBe(false);
    expect(isUuid("cde29363-25c0-4c69-a69d-6637d2db00f9")).toBe(true);
    expect(orderDetailPage).toContain("if (!isUuid(id)) notFound()");
    expect(serviceOrderActions).toContain("if (!isUuid(id)) return null");
  });
});
