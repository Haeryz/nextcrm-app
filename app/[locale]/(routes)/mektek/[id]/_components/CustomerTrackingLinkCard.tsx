"use client";

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
    await navigator.clipboard.writeText(link);
    toast.success("Link pelanggan disalin");
  };

  return (
    <div className="min-w-0 space-y-3 rounded-lg border bg-card p-3 sm:p-4">
      <p className="text-sm font-semibold">Link pelanggan</p>
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
        <Input value={link} readOnly className="min-w-0" />
        <Button
          type="button"
          onClick={copyLink}
          className="w-full sm:w-auto"
        >
          Salin
        </Button>
      </div>
    </div>
  );
}
