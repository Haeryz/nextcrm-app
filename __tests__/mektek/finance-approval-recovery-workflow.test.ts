import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("finance approval and supplier-debt recovery workflow", () => {
  it("exposes auditable approval controls for pending finance requests", () => {
    const workspace = read(
      "app/[locale]/(routes)/mektek/finance/_components/FinanceWorkspace.tsx",
    );
    const decisions = read(
      "app/[locale]/(routes)/mektek/finance/_components/FinanceApprovalDecision.tsx",
    );
    const approvalCard = read(
      "app/[locale]/(routes)/mektek/finance/_components/FinanceApprovalCard.tsx",
    );
    const conflictContext = read(
      "lib/mektek/supply-conflict-approval.ts",
    );
    const approvalsPage = read(
      "app/[locale]/(routes)/mektek/finance/approvals/page.tsx",
    );
    const menu = read(
      "app/[locale]/(routes)/components/menu-items/Mektek.tsx",
    );

    expect(workspace).toContain("FinanceApprovalCard");
    expect(workspace).toContain("logisticsSupplyAllocation.findMany");
    expect(workspace).toContain("buildSupplyConflictContext");
    expect(approvalsPage).toContain('section="approvals"');
    expect(approvalsPage).toContain('requireFinanceSection(locale, "finance")');
    expect(workspace).toContain('"OVERRIDE_SUPPLY_CONFLICT"');
    expect(menu).toContain('/mektek/finance/approvals');
    expect(decisions).toContain("decideFinanceApproval");
    expect(decisions).toContain("Alasan keputusan");
    expect(decisions).toContain("Setujui pengecualian");
    expect(decisions).toContain("Tolak & tetap blokir");
    expect(approvalCard).toContain("PO yang diblokir");
    expect(approvalCard).toContain("Bertumpang tindih dengan");
    expect(approvalCard).toContain("Periksa sebelum memutuskan");
    expect(conflictContext).toContain("supplyPeriodsOverlap");
    expect(conflictContext).toContain("poMode !== candidate.poMode");
  });

  it("allows a reasoned rejection while only overriding supply on approval", () => {
    const actions = read("actions/mektek/finance.ts");

    expect(actions).toContain(
      'request.action === FinanceApprovalAction.OVERRIDE_SUPPLY_CONFLICT',
    );
    expect(actions).toContain('if (!reason) throw new Error("OVERRIDE_REASON_REQUIRED")');
    expect(actions).toContain("if (input.approve)");
    expect(actions).not.toContain("if (!input.approve || !reason)");
  });

  it("ships an idempotent, dry-run-first VPS recovery script", () => {
    const script = read("scripts/repair-variation-asun-payable.ts");

    expect(script).toContain('supplierInvoiceNumber: "MTL0708261"');
    expect(script).toContain('const TARGET_SHEET_KEY = "VARIASI AC"');
    expect(script).toContain("--paid-at=YYYY-MM-DD");
    expect(script).toContain("const commit = process.argv.includes(\"--commit\")");
    expect(script).toContain("dueDate: bill.billDate");
    expect(script).toContain("mektekSupplierDebtEntry.upsert");
  });
});
