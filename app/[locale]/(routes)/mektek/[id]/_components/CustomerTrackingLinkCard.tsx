"use client";

import { Copy } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface CustomerTrackingLinkCardProps {
  link: string;
}

export default function CustomerTrackingLinkCard({
  link,
}: CustomerTrackingLinkCardProps) {
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Link pelanggan disalin");
    } catch {
      toast.error("Gagal menyalin link. Salin manual dari kolom di samping.");
    }
  };

  return (
    <div className="min-w-0 space-y-2 rounded-lg border bg-card p-3 sm:p-4">
      <p className="text-sm font-semibold">Link pelanggan</p>
      {/* Single row at every width: stacking only added a wasted row in the
          sidebar, and the field is read-only so it never needs full width. */}
      <div className="flex min-w-0 items-center gap-2">
        <Input
          value={link}
          readOnly
          aria-label="Link pelacakan pelanggan"
          onFocus={(event) => event.currentTarget.select()}
          className="min-w-0 flex-1 font-mono text-xs"
        />
        <Button
          type="button"
          onClick={copyLink}
          className="shrink-0 gap-1.5 px-3"
        >
          <Copy className="size-4" aria-hidden="true" />
          Salin
        </Button>
      </div>
    </div>
  );
}
