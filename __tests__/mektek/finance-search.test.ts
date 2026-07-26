import { readFileSync } from "fs";
import { resolve } from "path";

import {
  matchesReportQuery,
  reportQueryTerms,
} from "@/lib/mektek/finance-search";

describe("Finance recap search", () => {
  const row = [
    "PT Maju Jaya",
    "SJ-2026-0012",
    "123/PO/VII/2026",
    "Filter oli mesin",
  ];

  it("matches an empty query", () => {
    expect(matchesReportQuery("", ...row)).toBe(true);
    expect(matchesReportQuery("   ", ...row)).toBe(true);
  });

  it("matches terms that live in different fields", () => {
    expect(matchesReportQuery("maju 123/PO", ...row)).toBe(true);
    expect(matchesReportQuery("filter sj-2026", ...row)).toBe(true);
  });

  it("requires every term to be present", () => {
    expect(matchesReportQuery("maju gearbox", ...row)).toBe(false);
  });

  it("is case and accent-position insensitive", () => {
    expect(matchesReportQuery("PT MAJU", ...row)).toBe(true);
  });

  it("treats a quoted term as a single phrase", () => {
    expect(matchesReportQuery('"filter oli"', ...row)).toBe(true);
    expect(matchesReportQuery('"oli filter"', ...row)).toBe(false);
  });

  it("does not let a phrase span two separate fields", () => {
    expect(matchesReportQuery('"pt maju jaya sj-2026-0012"', ...row)).toBe(
      false,
    );
  });

  it("ignores null and undefined fields", () => {
    expect(matchesReportQuery("maju", "PT Maju Jaya", null, undefined)).toBe(
      true,
    );
  });

  it("splits quoted and bare terms", () => {
    expect(reportQueryTerms('pt "filter oli" 123')).toEqual([
      "pt",
      "filter oli",
      "123",
    ]);
  });

  it("narrows the invoice search in the database", () => {
    const workspace = readFileSync(
      resolve(
        process.cwd(),
        "app/[locale]/(routes)/mektek/finance/_components/FinanceWorkspace.tsx",
      ),
      "utf8",
    );

    expect(workspace).toContain("const invoiceSearchWhere");
    expect(workspace).toContain("where: invoiceSearchWhere(query)");
    // Search must reach the counterparty name and the line descriptions, not
    // just the columns on the invoice itself.
    expect(workspace).toContain("counterparty: {");
    expect(workspace).toContain("lines: {");
  });
});
