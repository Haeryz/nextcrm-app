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
import { useCart, type CartLine } from "./CartProvider";
import { formatIDR } from "./snap";

export function CartSheet() {
  const {
    lines,
    subtotal,
    setQuantity,
    remove,
    add,
    cartOpen,
    setCartOpen,
    openCartCheckout,
    isAuthenticated,
    loginHref,
  } = useCart();
  const router = useRouter();

  /**
   * Removal is one tap away from the increment button, so it must be
   * recoverable. `add(item, quantity)` restores the exact line (the item
   * snapshot is already held in the cart line, so nothing needs refetching);
   * the restored row is appended rather than re-inserted at its old index.
   */
  const handleRemove = ({ item, quantity }: CartLine) => {
    remove(item.id);
    toast.success(`${item.description} dihapus dari keranjang`, {
      action: {
        label: "Urungkan",
        onClick: () => add(item, quantity),
      },
    });
  };

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
        className="customer-light flex w-full flex-col border-border/10 bg-muted text-[hsl(var(--brand-navy-ink))] sm:max-w-md"
      >
        <SheetHeader>
          <SheetTitle>Keranjang</SheetTitle>
          <SheetDescription className="text-muted-foreground">
            Sparepart yang siap Anda beli.
          </SheetDescription>
        </SheetHeader>

        {lines.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center text-sm text-muted-foreground">
            <ShoppingCart className="size-8 opacity-40" aria-hidden="true" />
            Keranjang masih kosong.
          </div>
        ) : (
          <>
            <ul className="-mx-2 flex-1 space-y-3 overflow-y-auto px-2 py-2">
              {lines.map((line) => {
                const { item, quantity } = line;
                return (
                  <li
                    key={item.id}
                    className="flex gap-3 rounded-xl border border-border/10 bg-card p-4 shadow-sm"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">
                        {item.description}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {item.machine}
                        {item.partNumber ? ` · ${item.partNumber}` : ""}
                      </p>
                      <p className="mt-1 text-sm font-medium">
                        {formatIDR(item.price)}
                      </p>
                      <div className="mt-3 flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="size-10 rounded-lg border-border/20 text-[hsl(var(--brand-navy-deep))] sm:size-7"
                          onClick={() => setQuantity(item.id, quantity - 1)}
                          disabled={quantity <= 1}
                          aria-label={`Kurangi jumlah ${item.description}`}
                        >
                          <Minus className="size-3.5" aria-hidden="true" />
                        </Button>
                        <span className="w-6 text-center text-sm tabular-nums">
                          <span className="sr-only">Jumlah: </span>
                          {quantity}
                        </span>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="size-10 rounded-lg border-border/20 text-[hsl(var(--brand-navy-deep))] sm:size-7"
                          onClick={() => setQuantity(item.id, quantity + 1)}
                          aria-label={`Tambah jumlah ${item.description}`}
                        >
                          <Plus className="size-3.5" aria-hidden="true" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="ml-auto size-10 rounded-lg text-muted-foreground hover:text-destructive sm:size-7"
                          onClick={() => handleRemove(line)}
                          aria-label={`Hapus ${item.description} dari keranjang`}
                        >
                          <Trash2 className="size-4" aria-hidden="true" />
                        </Button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>

            <Separator />
            <div className="space-y-3 pt-2">
              {/* aria-live so the running total is announced when a quantity
                  changes or a line is removed — the number updates far from the
                  control that changed it. */}
              <div
                className="flex items-center justify-between text-sm"
                aria-live="polite"
                aria-atomic="true"
              >
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-semibold tabular-nums">
                  {formatIDR(subtotal)}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                PPN 11% &amp; PPh 2% dihitung saat Checkout.
              </p>
              {/* Must call handleCheckout: the inline handler that used to be here
                  skipped the isAuthenticated guard, so a signed-out customer could
                  fill in the whole checkout form and only hit AUTH_REQUIRED on
                  submit — losing everything they typed. */}
              <Button
                type="button"
                className="h-11 w-full sm:h-10"
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
