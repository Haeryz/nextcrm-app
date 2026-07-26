"use client";

import { useRef, useState } from "react";
import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";
import { toast } from "sonner";

import { logoutCustomer } from "@/actions/auth/customer-session";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function CustomerLogoutButton({
  locale,
  className,
}: {
  locale: string;
  className?: string;
}) {
  const [pending, setPending] = useState(false);
  // `disabled` only takes effect on the next render, so a fast double-tap on a
  // phone can fire two logouts. This ref rejects the second one synchronously.
  const inFlight = useRef(false);

  async function handleLogout() {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);

    try {
      const result = await logoutCustomer();
      if ("error" in result) {
        toast.error(result.error);
        inFlight.current = false;
        setPending(false);
        return;
      }

      // Also clear a pre-migration NextAuth customer cookie when one exists.
      await signOut({ redirect: false });
      // Deliberately stays pending: the navigation below unmounts this page, so
      // re-enabling the button would only invite a second logout mid-redirect.
      window.location.assign(`/${locale}/customer`);
    } catch {
      toast.error("Logout gagal. Silakan coba lagi.");
      inFlight.current = false;
      setPending(false);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      onClick={handleLogout}
      disabled={pending}
      aria-busy={pending}
      className={cn(className)}
    >
      <LogOut aria-hidden="true" className="size-4" />
      {pending ? "Sedang Logout..." : "Logout"}
    </Button>
  );
}
