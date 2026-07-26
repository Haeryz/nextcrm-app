"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CreditCard, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  createMektekPaymentIntent,
  syncMektekPaymentStatus,
} from "@/actions/mektek/payments";
import { confirmPaymentWithRetry } from "@/lib/mektek/payment-confirmation";
import { cn } from "@/lib/utils";

type SnapCallbacks = {
  onSuccess?: (result: unknown) => void;
  onPending?: (result: unknown) => void;
  onError?: (result: unknown) => void;
  onClose?: () => void;
};

declare global {
  interface Window {
    snap?: {
      pay: (token: string, options?: SnapCallbacks) => void;
    };
  }
}

type PayNowButtonProps = {
  serviceOrderId: string;
  token?: string;
  code?: string;
  balanceDue: number;
  className?: string;
};

const formatCurrency = (amount: number) =>
  amount.toLocaleString("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  });

/** Load snap.js once (idempotent), keyed by src so re-mounts reuse the script. */
function loadSnapScript(src: string, clientKey: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("Not in browser"));
      return;
    }
    if (window.snap) {
      resolve();
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>(
      `script[data-midtrans-snap="true"]`
    );
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Gagal memuat snap.js")), {
        once: true,
      });
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.dataset.midtransSnap = "true";
    script.setAttribute("data-client-key", clientKey);
    script.addEventListener("load", () => resolve(), { once: true });
    script.addEventListener("error", () => reject(new Error("Gagal memuat snap.js")), {
      once: true,
    });
    document.body.appendChild(script);
  });
}

export function PayNowButton({
  serviceOrderId,
  token,
  code,
  balanceDue,
  className,
}: PayNowButtonProps) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const confirmPayment = async (orderId: string) => {
    const result = await confirmPaymentWithRetry(() =>
      syncMektekPaymentStatus({
        serviceOrderId,
        token,
        code,
        orderId,
      })
    );

    if (result?.error) {
      toast.error(result.error);
      return;
    }

    if (result.data?.status === "paid") {
      toast.success("Pembayaran berhasil. Status sudah diperbarui.");
    } else if (result.data?.status === "pending") {
      toast.info("Pembayaran masih menunggu konfirmasi Midtrans.");
    } else {
      toast.error("Pembayaran belum berhasil dikonfirmasi.");
    }

    router.refresh();
  };

  /**
   * `window.snap.pay()` is non-blocking: it opens the Midtrans modal and returns
   * immediately. Clearing `loading` in a `finally` around it therefore re-enabled
   * the button while the modal was still open, so dismissing and re-clicking
   * created a SECOND payment intent for the same order. The flag must only be
   * cleared on paths where no Snap modal is (or will be) open — i.e. every early
   * bail-out before `pay()`, the synchronous throw from `pay()` itself, and the
   * four Snap lifecycle callbacks. This mirrors `CheckoutDialog`.
   */
  const handlePay = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const result = await createMektekPaymentIntent({ serviceOrderId, token, code });

      // Exit 1: server refused to create the intent.
      if (result?.error || !result?.data) {
        toast.error(result?.error ?? "Gagal memulai pembayaran");
        setLoading(false);
        return;
      }

      const { snapToken, clientKey, snapScriptUrl, orderId } = result.data;

      await loadSnapScript(snapScriptUrl, clientKey);

      // Exit 2: snap.js loaded but did not expose the global.
      if (!window.snap) {
        toast.error("Gagal memuat pembayaran");
        setLoading(false);
        return;
      }

      window.snap.pay(snapToken, {
        // Exit 3: paid — stay disabled until confirmation settles.
        onSuccess: () => {
          void (async () => {
            try {
              await confirmPayment(orderId);
            } catch {
              toast.info("Pembayaran berhasil dan sedang dikonfirmasi Midtrans.");
            } finally {
              setLoading(false);
            }
          })();
        },
        // Exit 4: awaiting payment (VA / QRIS).
        onPending: () => {
          toast.info("Menunggu pembayaran Anda.");
          setLoading(false);
        },
        // Exit 5: Midtrans reported a failure.
        onError: () => {
          toast.error("Pembayaran gagal. Silakan coba lagi.");
          setLoading(false);
        },
        // Exit 6: customer dismissed the modal.
        onClose: () => {
          toast.info("Pembayaran dibatalkan.");
          setLoading(false);
        },
      });
    } catch (error) {
      // Exit 7: snap.js failed to load, or pay() threw synchronously — in both
      // cases no modal is open, so the button must become clickable again.
      toast.error(error instanceof Error ? error.message : "Terjadi kesalahan");
      setLoading(false);
    }
  };

  if (balanceDue <= 0) return null;

  return (
    <Button
      type="button"
      onClick={handlePay}
      disabled={loading}
      aria-busy={loading}
      className={cn("h-11 sm:h-10", className)}
    >
      {loading ? (
        <Loader2
          data-icon="inline-start"
          className="animate-spin"
          aria-hidden="true"
        />
      ) : (
        <CreditCard data-icon="inline-start" aria-hidden="true" />
      )}
      {loading ? "Memproses pembayaran…" : `Bayar ${formatCurrency(balanceDue)}`}
    </Button>
  );
}
