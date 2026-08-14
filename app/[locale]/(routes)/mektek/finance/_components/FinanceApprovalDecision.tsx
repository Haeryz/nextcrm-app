"use client";

import { useState, useTransition } from "react";
import { Check, Loader2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { decideFinanceApproval } from "@/actions/mektek/finance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function FinanceApprovalDecision({
  approvalId,
  requiresReason,
}: {
  approvalId: string;
  requiresReason: boolean;
}) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();

  const decide = (approve: boolean) => {
    const normalizedReason = reason.trim();
    if (requiresReason && !normalizedReason) {
      toast.error("Alasan keputusan wajib diisi");
      return;
    }

    startTransition(async () => {
      const result = await decideFinanceApproval({
        approvalId,
        approve,
        reason: normalizedReason || undefined,
      });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(
        approve ? "Permintaan berhasil disetujui" : "Permintaan berhasil ditolak",
      );
      router.refresh();
    });
  };

  return (
    <div className="mt-3 space-y-2 border-t pt-3">
      <Input
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        placeholder={
          requiresReason
            ? "Alasan keputusan (wajib)"
            : "Alasan keputusan (opsional)"
        }
        aria-label="Alasan keputusan"
        maxLength={1000}
        disabled={pending}
      />
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          disabled={pending}
          onClick={() => decide(true)}
        >
          {pending ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <Check className="mr-2 size-4" />
          )}
          Setujui
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => decide(false)}
        >
          <X className="mr-2 size-4" />
          Tolak
        </Button>
      </div>
    </div>
  );
}
