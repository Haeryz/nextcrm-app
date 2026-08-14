"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Banknote, Loader2 } from "lucide-react";
import type { FinancePaymentMethod } from "@prisma/client";
import { toast } from "sonner";

import { postFinanceDisbursement } from "@/actions/mektek/finance";
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

export default function SupplierBillPaymentDialog({
  billId,
  counterpartyId,
  supplierName,
  invoiceNumber,
  remainingAmount,
}: {
  billId: string;
  counterpartyId: string;
  supplierName: string;
  invoiceNumber: string;
  remainingAmount: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [amount, setAmount] = useState(String(remainingAmount));
  const [paidAt, setPaidAt] = useState(today);
  const [method, setMethod] =
    useState<FinancePaymentMethod>("BANK_TRANSFER");
  const [bankReference, setBankReference] = useState("");
  const [notes, setNotes] = useState("");

  const reset = () => {
    setAmount(String(remainingAmount));
    setPaidAt(today());
    setMethod("BANK_TRANSFER");
    setBankReference("");
    setNotes("");
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const numericAmount = Number(amount);
    if (
      !Number.isFinite(numericAmount) ||
      numericAmount <= 0 ||
      numericAmount > remainingAmount
    ) {
      toast.error("Nominal pembayaran harus sesuai dengan sisa tagihan");
      return;
    }

    startTransition(async () => {
      const result = await postFinanceDisbursement({
        counterpartyId,
        method,
        amount,
        paidAt,
        bankReference,
        notes,
        allocations: [{ supplierBillId: billId, amount }],
      });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(`Pembayaran ${result.data.paymentNumber} berhasil dicatat`);
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
        reset();
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" size="sm">
          <Banknote className="mr-2 size-4" />
          Catat pembayaran
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Catat pembayaran pemasok</DialogTitle>
          <DialogDescription>
            {supplierName} · Invoice {invoiceNumber} · Sisa {rupiah.format(remainingAmount)}
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={submit}>
          <div className="rounded-lg border bg-muted/30 p-3 text-sm">
            Pembayaran baru akan mengurangi kas dan sisa hutang setelah formulir
            ini disimpan.
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={`supplier-payment-${billId}-date`}>
                Tanggal pembayaran
              </Label>
              <Input
                id={`supplier-payment-${billId}-date`}
                type="date"
                value={paidAt}
                onChange={(event) => setPaidAt(event.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`supplier-payment-${billId}-amount`}>
                Jumlah dibayar
              </Label>
              <Input
                id={`supplier-payment-${billId}-amount`}
                type="number"
                min="1"
                max={remainingAmount}
                step="1"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                Maksimal {rupiah.format(remainingAmount)}
              </p>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`supplier-payment-${billId}-method`}>
              Metode pembayaran
            </Label>
            <select
              id={`supplier-payment-${billId}-method`}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={method}
              onChange={(event) =>
                setMethod(event.target.value as FinancePaymentMethod)
              }
            >
              <option value="BANK_TRANSFER">Transfer bank</option>
              <option value="CASH">Tunai</option>
              <option value="QRIS">QRIS</option>
              <option value="VIRTUAL_ACCOUNT">Virtual account</option>
              <option value="OTHER">Lainnya</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`supplier-payment-${billId}-reference`}>
              Referensi pembayaran
            </Label>
            <Input
              id={`supplier-payment-${billId}-reference`}
              value={bankReference}
              onChange={(event) => setBankReference(event.target.value)}
              placeholder="Nomor transfer, kuitansi, atau referensi kas"
              maxLength={180}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`supplier-payment-${billId}-notes`}>
              Catatan (opsional)
            </Label>
            <Textarea
              id={`supplier-payment-${billId}-notes`}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Keterangan tambahan pembayaran"
              maxLength={1000}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Batal
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Banknote className="mr-2 size-4" />
              )}
              Simpan pembayaran
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
