"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { signOutCatalogCustomer } from "@/actions/catalog/customer";
import type { CatalogCustomerSessionUser } from "@/actions/catalog/customer";

export default function CustomerShell({
  customer,
  children,
}: {
  customer: CatalogCustomerSessionUser | null;
  children: React.ReactNode;
}) {
  const router = useRouter();

  async function onSignOut() {
    await signOutCatalogCustomer();
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="flex min-h-screen flex-col">
        <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b px-4">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href="/customer"
              className="rounded-full border px-4 py-2 font-medium"
              aria-label="Customer catalogue"
            >
              N
            </Link>
            <div className="min-w-0">
              <p className="text-sm font-semibold">NextCRM</p>
              <p className="truncate text-xs text-muted-foreground">Customer mode</p>
            </div>
          </div>

          <div className="flex min-w-0 items-center gap-2">
            {customer && (
              <p className="hidden truncate text-xs text-muted-foreground sm:block">
                {customer.username} · {customer.phone}
              </p>
            )}
            <ThemeToggle />
            {customer && (
              <>
                <Button asChild variant="outline" size="icon" aria-label="Profile">
                  <Link href="/customer/profile">
                    <UserRound className="size-4" />
                  </Link>
                </Button>
                <Button variant="outline" size="sm" onClick={onSignOut}>
                  <LogOut className="size-4" />
                  Sign out
                </Button>
              </>
            )}
          </div>
        </header>
        <main className="min-w-0 flex-1 overflow-y-auto px-4 py-5">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
