"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type StoreItem = {
  id: string;
  description: string;
  price: number;
  machine: string | null;
  partNumber: string | null;
  catalogPartNumber: string | null;
  imagePath: string | null;
};

export type CartLine = { item: StoreItem; quantity: number };

type CheckoutMode = { kind: "cart" } | { kind: "direct"; item: StoreItem };

type CartContextValue = {
  locale: string;
  isAuthenticated: boolean;
  loginHref: string;
  lines: CartLine[];
  count: number;
  subtotal: number;
  add: (item: StoreItem, quantity?: number) => void;
  setQuantity: (id: string, quantity: number) => void;
  remove: (id: string) => void;
  clear: () => void;
  // Cart drawer
  cartOpen: boolean;
  setCartOpen: (open: boolean) => void;
  // Checkout dialog
  checkout: CheckoutMode | null;
  openCartCheckout: () => void;
  openDirectCheckout: (item: StoreItem) => void;
  closeCheckout: () => void;
  checkoutLines: () => CartLine[];
};

const CartContext = createContext<CartContextValue | null>(null);

const STORAGE_KEY = "mektek.cart.v1";

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}

export function CartProvider({
  locale,
  isAuthenticated = false,
  children,
}: {
  locale: string;
  isAuthenticated?: boolean;
  children: React.ReactNode;
}) {
  const loginHref = `/${locale}/customer/access`;

  const [lines, setLines] = useState<CartLine[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkout, setCheckout] = useState<CheckoutMode | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // Load persisted cart once.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as CartLine[];
        // Hydrating client state from an external store (localStorage) on mount.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (Array.isArray(parsed)) setLines(parsed.filter((l) => l?.item?.id));
      }
    } catch {
      // ignore corrupt storage
    }
    setHydrated(true);
  }, []);

  // Persist on change (after hydration to avoid clobbering).
  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
    } catch {
      // ignore quota errors
    }
  }, [lines, hydrated]);

  const add = useCallback((item: StoreItem, quantity = 1) => {
    setLines((prev) => {
      const existing = prev.find((l) => l.item.id === item.id);
      if (existing) {
        return prev.map((l) =>
          l.item.id === item.id
            ? { ...l, quantity: Math.min(l.quantity + quantity, 99) }
            : l
        );
      }
      return [...prev, { item, quantity: Math.min(Math.max(quantity, 1), 99) }];
    });
  }, []);

  const setQuantity = useCallback((id: string, quantity: number) => {
    const q = Math.min(Math.max(Math.floor(quantity) || 1, 1), 99);
    setLines((prev) => prev.map((l) => (l.item.id === id ? { ...l, quantity: q } : l)));
  }, []);

  const remove = useCallback((id: string) => {
    setLines((prev) => prev.filter((l) => l.item.id !== id));
  }, []);

  const clear = useCallback(() => setLines([]), []);

  const openCartCheckout = useCallback(() => setCheckout({ kind: "cart" }), []);
  const openDirectCheckout = useCallback(
    (item: StoreItem) => setCheckout({ kind: "direct", item }),
    []
  );
  const closeCheckout = useCallback(() => setCheckout(null), []);

  const checkoutLines = useCallback((): CartLine[] => {
    if (!checkout) return [];
    if (checkout.kind === "direct") return [{ item: checkout.item, quantity: 1 }];
    return lines;
  }, [checkout, lines]);

  const count = useMemo(
    () => lines.reduce((sum, l) => sum + l.quantity, 0),
    [lines]
  );
  const subtotal = useMemo(
    () => lines.reduce((sum, l) => sum + l.item.price * l.quantity, 0),
    [lines]
  );

  const value: CartContextValue = {
    locale,
    isAuthenticated,
    loginHref,
    lines,
    count,
    subtotal,
    add,
    setQuantity,
    remove,
    clear,
    cartOpen,
    setCartOpen,
    checkout,
    openCartCheckout,
    openDirectCheckout,
    closeCheckout,
    checkoutLines,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
