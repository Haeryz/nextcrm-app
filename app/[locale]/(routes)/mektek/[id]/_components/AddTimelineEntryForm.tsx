"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import { addMektekTimelineEntry } from "@/actions/mektek/service-orders";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AddTimelineEntryFormProps {
  serviceOrderId: string;
}

export default function AddTimelineEntryForm({
  serviceOrderId,
}: AddTimelineEntryFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<"done" | "pending">("done");

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    startTransition(async () => {
      const result = await addMektekTimelineEntry({
        serviceOrderId,
        description,
        completed: status === "done",
      });

      if (result?.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Timeline entry added");
      setDescription("");
      setStatus("done");
      router.refresh();
    });
  };

  return (
    <form onSubmit={onSubmit} className="rounded-lg border p-4 bg-card space-y-3">
      <p className="text-sm font-semibold">Tambah timeline pesanan</p>
      <Input
        placeholder="Contoh: Sparepart AC sudah dipasang"
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        disabled={isPending}
        required
      />
      <div className="grid grid-cols-1 md:grid-cols-[180px_1fr] gap-3 items-center">
        <Select value={status} onValueChange={(value) => setStatus(value as "done" | "pending")}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="done">Done</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex justify-end">
          <Button type="submit" disabled={isPending}>
            {isPending ? "Saving..." : "Add timeline"}
          </Button>
        </div>
      </div>
    </form>
  );
}
