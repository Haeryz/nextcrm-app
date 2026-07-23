import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import { canViewMektekFinance } from "@/lib/mektek/permissions";
import { getServerSession } from "@/lib/session";

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
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            MekTek
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">Keuangan & Akuntansi</h1>
          <p className="text-sm text-muted-foreground">
            Input dan kelola invoice, surat jalan, pembayaran, pendapatan, dan kontrak.
          </p>
        </div>
      </div>
      {children}
    </div>
  );
}
