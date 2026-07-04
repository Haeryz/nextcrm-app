"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { CheckCircle2, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { createMektekCatalogPurchaseIntent } from "@/actions/mektek/catalog-purchase";
import { useCart } from "./CartProvider";
import { loadSnapScript, formatIDR } from "./snap";

export function CheckoutDialog() {
  const {
    locale,
    checkout,
    checkoutLines,
    closeCheckout,
    clear,
  } = useCart();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState<{ trackingPath: string } | null>(null);

  const open = checkout !== null;
  const lines = useMemo(
    () => (checkout ? checkoutLines() : []),
    [checkout, checkoutLines]
  );
  const isCart = checkout?.kind === "cart";

  const subtotal = useMemo(
    () => lines.reduce((sum, l) => sum + l.item.price * l.quantity, 0),
    [lines]
  );

  const reset = () => {
    setName("");
    setPhone("");
    setAddress("");
    setLoading(false);
    setDone(null);
  };

  const handleClose = () => {
    if (loading) return;
    closeCheckout();
    // Delay reset so the closing animation doesn't flash empty state.
    setTimeout(reset, 200);
  };

  const handlePay = async () => {
    if (!name.trim()) return toast.error("Nama wajib diisi");
    if (phone.replace(/\D/g, "").length < 8) return toast.error("Nomor telepon tidak valid");
    if (lines.length === 0) return toast.error("Tidak ada item");

    setLoading(true);
    try {
      const result = await createMektekCatalogPurchaseIntent({
        items: lines.map((l) => ({ catalogItemId: l.item.id, quantity: l.quantity })),
        customerName: name.trim(),
        phone: phone.trim(),
        address: address.trim() || undefined,
        locale,
      });

      if (result?.error || !result?.data) {
        toast.error(result?.error ?? "Gagal memulai pembayaran");
        setLoading(false);
        return;
      }

      const { snapToken, clientKey, snapScriptUrl, trackingPath } = result.data;
      await loadSnapScript(snapScriptUrl, clientKey);

      if (!window.snap) {
        toast.error("Gagal memuat pembayaran");
        setLoading(false);
        return;
      }

      window.snap.pay(snapToken, {
        onSuccess: () => {
          toast.success("Pembayaran berhasil.");
          if (isCart) clear();
          setDone({ trackingPath });
          setLoading(false);
        },
        onPending: () => {
          toast.info("Menunggu pembayaran Anda.");
          if (isCart) clear();
          setDone({ trackingPath });
          setLoading(false);
        },
        onError: () => {
          toast.error("Pembayaran gagal. Silakan coba lagi.");
          setLoading(false);
        },
        onClose: () => {
          setLoading(false);
        },
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Terjadi kesalahan");
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      modal={false}
      onOpenChange={(v) => (!v ? handleClose() : undefined)}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        {done ? (
          <div className="flex flex-col items-center gap-4 py-4 text-center">
            <CheckCircle2 className="size-12 text-emerald-600" />
            <div className="space-y-1">
              <DialogTitle>Pesanan diterima</DialogTitle>
              <DialogDescription>
                Pembayaran sedang dikonfirmasi. Anda dapat memantau status pesanan.
              </DialogDescription>
            </div>
            <div className="flex w-full flex-col gap-2 pt-2">
              <Button asChild className="w-full">
                <Link href={done.trackingPath}>Lihat status pesanan</Link>
              </Button>
              <Button variant="outline" className="w-full" onClick={handleClose}>
                Tutup
              </Button>
            </div>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Checkout</DialogTitle>
              <DialogDescription>
                Masukkan data Anda untuk melanjutkan pembayaran.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <div className="max-h-40 space-y-2 overflow-y-auto rounded-md border p-3">
                {lines.map(({ item, quantity }) => (
                  <div key={item.id} className="flex items-start justify-between gap-3 text-sm">
                    <span className="min-w-0 flex-1 truncate">
                      {item.description}{" "}
                      <span className="text-muted-foreground">× {quantity}</span>
                    </span>
                    <span className="font-medium">{formatIDR(item.price * quantity)}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-semibold">{formatIDR(subtotal)}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Total akhir termasuk PPN 11% & PPh 2% akan tampil di Midtrans.
              </p>
            </div>

            <Separator />

            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="co-name">Nama</Label>
                <Input
                  id="co-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nama lengkap"
                  autoComplete="name"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="co-phone">Nomor WhatsApp</Label>
                <Input
                  id="co-phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="08xxxxxxxxxx"
                  inputMode="tel"
                  autoComplete="tel"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="co-address">Alamat (opsional)</Label>
                <Input
                  id="co-address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Alamat pengiriman"
                  autoComplete="street-address"
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={loading}
              >
                Batal
              </Button>
              <Button type="button" onClick={handlePay} disabled={loading}>
                {loading ? (
                  <Loader2 data-icon="inline-start" className="animate-spin" />
                ) : null}
                Bayar {formatIDR(subtotal)}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
