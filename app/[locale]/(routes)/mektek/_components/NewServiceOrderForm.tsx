"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { createMektekServiceOrder } from "@/actions/mektek/service-orders";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import DamageItemsInput, { DamageItem } from "./DamageItemsInput";

export default function NewServiceOrderForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [trackingLink, setTrackingLink] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [damageItems, setDamageItems] = useState<DamageItem[]>([{ description: "", estimatedCost: "" }]);
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [estimatedDone, setEstimatedDone] = useState("");

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    startTransition(async () => {
      const complaint = damageItems
        .filter((item) => item.description.trim())
        .map((item) =>
          item.estimatedCost
            ? `${item.description.trim()} (Est. Rp ${item.estimatedCost})`
            : item.description.trim()
        )
        .join("\n");

      const result = await createMektekServiceOrder({
        customerName,
        vehicle,
        complaint: complaint || "-",
        phone,
        address,
        estimatedDone,
        damageItems,
      });

      if (result?.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Service order created");
      setTrackingLink(result?.data?.customerTrackingLink || "");
      setCustomerName("");
      setVehicle("");
      setDamageItems([{ description: "", estimatedCost: "" }]);
      setPhone("");
      setAddress("");
      setEstimatedDone("");
      router.refresh();
    });
  };

  const copyLink = async () => {
    if (!trackingLink) return;
    await navigator.clipboard.writeText(trackingLink);
    toast.success("Customer tracking link copied");
  };

  return (
    <div className="space-y-4">
      <form onSubmit={onSubmit} className="rounded-xl border bg-card p-5 md:p-6 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              Service Intake
            </p>
            <h3 className="text-lg font-semibold">Input Service Baru</h3>
          </div>
          <span className="text-xs rounded-full border px-3 py-1 text-muted-foreground">
            Admin Only
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Input
          placeholder="Customer name"
          value={customerName}
          onChange={(event) => setCustomerName(event.target.value)}
          disabled={isPending}
          required
        />
        <Input
          placeholder="Vehicle (e.g. Toyota Avanza 2021)"
          value={vehicle}
          onChange={(event) => setVehicle(event.target.value)}
          disabled={isPending}
          required
        />
        <Input
          placeholder="Phone"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          disabled={isPending}
        />
        <Input
          placeholder="Estimated done"
          type="date"
          value={estimatedDone}
          onChange={(event) => setEstimatedDone(event.target.value)}
          disabled={isPending}
        />
        </div>

        <div className="grid grid-cols-1 gap-3">
        <Input
          placeholder="Address"
          value={address}
          onChange={(event) => setAddress(event.target.value)}
          disabled={isPending}
        />
        <DamageItemsInput
          items={damageItems}
          onChange={setDamageItems}
          disabled={isPending}
        />
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={isPending}>
            {isPending ? "Saving..." : "Add Service"}
          </Button>
        </div>
      </form>

      {trackingLink && (
        <div className="rounded-xl border p-4 bg-muted/20">
          <p className="text-sm font-medium mb-2">Customer tracking link</p>
          <div className="flex flex-col md:flex-row gap-2">
            <Input value={trackingLink} readOnly />
            <Button type="button" onClick={copyLink}>
              Copy Link
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
