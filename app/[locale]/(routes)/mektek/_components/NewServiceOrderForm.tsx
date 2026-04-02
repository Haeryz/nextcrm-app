"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { createMektekServiceOrder } from "@/actions/mektek/service-orders";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export default function NewServiceOrderForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [trackingLink, setTrackingLink] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [complaint, setComplaint] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [estimatedDone, setEstimatedDone] = useState("");

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    startTransition(async () => {
      const result = await createMektekServiceOrder({
        customerName,
        vehicle,
        complaint,
        phone,
        address,
        estimatedDone,
      });

      if (result?.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Service order created");
      setTrackingLink(result?.data?.customerTrackingLink || "");
      setCustomerName("");
      setVehicle("");
      setComplaint("");
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
    <div className="space-y-3">
      <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-3 rounded-lg border p-4 bg-card">
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
        <Input
          placeholder="Address"
          value={address}
          onChange={(event) => setAddress(event.target.value)}
          disabled={isPending}
          className="md:col-span-2"
        />
        <Textarea
          placeholder="Damage/complaint details (manual input by CS)"
          value={complaint}
          onChange={(event) => setComplaint(event.target.value)}
          disabled={isPending}
          required
          className="md:col-span-2"
        />
        <div className="md:col-span-2 flex justify-end">
          <Button type="submit" disabled={isPending}>
            {isPending ? "Saving..." : "Add Service"}
          </Button>
        </div>
      </form>

      {trackingLink && (
        <div className="rounded-lg border p-4 bg-muted/20">
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