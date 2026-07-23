import "dotenv/config";
import { prismadb } from "../lib/prisma";
import { syncOutboundDispatchBillingSource, syncPaidMektekPaymentToFinance, syncReceivingPayableSource, syncServiceOrderBillingSource } from "../lib/mektek/finance-sync";
import { mektekOrderWhere } from "../lib/mektek/orders";

async function main() {
  const commit = process.argv.includes("--commit");
  const [serviceOrders, paidPayments, receiptRows] = await Promise.all([
    prismadb.crm_Accounts_Tasks.findMany({ where: { ...mektekOrderWhere(), taskStatus: { in: ["AWAITING_PAYMENT", "COMPLETE"] } }, select: { id: true } }),
    prismadb.mektekPayment.findMany({ where: { paidAt: { not: null } }, select: { id: true } }),
    prismadb.logisticsReceipt.findMany({ select: { receivingReference: true, receivedAt: true, purchaseOrderItem: { select: { purchaseOrderId: true, purchaseOrder: { select: { flow: true } } } } } }),
  ]);
  const logistics = new Map<string, { purchaseOrderId: string; reference: string; occurredAt: Date; flow: "OUTBOUND" | "RECEIVING" }>();
  for (const row of receiptRows) {
    const purchaseOrderId = row.purchaseOrderItem.purchaseOrderId;
    const flow = row.purchaseOrderItem.purchaseOrder.flow;
    logistics.set(`${flow}:${purchaseOrderId}:${row.receivingReference}`, { purchaseOrderId, reference: row.receivingReference, occurredAt: row.receivedAt, flow });
  }
  console.log(JSON.stringify({ mode: commit ? "commit" : "dry-run", serviceOrders: serviceOrders.length, paidPayments: paidPayments.length, logisticsDocuments: logistics.size }, null, 2));
  if (!commit) {
    console.log("No data changed. Run pnpm finance:backfill -- --commit after reviewing the counts.");
    return;
  }
  for (const order of serviceOrders) await prismadb.$transaction((tx) => syncServiceOrderBillingSource(tx, { serviceOrderId: order.id, force: true }));
  for (const payment of paidPayments) await prismadb.$transaction((tx) => syncPaidMektekPaymentToFinance(tx, payment.id));
  for (const row of logistics.values()) {
    await prismadb.$transaction(async (tx) => {
      if (row.flow === "OUTBOUND") await syncOutboundDispatchBillingSource(tx, { purchaseOrderId: row.purchaseOrderId, dispatchReference: row.reference, occurredAt: row.occurredAt });
      else await syncReceivingPayableSource(tx, { purchaseOrderId: row.purchaseOrderId, receivingReference: row.reference, occurredAt: row.occurredAt });
    });
  }
  console.log("Finance backfill completed. All source keys are idempotent.");
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prismadb.$disconnect());
