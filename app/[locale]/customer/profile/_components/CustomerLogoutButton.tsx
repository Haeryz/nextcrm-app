"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";
import { toast } from "sonner";

import { logoutCustomer } from "@/actions/auth/customer-session";
import { Button } from "@/components/ui/button";

export function CustomerLogoutButton({ locale }: { locale: string }) {
  const [pending, setPending] = useState(false);

  async function handleLogout() {
    setPending(true);
    try {
      const result = await logoutCustomer();
      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      // Also clear a pre-migration NextAuth customer cookie when one exists.
      await signOut({ redirect: false });
      window.location.assign(`/${locale}/customer`);
    } catch {
      toast.error("Logout failed. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      onClick={handleLogout}
      disabled={pending}
      className="border-[#151a63]/20 bg-white/80 text-[#10164f] hover:bg-[#eef1ff]"
    >
      <LogOut className="size-4" />
      {pending ? "Logging out..." : "Logout"}
    </Button>
  );
}
