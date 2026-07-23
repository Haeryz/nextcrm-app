import Link from "next/link";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { canViewMektekFinance } from "@/lib/mektek/permissions";
import { getServerSession } from "@/lib/session";

const links = [
  ["Overview", ""],
  ["Invoices", "/invoices"],
  ["Payables", "/payables"],
  ["Cash", "/cash"],
  ["Contracts", "/contracts"],
  ["Audit", "/audit"],
] as const;

export default async function FinanceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const [{ locale }, session] = await Promise.all([params, getServerSession(authOptions)]);
  if (!canViewMektekFinance(session?.user)) redirect(`/${locale}/mektek`);

  return (
    <div className="space-y-5">
      <div className="border-b bg-background px-4 pt-4 sm:px-6">
        <div className="mb-3">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">MekTek</p>
          <h1 className="text-2xl font-semibold tracking-tight">Finance workspace</h1>
          <p className="text-sm text-muted-foreground">Arus dokumen, approval, dan audit—bukan spreadsheet digital.</p>
        </div>
        <nav className="flex gap-1 overflow-x-auto pb-3" aria-label="Finance">
          {links.map(([label, suffix]) => (
            <Link key={label} href={`/${locale}/mektek/finance${suffix}`} className="whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
              {label}
            </Link>
          ))}
        </nav>
      </div>
      {children}
    </div>
  );
}
