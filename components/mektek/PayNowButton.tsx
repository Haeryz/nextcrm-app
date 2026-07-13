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
      existing.addEventListener("error", () => reject(new Error("snap.js failed")), {
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
    script.addEventListener("error", () => reject(new Error("snap.js failed")), {
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

  const handlePay = async () => {
    setLoading(true);
    try {
      const result = await createMektekPaymentIntent({ serviceOrderId, token, code });

      if (result?.error || !result?.data) {
        toast.error(result?.error ?? "Gagal memulai pembayaran");
        return;
      }

      const { snapToken, clientKey, snapScriptUrl, orderId } = result.data;

      await loadSnapScript(snapScriptUrl, clientKey);

      if (!window.snap) {
        toast.error("Gagal memuat pembayaran");
        return;
      }

      window.snap.pay(snapToken, {
        onSuccess: () => {
          void confirmPayment(orderId);
        },
        onPending: () => {
          toast.info("Menunggu pembayaran Anda.");
        },
        onError: () => {
          toast.error("Pembayaran gagal. Silakan coba lagi.");
        },
        onClose: () => {
          toast.info("Pembayaran dibatalkan.");
        },
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  };

  if (balanceDue <= 0) return null;

  return (
    <Button onClick={handlePay} disabled={loading} className={className}>
      {loading ? (
        <Loader2 data-icon="inline-start" className="animate-spin" />
      ) : (
        <CreditCard data-icon="inline-start" />
      )}
      Bayar {formatCurrency(balanceDue)}
    </Button>
  );
}
