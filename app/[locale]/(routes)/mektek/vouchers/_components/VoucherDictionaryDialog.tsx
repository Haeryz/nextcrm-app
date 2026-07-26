"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  createMektekVoucherCodeDictionary,
  deleteMektekVoucherCodeDictionary,
} from "@/actions/mektek/voucher-code-dictionaries";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import type { VoucherCodeDictionary } from "./VoucherManager";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

/**
 * Code-dictionary manager, extracted out of `VoucherManager` so it can be
 * lazy-loaded. It is a controlled dialog: the trigger button and the open state
 * live in the parent, which only mounts this component once the dialog has been
 * opened at least once.
 */
export default function VoucherDictionaryDialog({
  dictionaries,
  open,
  onOpenChange,
}: {
  dictionaries: VoucherCodeDictionary[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [entries, setEntries] = useState("");
  const [pending, startTransition] = useTransition();

  const createDictionary = () => {
    startTransition(async () => {
      const result = await createMektekVoucherCodeDictionary({ name, entries });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      setName("");
      setEntries("");
      toast.success("Code dictionary created");
      router.refresh();
    });
  };

  const deleteDictionary = (id: string) => {
    startTransition(async () => {
      const result = await deleteMektekVoucherCodeDictionary(id);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Code dictionary deleted");
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Code dictionaries</DialogTitle>
          <DialogDescription>
            Create reusable pools of voucher codes. Add one code per line or separate them with commas.
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-3 rounded-lg border p-4"
          onSubmit={(event) => {
            event.preventDefault();
            createDictionary();
          }}
        >
          <Field label="Dictionary name">
            <Input value={name} onChange={(event) => setName(event.target.value)} disabled={pending} required />
          </Field>
          <Field label="Voucher codes">
            <Textarea
              value={entries}
              onChange={(event) => setEntries(event.target.value)}
              disabled={pending}
              placeholder={"SUMMER-25\nWELCOME-50\nVIP-SERVICE"}
              rows={5}
              required
            />
          </Field>
          <div className="flex justify-end">
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 data-icon="inline-start" className="animate-spin" />}
              Create dictionary
            </Button>
          </div>
        </form>
        <div className="divide-y rounded-lg border">
          {dictionaries.map((dictionary) => (
            <div key={dictionary.id} className="flex items-center justify-between gap-3 p-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{dictionary.name}</p>
                <p className="text-xs text-muted-foreground">
                  {dictionary.entries.length} code{dictionary.entries.length === 1 ? "" : "s"}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => deleteDictionary(dictionary.id)}
                disabled={pending}
                aria-label={`Delete ${dictionary.name}`}
              >
                <Trash2 />
              </Button>
            </div>
          ))}
          {dictionaries.length === 0 && (
            <p className="p-4 text-center text-sm text-muted-foreground">
              No code dictionaries yet.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
