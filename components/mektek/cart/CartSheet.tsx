"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Minus, Plus, Trash2, ShoppingCart } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { useCart } from "./CartProvider";
import { formatIDR } from "./snap";

export function CartSheet() {
  const {
    lines,
    subtotal,
    setQuantity,
    remove,
    cartOpen,
    setCartOpen,
    openCartCheckout,
    isAuthenticated,
    loginHref,
  } = useCart();
  const router = useRouter();

  const handleCheckout = () => {
    setCartOpen(false);
    if (!isAuthenticated) {
      toast.error("Silakan Login untuk melanjutkan Checkout.");
      router.push(loginHref);
      return;
    }
    openCartCheckout();
  };

  return (
    <Sheet open={cartOpen} onOpenChange={setCartOpen}>
      <SheetContent
        side="right"
        className="customer-light flex w-full flex-col border-[#151a63]/10 bg-[#f7f8ff] text-[#091247] sm:max-w-md"
      >
        <SheetHeader>
          <SheetTitle>Keranjang</SheetTitle>
          <SheetDescription className="text-[#4b5577]">
            Sparepart yang siap Anda beli.
          </SheetDescription>
        </SheetHeader>

        {lines.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center text-sm text-[#4b5577]">
            <ShoppingCart className="size-8 opacity-40" />
            Keranjang masih kosong.
          </div>
        ) : (
          <>
            <div className="-mx-2 flex-1 space-y-3 overflow-y-auto px-2 py-2">
              {lines.map(({ item, quantity }) => (
                <div
                  key={item.id}
                  className="flex gap-3 rounded-md border border-[#151a63]/10 bg-white p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{item.description}</p>
                    <p className="truncate text-xs text-[#4b5577]">
                      {item.machine}
                      {item.partNumber
                        ? ` · ${item.partNumber}`
                        : ""}
                    </p>
                    <p className="mt-1 text-sm font-medium">{formatIDR(item.price)}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="size-10 sm:size-7 border-[#151a63]/20 bg-white text-[#10164f] hover:bg-[#eef1ff]"
                        onClick={() => setQuantity(item.id, quantity - 1)}
                        disabled={quantity <= 1}
                        aria-label={`Kurangi jumlah ${item.description}`}
                      >
                        <Minus className="size-3.5" aria-hidden="true" />
                      </Button>
                      <span className="w-6 text-center text-sm">
                        <span className="sr-only">Jumlah: </span>
                        {quantity}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="size-10 sm:size-7 border-[#151a63]/20 bg-white text-[#10164f] hover:bg-[#eef1ff]"
                        onClick={() => setQuantity(item.id, quantity + 1)}
                        aria-label={`Tambah jumlah ${item.description}`}
                      >
                        <Plus className="size-3.5" aria-hidden="true" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="ml-auto size-10 sm:size-7 text-[#4b5577] hover:bg-[#eef1ff] hover:text-destructive"
                        onClick={() => remove(item.id)}
                        aria-label={`Hapus ${item.description} dari keranjang`}
                      >
                        <Trash2 className="size-4" aria-hidden="true" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <Separator />
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#4b5577]">Subtotal</span>
                <span className="font-semibold">{formatIDR(subtotal)}</span>
              </div>
              <p className="text-xs text-[#4b5577]">
                PPN 11% & PPh 2% dihitung saat Checkout.
              </p>
              {/* Must call handleCheckout: the inline handler that used to be here
                  skipped the isAuthenticated guard, so a signed-out customer could
                  fill in the whole checkout form and only hit AUTH_REQUIRED on
                  submit — losing everything they typed. */}
              <Button
                type="button"
                className="w-full bg-[#151a63] text-[#fff200] hover:bg-[#10164f]"
                onClick={handleCheckout}
              >
                Checkout
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
