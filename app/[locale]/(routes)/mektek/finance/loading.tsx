import { ListPageSkeleton } from "../_components/MektekSkeletons";

// Covers every finance sub-route (overview, invoices, payables, receivables,
// revenue, services, spare-parts, contracts, delivery-notes, cash, audit,
// approvals, payment-faktur, supplier-debt-report). The finance layout renders
// the "Keuangan & Akuntansi" header itself, so this only mimics the content
// area (matching FinanceWorkspace's `<main>` padding) instead of adding a
// second heading.
export default function Loading() {
  return (
    <main className="space-y-6 px-4 pb-8 sm:px-6">
      <ListPageSkeleton rows={10} />
    </main>
  );
}
