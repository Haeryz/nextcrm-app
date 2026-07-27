import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import {
  canManageMektekAccounting,
  canManageMektekFinance,
} from "@/lib/mektek/permissions";
import { getServerSession } from "@/lib/session";

export type FinanceSection = "accounting" | "finance";

// Per-section gate for the shared /mektek/finance/** shell. The layout already
// allows entry to anyone holding either MEKTEK_FINANCE or MEKTEK_ACCOUNTING; this
// helper narrows access to the specific workspace so a Finance-only sub-admin
// cannot reach Accounting pages (and vice versa). When blocked, the user is sent
// to the finance workspace they CAN access.
export async function requireFinanceSection(
  locale: string,
  section: FinanceSection,
) {
  const session = await getServerSession(authOptions);
  const allowed =
    section === "finance"
      ? canManageMektekFinance(session?.user)
      : canManageMektekAccounting(session?.user);
  if (!allowed) {
    redirect(
      `/${locale}/mektek/finance${section === "finance" ? "" : "/payables"}`,
    );
  }
}
