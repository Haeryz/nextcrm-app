import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const readSource = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("Monitoring PO Surat Jalan revision (Edit QTY)", () => {
  const actionSource = readSource("actions/mektek/logistics.ts");
  const financeSyncSource = readSource("lib/mektek/finance-sync.ts");
  const outboundManager = readSource(
    "app/[locale]/(routes)/mektek/logistics/_components/OutboundLogisticsManager.tsx",
  );

  it("exposes a server action to revise outbound Surat Jalan quantities", () => {
    expect(actionSource).toContain(
      "export async function updateMektekOutboundDispatchQuantities",
    );
    expect(actionSource).toContain(
      "MektekOutboundDispatchRevisionInput",
    );
  });

  it("blocks revision once the Surat Jalan is billed into an invoice", () => {
    expect(actionSource).toContain('financeBillingSource.findUnique');
    expect(actionSource).toContain(
      'billingSource.status !== "UNBILLED"',
    );
    expect(actionSource).toContain(
      'billingSource.status !== "NEEDS_REVIEW"',
    );
    expect(actionSource).toContain(
      "Surat Jalan sudah masuk Faktur, tidak dapat direvisi",
    );
  });

  it("validates that revised quantity does not exceed QTY Order", () => {
    expect(actionSource).toContain("item.orderedQuantity");
    expect(actionSource).toContain("projectedShipped");
    expect(actionSource).toContain("melebihi QTY Order");
  });

  it("updates receipt quantity and adjusts cumulative shipped by the delta", () => {
    expect(actionSource).toContain(
      'tx.logisticsReceipt.update',
    );
    expect(actionSource).toContain(
      'receivedQuantity: { increment: delta }',
    );
    expect(actionSource).toContain(
      'receivedQuantity: item.receivedQuantity',
    );
  });

  it("applies a compensating stock movement for the revision delta", () => {
    expect(actionSource).toContain("direction: \"OUT\"");
    expect(actionSource).toContain("direction: \"IN\"");
    expect(actionSource).toContain("#revisi-");
    expect(actionSource).toContain("preventNegativeStock: true");
  });

  it("re-syncs the finance billing source after a revision", () => {
    expect(actionSource).toContain("syncOutboundDispatchBillingSource");
    expect(financeSyncSource).toContain("subtotal,");
    expect(financeSyncSource).toContain("status: priced");
    // The update branch must refresh the snapshot, not stay empty.
    expect(financeSyncSource).not.toContain("update: {}");
  });

  it("recomputes Monitoring PO status after a revision", () => {
    expect(actionSource).toContain(
      'where: { purchaseOrderId: purchaseOrder.id, status: "OPEN" }',
    );
    expect(actionSource).toContain("purchaseOrderStatus");
  });

  it("surfaces the Edit button and inline revision form in Riwayat Barang Keluar", () => {
    expect(outboundManager).toContain("Edit QTY Surat Jalan");
    expect(outboundManager).toContain("Simpan Revisi");
    expect(outboundManager).toContain("startEditDispatch");
    expect(outboundManager).toContain("saveDispatchRevision");
    expect(outboundManager).toContain("updateDispatchRevisionDraft");
    expect(outboundManager).toContain("updateMektekOutboundDispatchQuantities");
  });
});
