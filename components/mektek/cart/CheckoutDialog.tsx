"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { syncMektekPaymentStatus } from "@/actions/mektek/payments";
import { confirmPaymentWithRetry } from "@/lib/mektek/payment-confirmation";
import { useCart } from "./CartProvider";
import { loadSnapScript, formatIDR } from "./snap";

export function CheckoutDialog() {
  const {
    locale,
    checkout,
    checkoutLines,
    closeCheckout,
    clear,
    loginHref,
  } = useCart();
  const router = useRouter();
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
        // Server rejected because the visitor is not logged in — send them to login.
        if ("code" in (result ?? {}) && result?.code === "AUTH_REQUIRED") {
          closeCheckout();
          router.push(loginHref);
        }
        return;
      }

      const {
        snapToken,
        clientKey,
        snapScriptUrl,
        trackingPath,
        trackingCode,
        serviceOrderId,
        orderId,
      } = result.data;
      await loadSnapScript(snapScriptUrl, clientKey);

      if (!window.snap) {
        toast.error("Gagal memuat pembayaran");
        setLoading(false);
        return;
      }

      window.snap.pay(snapToken, {
        onSuccess: () => {
          void (async () => {
            try {
              const confirmation = await confirmPaymentWithRetry(() =>
                syncMektekPaymentStatus({
                  serviceOrderId,
                  code: trackingCode,
                  orderId,
                })
              );

              if (confirmation.data?.status === "paid") {
                toast.success("Pembayaran berhasil. Status sudah diperbarui.");
              } else {
                toast.info("Pembayaran berhasil dan sedang dikonfirmasi Midtrans.");
              }
            } catch {
              toast.info("Pembayaran berhasil dan sedang dikonfirmasi Midtrans.");
            } finally {
              if (isCart) clear();
              setDone({ trackingPath });
              setLoading(false);
            }
          })();
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
      <DialogContent className="customer-light max-h-[90vh] overflow-y-auto border-border/10 bg-muted text-[hsl(var(--brand-navy-ink))] sm:max-w-lg">
        {done ? (
          <div className="flex flex-col items-center gap-4 py-4 text-center">
            <CheckCircle2 className="size-12 text-primary" aria-hidden="true" />
            <div className="space-y-1">
              <DialogTitle>Pesanan diterima</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Pembayaran sedang dikonfirmasi. Anda dapat memantau status pesanan.
              </DialogDescription>
            </div>
            <div className="flex w-full flex-col gap-2 pt-2">
              <Button asChild className="h-11 w-full sm:h-10">
                <Link href={done.trackingPath}>Lihat status pesanan</Link>
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-11 w-full border-border/20 text-[hsl(var(--brand-navy-deep))] sm:h-10"
                onClick={handleClose}
              >
                Tutup
              </Button>
            </div>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Checkout</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Masukkan data Anda untuk melanjutkan pembayaran.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <ul className="max-h-40 space-y-2 overflow-y-auto rounded-xl border border-border/10 bg-card p-4 shadow-sm">
                {lines.map(({ item, quantity }) => (
                  <li
                    key={item.id}
                    className="flex items-start justify-between gap-3 text-sm"
                  >
                    <span className="min-w-0 flex-1 truncate">
                      {item.description}{" "}
                      <span className="text-muted-foreground">× {quantity}</span>
                    </span>
                    <span className="font-medium tabular-nums">
                      {formatIDR(item.price * quantity)}
                    </span>
                  </li>
                ))}
              </ul>
              {/* Announced on change: a direct-checkout line and a cart checkout
                  reuse this dialog, so the total can change under the reader. */}
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
                Total akhir termasuk PPN 11% &amp; PPh 2% akan tampil di Midtrans.
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
                  required
                  aria-required="true"
                  className="h-11 border-border/20 bg-card text-[hsl(var(--brand-navy-deep))] sm:h-10"
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
                  required
                  aria-required="true"
                  aria-describedby="co-phone-hint"
                  className="h-11 border-border/20 bg-card text-[hsl(var(--brand-navy-deep))] sm:h-10"
                />
                <p id="co-phone-hint" className="text-xs text-muted-foreground">
                  Dipakai untuk mengirim status pesanan lewat WhatsApp.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="co-address">Alamat (opsional)</Label>
                <Input
                  id="co-address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Alamat pengiriman"
                  autoComplete="street-address"
                  className="h-11 border-border/20 bg-card text-[hsl(var(--brand-navy-deep))] sm:h-10"
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={loading}
                className="h-11 border-border/20 text-[hsl(var(--brand-navy-deep))] sm:h-10"
              >
                Batal
              </Button>
              <Button
                type="button"
                onClick={handlePay}
                disabled={loading}
                aria-busy={loading}
                className="h-11 sm:h-10"
              >
                {loading ? (
                  <Loader2
                    data-icon="inline-start"
                    className="animate-spin"
                    aria-hidden="true"
                  />
                ) : null}
                {loading
                  ? "Memproses pembayaran…"
                  : `Bayar ${formatIDR(subtotal)}`}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
