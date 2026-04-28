"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LinkIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { linkCustomerServiceByToken } from "@/actions/catalog/customer";

export default function LinkServiceForm() {
  const [trackingLink, setTrackingLink] = useState("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const result = await linkCustomerServiceByToken({ trackingLink });
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      setTrackingLink("");
      toast.success("Service linked to your profile.");
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2 sm:flex-row">
      <Input
        value={trackingLink}
        onChange={(event) => setTrackingLink(event.target.value)}
        placeholder="Paste service tracking link"
        disabled={isPending}
      />
      <Button type="submit" disabled={isPending}>
        <LinkIcon className="size-4" />
        Link
      </Button>
    </form>
  );
}
