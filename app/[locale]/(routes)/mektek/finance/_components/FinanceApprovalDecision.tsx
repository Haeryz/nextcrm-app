"use client";

import { useState, useTransition } from "react";
import { Check, Loader2, ShieldCheck, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { decideFinanceApproval } from "@/actions/mektek/finance";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export default function FinanceApprovalDecision({
  approvalId,
  requiresReason,
  supplyConflict = false,
}: {
  approvalId: string;
  requiresReason: boolean;
  supplyConflict?: boolean;
}) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();
  const [pendingDecision, setPendingDecision] = useState<"approve" | "reject" | null>(null);

  const decide = (approve: boolean) => {
    const normalizedReason = reason.trim();
    if (requiresReason && !normalizedReason) {
      toast.error("Alasan keputusan wajib diisi");
      return;
    }

    startTransition(async () => {
      setPendingDecision(approve ? "approve" : "reject");
      const result = await decideFinanceApproval({
        approvalId,
        approve,
        reason: normalizedReason || undefined,
      });
      if ("error" in result) {
        toast.error(result.error);
        setPendingDecision(null);
        return;
      }
      toast.success(
        approve ? "Permintaan berhasil disetujui" : "Permintaan berhasil ditolak",
      );
      setPendingDecision(null);
      router.refresh();
    });
  };

  return (
    <div className="space-y-4 border-t pt-5">
      <div className="space-y-2">
        <Label htmlFor={`approval-reason-${approvalId}`}>
          Alasan keputusan{requiresReason ? " *" : ""}
        </Label>
        <Textarea
          id={`approval-reason-${approvalId}`}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder={
            supplyConflict
              ? "Contoh: Kedua PO telah diverifikasi dan pengiriman ini bukan duplikasi."
              : "Tuliskan catatan keputusan (opsional)."
          }
          aria-describedby={`approval-help-${approvalId}`}
          maxLength={1000}
          rows={3}
          disabled={pending}
        />
        <p id={`approval-help-${approvalId}`} className="text-xs text-muted-foreground">
          {supplyConflict
            ? "Alasan tersimpan di riwayat audit dan wajib diisi untuk keputusan konflik pasokan."
            : "Catatan membantu tim memahami dasar keputusan ini."}
        </p>
      </div>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant={supplyConflict ? "destructive" : "outline"}
          disabled={pending}
          onClick={() => decide(false)}
        >
          {pendingDecision === "reject" ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <X className="mr-2 size-4" />
          )}
          {supplyConflict ? "Tolak & tetap blokir" : "Tolak"}
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={pending}
          onClick={() => decide(true)}
        >
          {pendingDecision === "approve" ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            supplyConflict ? (
              <ShieldCheck className="mr-2 size-4" />
            ) : (
              <Check className="mr-2 size-4" />
            )
          )}
          {supplyConflict ? "Setujui pengecualian" : "Setujui"}
        </Button>
      </div>
    </div>
  );
}
