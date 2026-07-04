"use client";

import { CartSheet } from "./CartSheet";
import { CheckoutDialog } from "./CheckoutDialog";

/** Always-mounted cart drawer + checkout dialog. Place once inside CartProvider. */
export function CartMount() {
  return (
    <>
      <CartSheet />
      <CheckoutDialog />
    </>
  );
}
