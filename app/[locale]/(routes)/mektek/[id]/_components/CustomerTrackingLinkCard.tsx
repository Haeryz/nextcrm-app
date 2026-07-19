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
    <div className="rounded-lg border p-4 bg-card space-y-3">
      <p className="text-sm font-semibold">Link pelanggan</p>
      <div className="flex flex-col md:flex-row gap-2">
        <Input value={link} readOnly />
        <Button type="button" onClick={copyLink}>
          Salin
        </Button>
      </div>
    </div>
  );
}
