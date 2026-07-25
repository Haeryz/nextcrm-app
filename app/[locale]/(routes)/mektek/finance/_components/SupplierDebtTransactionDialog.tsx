"use client";

import { FormEvent, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { HandCoins, Loader2, WalletCards } from "lucide-react";
import { toast } from "sonner";

import { recordSupplierDebtTransaction } from "@/actions/mektek/supplier-debt-report";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type {
  SupplierDebtPaymentSource,
  SupplierDebtTransactionKind,
} from "@/lib/mektek/supplier-debt-ledger";

const rupiah = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

const today = () => {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
};

export default function SupplierDebtTransactionDialog({
  kind,
  sheetKey,
  sourceRow,
  invoiceLabel,
  remainingAmount,
  depositBalance,
}: {
  kind: SupplierDebtTransactionKind;
  sheetKey: string;
  sourceRow: number;
  invoiceLabel: string;
  remainingAmount: number;
  depositBalance: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [amount, setAmount] = useState("");
  const [appliedAmount, setAppliedAmount] = useState("");
  const [paymentSource, setPaymentSource] =
    useState<SupplierDebtPaymentSource>("CASH");
  const [transactionDate, setTransactionDate] = useState(today);
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const isDeposit = kind === "DEPOSIT";
  const numericAmount = Number(amount) || 0;
  const numericApplied = Number(appliedAmount) || 0;
  const depositLeft = useMemo(
    () => Math.max(numericAmount - numericApplied, 0),
    [numericAmount, numericApplied],
  );

  const reset = () => {
    setAmount("");
    setAppliedAmount("");
    setPaymentSource("CASH");
    setTransactionDate(today());
    setReference("");
    setNote("");
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    startTransition(async () => {
      const result = await recordSupplierDebtTransaction(
        { sheetKey, sourceRow },
        {
          kind,
          amount,
          appliedAmount: isDeposit ? appliedAmount : undefined,
          paymentSource: isDeposit ? undefined : paymentSource,
          transactionDate,
          reference,
          note,
        },
      );
      if (!("data" in result) || !result.data) {
        toast.error(
          "error" in result ? result.error : "Transaksi pemasok gagal disimpan",
        );
        return;
      }
      toast.success(
        isDeposit
          ? `Deposit tersimpan. Sisa deposit ${rupiah.format(result.data.remainingDeposit)}`
          : "Pembayaran hutang berhasil dicatat",
      );
      setOpen(false);
      reset();
      router.refresh();
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={isDeposit ? "Catat deposit" : "Bayar hutang atau piutang"}
          title={isDeposit ? "Catat deposit" : "Bayar hutang / piutang"}
          disabled={remainingAmount <= 0 && !isDeposit}
        >
          {isDeposit ? (
            <WalletCards className="h-4 w-4 text-sky-600" />
          ) : (
            <HandCoins className="h-4 w-4 text-emerald-600" />
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isDeposit ? "Catat deposit pemasok" : "Bayar hutang / piutang"}
          </DialogTitle>
          <DialogDescription>
            {invoiceLabel} · sisa hutang {rupiah.format(remainingAmount)}.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={`${kind}-${sourceRow}-amount`}>
                {isDeposit ? "Nominal deposit" : "Nominal pembayaran"}
              </Label>
              <Input
                id={`${kind}-${sourceRow}-amount`}
                type="number"
                min="0.01"
                step="0.01"
                max={isDeposit ? undefined : remainingAmount}
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${kind}-${sourceRow}-date`}>
                Tanggal transaksi
              </Label>
              <Input
                id={`${kind}-${sourceRow}-date`}
                type="date"
                value={transactionDate}
                onChange={(event) => setTransactionDate(event.target.value)}
                required
              />
            </div>
          </div>

          {isDeposit ? (
            <div className="rounded-lg border bg-sky-50/70 p-3">
              <Label htmlFor={`${kind}-${sourceRow}-applied`}>
                Langsung gunakan untuk baris ini
              </Label>
              <Input
                id={`${kind}-${sourceRow}-applied`}
                className="mt-1.5 bg-background"
                type="number"
                min="0"
                step="0.01"
                max={Math.min(numericAmount, remainingAmount)}
                value={appliedAmount}
                onChange={(event) => setAppliedAmount(event.target.value)}
                placeholder="0"
              />
              <p className="mt-2 text-xs text-sky-800">
                Sisa {rupiah.format(depositLeft)} akan terdokumentasi sebagai
                saldo deposit pemasok.
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor={`${kind}-${sourceRow}-source`}>
                Sumber pembayaran
              </Label>
              <select
                id={`${kind}-${sourceRow}-source`}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={paymentSource}
                onChange={(event) =>
                  setPaymentSource(
                    event.target.value as SupplierDebtPaymentSource,
                  )
                }
              >
                <option value="CASH">Kas / transfer langsung</option>
                <option value="DEPOSIT">
                  Saldo deposit ({rupiah.format(depositBalance)})
                </option>
              </select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor={`${kind}-${sourceRow}-reference`}>
              Nomor referensi
            </Label>
            <Input
              id={`${kind}-${sourceRow}-reference`}
              value={reference}
              onChange={(event) => setReference(event.target.value)}
              placeholder="Contoh: TRF-2026-001"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${kind}-${sourceRow}-note`}>Catatan</Label>
            <Textarea
              id={`${kind}-${sourceRow}-note`}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Tujuan deposit atau keterangan pembayaran"
              rows={3}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              {isDeposit ? "Simpan deposit" : "Simpan pembayaran"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
