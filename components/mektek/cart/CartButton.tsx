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
      className="relative"
      onClick={() => setCartOpen(true)}
    >
      <ShoppingCart data-icon="inline-start" />
      Keranjang
      {count > 0 && (
        <span className="ml-1 inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground">
          {count}
        </span>
      )}
    </Button>
  );
}
