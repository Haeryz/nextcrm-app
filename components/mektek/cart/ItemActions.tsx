"use client";

import { toast } from "sonner";
import { ShoppingCart, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useCart, type StoreItem } from "./CartProvider";

/**
 * Per-card customer actions. Only rendered for priced items — unpriced
 * ("Hubungi admin") parts have no buy path.
 */
export function ItemActions({ item }: { item: StoreItem }) {
  const { add, openDirectCheckout, setCartOpen } = useCart();

  return (
    <div className="flex gap-2">
      <Button
        type="button"
        variant="outline"
        className="flex-1"
        onClick={() => {
          add(item, 1);
          toast.success("Ditambahkan ke keranjang", {
            action: { label: "Lihat", onClick: () => setCartOpen(true) },
          });
        }}
      >
        <ShoppingCart data-icon="inline-start" />
        Keranjang
      </Button>
      <Button
        type="button"
        className="flex-1"
        onClick={() => openDirectCheckout(item)}
      >
        <Zap data-icon="inline-start" />
        Beli
      </Button>
    </div>
  );
}
