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
      className="relative h-11 border-border/20 bg-background/80 text-[hsl(var(--brand-navy-deep))] sm:h-10"
      onClick={() => setCartOpen(true)}
      // The badge alone reads as a bare number, so the count goes in the
      // accessible name. It still contains the visible label ("Keranjang").
      aria-label={
        count > 0 ? `Buka keranjang, ${count} item` : "Buka keranjang, kosong"
      }
    >
      <ShoppingCart data-icon="inline-start" aria-hidden="true" />
      Keranjang
      {count > 0 && (
        <span
          aria-hidden="true"
          className="ml-1 inline-flex min-w-5 items-center justify-center rounded-full bg-[hsl(var(--brand-yellow))] px-1.5 text-xs font-semibold tabular-nums text-[hsl(var(--brand-navy-deep))]"
        >
          {count}
        </span>
      )}
    </Button>
  );
}
