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
      toast.error("Silakan masuk untuk melanjutkan pembelian.");
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
        className="flex-1 border-[#151a63]/20 bg-white text-[#10164f] hover:bg-[#eef1ff] dark:border-white/15 dark:bg-white/10 dark:text-white dark:hover:bg-white/15"
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
        className="flex-1 bg-[#151a63] text-[#fff200] hover:bg-[#10164f] dark:bg-[#fff200] dark:text-[#10164f] dark:hover:bg-[#f5e900]"
        onClick={() => openDirectCheckout(item)}
      >
        <Zap data-icon="inline-start" />
        Beli
      </Button>
    </div>
  );
}
