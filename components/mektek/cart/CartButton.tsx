"use client";

import { ShoppingCart } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useCart } from "./CartProvider";

export function CartButton() {
  const { count, setCartOpen } = useCart();

  return (
    <Button
      type="button"
      variant="outline"
      className="relative border-[#151a63]/20 bg-white/80 text-[#10164f] hover:bg-[#eef1ff] dark:border-white/15 dark:bg-white/10 dark:text-white dark:hover:bg-white/15"
      onClick={() => setCartOpen(true)}
    >
      <ShoppingCart data-icon="inline-start" />
      Keranjang
      {count > 0 && (
        <span className="ml-1 inline-flex min-w-5 items-center justify-center rounded-full bg-[#fff200] px-1.5 text-xs font-semibold text-[#10164f]">
          {count}
        </span>
      )}
    </Button>
  );
}
