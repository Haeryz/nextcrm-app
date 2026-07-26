"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ShoppingCart, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useCart, type StoreItem } from "./CartProvider";

/**
 * Per-card customer actions. Only rendered for priced items — unpriced
 * ("Hubungi admin") parts have no buy path.
 */
export function ItemActions({ item }: { item: StoreItem }) {
  const { add, openDirectCheckout, setCartOpen, isAuthenticated, loginHref } =
    useCart();
  const router = useRouter();

  const handleBuy = () => {
    if (!isAuthenticated) {
      toast.error("Silakan Login untuk melanjutkan pembelian.");
      router.push(loginHref);
      return;
    }
    openDirectCheckout(item);
  };

  return (
    <div className="flex gap-2">
      <Button
        type="button"
        variant="outline"
        className="h-11 flex-1 border-border/20 bg-card text-[hsl(var(--brand-navy-deep))] sm:h-10"
        onClick={() => {
          add(item, 1);
          toast.success("Ditambahkan ke keranjang", {
            action: { label: "Lihat", onClick: () => setCartOpen(true) },
          });
        }}
        aria-label={`Tambahkan ${item.description} ke keranjang`}
      >
        <ShoppingCart data-icon="inline-start" aria-hidden="true" />
        Keranjang
      </Button>
      <Button
        type="button"
        className="h-11 flex-1 sm:h-10"
        onClick={handleBuy}
        aria-label={`Beli ${item.description} sekarang`}
      >
        <Zap data-icon="inline-start" aria-hidden="true" />
        Beli
      </Button>
    </div>
  );
}
